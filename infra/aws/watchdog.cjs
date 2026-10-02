const {S3Client,ListObjectsV2Command,GetObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {ECSClient,DescribeTasksCommand,StopTaskCommand}=require('@aws-sdk/client-ecs');
const s3=new S3Client({}),ecs=new ECSClient({});
exports.handler=async()=>{
  const bucket=process.env.EXECUTION_BUCKET,cluster=process.env.EXECUTION_CLUSTER;
  let token,stopped=0;
  do {
    const page=await s3.send(new ListObjectsV2Command({Bucket:bucket,Prefix:'watchdogs/',ContinuationToken:token,MaxKeys:100}));
    for(const object of page.Contents||[]) {
      const record=await s3.send(new GetObjectCommand({Bucket:bucket,Key:object.Key}));
      const job=JSON.parse(await record.Body.transformToString());
      if(!Number.isFinite(job.deadline)||Date.now()<job.deadline) continue;
      if(!job.taskArn?.startsWith('arn:aws:ecs:us-east-1:954633149655:task/socrastica-learning/')) throw new Error('Invalid cleanup record');
      const status=await ecs.send(new DescribeTasksCommand({cluster,tasks:[job.taskArn]}));
      if(status.tasks?.[0]&&status.tasks[0].lastStatus!=='STOPPED') {
        await ecs.send(new StopTaskCommand({cluster,task:job.taskArn,reason:'Socrastica independent execution watchdog'}));stopped++;
      }
      await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:object.Key}));
    }
    token=page.NextContinuationToken;
  } while(token);
  console.log(`Cleanup completed; ${stopped} overdue tasks stopped.`);
  return {stopped};
};
