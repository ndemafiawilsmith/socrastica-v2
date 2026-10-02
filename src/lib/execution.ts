import 'server-only';
import { ECSClient, RunTaskCommand, DescribeTasksCommand, StopTaskCommand } from '@aws-sdk/client-ecs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
export const executionResult = z.object({passed:z.boolean(),summary:z.string().max(500),checks:z.array(z.string().max(300)).max(8)}).strict();
function config() {
  const region=process.env.AWS_REGION;
  const bucket=process.env.AWS_EXECUTION_BUCKET;
  const cluster=process.env.AWS_ECS_CLUSTER;
  const task=process.env.AWS_RUNNER_TASK_DEFINITION;
  const subnet=process.env.AWS_RUNNER_SUBNET;
  const securityGroup=process.env.AWS_RUNNER_SECURITY_GROUP;
  if(region!=='us-east-1'||!bucket?.startsWith('socrastica-954633149655-')||!cluster?.startsWith('arn:aws:ecs:us-east-1:954633149655:cluster/socrastica-')||!task?.startsWith('arn:aws:ecs:us-east-1:954633149655:task-definition/socrastica-')||!subnet||!securityGroup) throw new Error('EXECUTION_NOT_CONFIGURED');
  const options={region,credentials:process.env.AWS_PROFILE?fromIni({profile:process.env.AWS_PROFILE}):undefined};
  return {bucket,cluster,task,subnet,securityGroup,s3:new S3Client(options),ecs:new ECSClient(options)};
}
export async function launchExecution(id:string,code:string) {
  const c=config();
  await c.s3.send(new PutObjectCommand({Bucket:c.bucket,Key:`inputs/${id}.json`,Body:JSON.stringify({code}),ContentType:'application/json'}));
  const [input,result]=await Promise.all([
    getSignedUrl(c.s3,new GetObjectCommand({Bucket:c.bucket,Key:`inputs/${id}.json`}),{expiresIn:300}),
    getSignedUrl(c.s3,new PutObjectCommand({Bucket:c.bucket,Key:`results/${id}.json`,ContentType:'application/json'}),{expiresIn:300})
  ]);
  const response=await c.ecs.send(new RunTaskCommand({cluster:c.cluster,taskDefinition:c.task,launchType:'FARGATE',platformVersion:'1.4.0',count:1,clientToken:id,startedBy:id,networkConfiguration:{awsvpcConfiguration:{subnets:[c.subnet],securityGroups:[c.securityGroup],assignPublicIp:'ENABLED'}},overrides:{containerOverrides:[{name:'runner',environment:[{name:'JOB_INPUT_URL',value:input},{name:'JOB_RESULT_URL',value:result}]}]}}));
  const arn=response.tasks?.[0]?.taskArn;
  if(!arn||response.failures?.length) throw new Error('RUNNER_LAUNCH_FAILED');
  try {
    await c.s3.send(new PutObjectCommand({Bucket:c.bucket,Key:`watchdogs/${id}.json`,Body:JSON.stringify({taskArn:arn,deadline:Date.now()+240000}),ContentType:'application/json'}));
  } catch(error) {
    await c.ecs.send(new StopTaskCommand({cluster:c.cluster,task:arn,reason:'Unable to register execution cleanup'})).catch(()=>{});
    throw error;
  }
  return arn;
}
export async function stopExecution(arn:string) {
  const c=config(); await c.ecs.send(new StopTaskCommand({cluster:c.cluster,task:arn,reason:'Socrastica execution deadline'}));
}
export async function inspectExecution(id:string,arn:string) {
  const c=config();
  try {
    const object=await c.s3.send(new GetObjectCommand({Bucket:c.bucket,Key:`results/${id}.json`}));
    if((object.ContentLength??0)>8000) throw new Error('INVALID_RESULT');
    const body=await object.Body?.transformToString();
    return {status:'completed' as const,result:executionResult.parse(JSON.parse(body||''))};
  } catch(error) {
    if((error as {name?:string}).name!=='NoSuchKey') throw error;
  }
  const task=await c.ecs.send(new DescribeTasksCommand({cluster:c.cluster,tasks:[arn]}));
  if(task.failures?.length||task.tasks?.[0]?.lastStatus==='STOPPED') return {status:'failed' as const};
  return {status:'running' as const};
}
