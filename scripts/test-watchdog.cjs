const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const {fromIni}=require('@aws-sdk/credential-providers');
const {STSClient,GetCallerIdentityCommand}=require('@aws-sdk/client-sts');
const {ECSClient,RunTaskCommand,DescribeTasksCommand,StopTaskCommand}=require('@aws-sdk/client-ecs');
const {S3Client,PutObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {LambdaClient,InvokeCommand}=require('@aws-sdk/client-lambda');
const config=JSON.parse(fs.readFileSync('infra/aws/execution-resources.json','utf8'));
const options={region:'us-east-1',credentials:fromIni({profile:'socrastica'})};
const ecs=new ECSClient(options),s3=new S3Client(options),lambda=new LambdaClient(options);
let arn; const key=`watchdogs/${randomUUID()}.json`;
async function waitFor(status) {
  const deadline=Date.now()+150000;
  while(Date.now()<deadline) {
    const result=await ecs.send(new DescribeTasksCommand({cluster:config.AWS_ECS_CLUSTER,tasks:[arn]}));
    if(result.tasks?.[0]?.lastStatus===status)return;
    if(status==='RUNNING'&&result.tasks?.[0]?.lastStatus==='STOPPED')throw new Error('Test task stopped before starting');
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error(`Task did not reach ${status}`);
}
async function main() {
  assert.equal((await new STSClient(options).send(new GetCallerIdentityCommand({}))).Account,'954633149655');
  const run=await ecs.send(new RunTaskCommand({cluster:config.AWS_ECS_CLUSTER,taskDefinition:config.AWS_RUNNER_TASK_DEFINITION,count:1,launchType:'FARGATE',networkConfiguration:{awsvpcConfiguration:{subnets:[config.AWS_RUNNER_SUBNET],securityGroups:[config.AWS_RUNNER_SECURITY_GROUP],assignPublicIp:'ENABLED'}},overrides:{containerOverrides:[{name:'runner',command:['node','-e','setInterval(()=>{},1000)']}]}}));
  arn=run.tasks?.[0]?.taskArn;assert.ok(arn,'Unable to launch cleanup test');
  await waitFor('RUNNING');
  await s3.send(new PutObjectCommand({Bucket:config.AWS_EXECUTION_BUCKET,Key:key,Body:JSON.stringify({taskArn:arn,deadline:Date.now()-1000}),ContentType:'application/json'}));
  const invocation=await lambda.send(new InvokeCommand({FunctionName:'socrastica-execution-watchdog',Payload:Buffer.from('{}')}));
  assert.ok(!invocation.FunctionError,'Cleanup function failed');
  const result=JSON.parse(Buffer.from(invocation.Payload).toString());assert.ok(result.stopped>=1);
  await waitFor('STOPPED');
  console.log('PASS independent AWS watchdog stopped an overdue running task without browser/app polling');
}
main().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1;}).finally(async()=>{
  if(arn)await ecs.send(new StopTaskCommand({cluster:config.AWS_ECS_CLUSTER,task:arn,reason:'Watchdog integration test cleanup'})).catch(()=>{});
  await s3.send(new DeleteObjectCommand({Bucket:config.AWS_EXECUTION_BUCKET,Key:key})).catch(()=>{});
});
