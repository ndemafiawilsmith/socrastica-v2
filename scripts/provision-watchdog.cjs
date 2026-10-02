const fs=require('node:fs');
const {fromIni}=require('@aws-sdk/credential-providers');
const {STSClient,GetCallerIdentityCommand}=require('@aws-sdk/client-sts');
const {IAMClient,GetRoleCommand,CreateRoleCommand,PutRolePolicyCommand}=require('@aws-sdk/client-iam');
const {LambdaClient,GetFunctionCommand,CreateFunctionCommand,UpdateFunctionCodeCommand,AddPermissionCommand,InvokeCommand}=require('@aws-sdk/client-lambda');
const {CloudWatchEventsClient,PutRuleCommand,PutTargetsCommand}=require('@aws-sdk/client-cloudwatch-events');
const {CloudWatchLogsClient,CreateLogGroupCommand,PutRetentionPolicyCommand}=require('@aws-sdk/client-cloudwatch-logs');
const c={region:'us-east-1',credentials:fromIni({profile:'socrastica'})};
async function main() {
  if((await new STSClient(c).send(new GetCallerIdentityCommand({}))).Account!=='954633149655')throw new Error('WRONG_ACCOUNT');
  const config=JSON.parse(fs.readFileSync('infra/aws/execution-resources.json','utf8'));
  const iam=new IAMClient(c),lambda=new LambdaClient(c),events=new CloudWatchEventsClient(c),logs=new CloudWatchLogsClient(c);
  const roleName='socrastica-watchdog';let role;
  try {role=(await iam.send(new GetRoleCommand({RoleName:roleName}))).Role;}catch(e){if(e.name!=='NoSuchEntityException')throw e;role=(await iam.send(new CreateRoleCommand({RoleName:roleName,PermissionsBoundary:'arn:aws:iam::954633149655:policy/SocrasticaRuntimeBoundary',AssumeRolePolicyDocument:JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]})}))).Role;}
  await iam.send(new PutRolePolicyCommand({RoleName:roleName,PolicyName:'socrastica-watchdog',PolicyDocument:JSON.stringify({Version:'2012-10-17',Statement:[
    {Effect:'Allow',Action:'s3:ListBucket',Resource:`arn:aws:s3:::${config.AWS_EXECUTION_BUCKET}`,Condition:{StringLike:{'s3:prefix':'watchdogs/*'}}},
    {Effect:'Allow',Action:['s3:GetObject','s3:DeleteObject'],Resource:`arn:aws:s3:::${config.AWS_EXECUTION_BUCKET}/watchdogs/*`},
    {Effect:'Allow',Action:['ecs:DescribeTasks','ecs:StopTask'],Resource:'arn:aws:ecs:us-east-1:954633149655:task/socrastica-learning/*'},
    {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:'arn:aws:logs:us-east-1:954633149655:log-group:/socrastica/watchdog:*'}
  ]})}));
  try{await logs.send(new CreateLogGroupCommand({logGroupName:'/socrastica/watchdog'}));}catch(e){if(e.name!=='ResourceAlreadyExistsException')throw e;}
  await logs.send(new PutRetentionPolicyCommand({logGroupName:'/socrastica/watchdog',retentionInDays:3}));
  const name='socrastica-execution-watchdog',zip=fs.readFileSync('infra/aws/watchdog.zip');let fn;
  try {fn=(await lambda.send(new GetFunctionCommand({FunctionName:name}))).Configuration;await lambda.send(new UpdateFunctionCodeCommand({FunctionName:name,ZipFile:zip}));}
  catch(e) {
    if(e.name!=='ResourceNotFoundException')throw e;
    for(let attempt=0;attempt<6;attempt++) {
      try {fn=await lambda.send(new CreateFunctionCommand({FunctionName:name,Role:role.Arn,Runtime:'nodejs22.x',Handler:'watchdog.handler',Code:{ZipFile:zip},Timeout:60,MemorySize:128,LoggingConfig:{LogGroup:'/socrastica/watchdog'},Environment:{Variables:{EXECUTION_BUCKET:config.AWS_EXECUTION_BUCKET,EXECUTION_CLUSTER:config.AWS_ECS_CLUSTER}}}));break;}
      catch(error){if(error.name!=='InvalidParameterValueException'||attempt===5)throw error;await new Promise(r=>setTimeout(r,5000));}
    }
  }
  const rule=(await events.send(new PutRuleCommand({Name:'socrastica-execution-cleanup',ScheduleExpression:'rate(1 minute)',State:'ENABLED'}))).RuleArn;
  try {await lambda.send(new AddPermissionCommand({FunctionName:name,StatementId:'socrastica-eventbridge',Action:'lambda:InvokeFunction',Principal:'events.amazonaws.com',SourceArn:rule,SourceAccount:'954633149655'}));}catch(e){if(e.name!=='ResourceConflictException')throw e;}
  const target=await events.send(new PutTargetsCommand({Rule:'socrastica-execution-cleanup',Targets:[{Id:'cleanup',Arn:fn.FunctionArn,RetryPolicy:{MaximumRetryAttempts:2,MaximumEventAgeInSeconds:300}}]}));
  if(target.FailedEntryCount)throw new Error('TARGET_FAILED');
  for(let attempt=0;attempt<12;attempt++) {
    try {const response=await lambda.send(new InvokeCommand({FunctionName:name,Payload:Buffer.from('{}')}));if(response.FunctionError)throw new Error('WATCHDOG_FAILED');console.log('Independent AWS execution watchdog deployed and invocation passed.');return;}
    catch(e){if(e.name!=='ResourceConflictException'||attempt===11)throw e;await new Promise(r=>setTimeout(r,5000));}
  }
}
main().catch(e=>{console.error('Watchdog setup failed:',e.name,e.message?.includes('WATCHDOG')?e.message:e.$metadata?.httpStatusCode||'check configuration');process.exitCode=1;});
