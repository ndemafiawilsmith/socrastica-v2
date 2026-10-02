const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {fromIni}=require('@aws-sdk/credential-providers');
const {STSClient,GetCallerIdentityCommand}=require('@aws-sdk/client-sts');
const {EC2Client,DescribeVpcsCommand,DescribeSubnetsCommand,DescribeRouteTablesCommand,DescribeSecurityGroupsCommand,CreateSecurityGroupCommand,RevokeSecurityGroupEgressCommand,AuthorizeSecurityGroupEgressCommand}=require('@aws-sdk/client-ec2');
const {ECRClient,DescribeRepositoriesCommand,CreateRepositoryCommand,GetAuthorizationTokenCommand,DescribeImagesCommand}=require('@aws-sdk/client-ecr');
const {ECSClient,CreateClusterCommand,RegisterTaskDefinitionCommand}=require('@aws-sdk/client-ecs');
const {S3Client,HeadBucketCommand,CreateBucketCommand,PutPublicAccessBlockCommand,PutBucketEncryptionCommand,PutBucketLifecycleConfigurationCommand}=require('@aws-sdk/client-s3');
const {CloudWatchLogsClient,CreateLogGroupCommand,PutRetentionPolicyCommand}=require('@aws-sdk/client-cloudwatch-logs');
const options={region:'us-east-1',credentials:fromIni({profile:'socrastica'})};
function docker(args,input) {
  const output=spawnSync('docker',args,{input,encoding:'utf8',stdio:input?['pipe','pipe','pipe']:'inherit'});
  if(output.status!==0) throw new Error('Docker operation failed');
}
async function main() {
  const account='954633149655';
  const identity=await new STSClient(options).send(new GetCallerIdentityCommand({}));
  if(identity.Account!==account) throw new Error('WRONG_AWS_ACCOUNT');
  console.log('Verified target account. Provisioning execution resources only.');
  const ec2=new EC2Client(options), ecr=new ECRClient(options), ecs=new ECSClient(options), s3=new S3Client(options), logs=new CloudWatchLogsClient(options);
  const vpcs=await ec2.send(new DescribeVpcsCommand({Filters:[{Name:'is-default',Values:['true']}]}));
  const vpc=vpcs.Vpcs?.[0]?.VpcId; if(!vpc) throw new Error('No default VPC');
  const subnets=await ec2.send(new DescribeSubnetsCommand({Filters:[{Name:'vpc-id',Values:[vpc]},{Name:'default-for-az',Values:['true']}]}));
  const subnet=subnets.Subnets?.[0]?.SubnetId; if(!subnet) throw new Error('No default subnet');
  const routes=await ec2.send(new DescribeRouteTablesCommand({Filters:[{Name:'vpc-id',Values:[vpc]}]}));
  const table=routes.RouteTables?.find(t=>t.Associations?.some(a=>a.SubnetId===subnet))||routes.RouteTables?.find(t=>t.Associations?.some(a=>a.Main));
  if(!table?.Routes?.some(r=>r.DestinationCidrBlock==='0.0.0.0/0'&&r.GatewayId?.startsWith('igw-'))) throw new Error('Subnet has no internet gateway route');
  let groups=await ec2.send(new DescribeSecurityGroupsCommand({Filters:[{Name:'vpc-id',Values:[vpc]},{Name:'group-name',Values:['socrastica-runner']}]}));
  let group=groups.SecurityGroups?.[0];
  if(!group) {
    const created=await ec2.send(new CreateSecurityGroupCommand({GroupName:'socrastica-runner',Description:'Socrastica runner: no inbound traffic, HTTPS egress only',VpcId:vpc}));
    groups=await ec2.send(new DescribeSecurityGroupsCommand({GroupIds:[created.GroupId]})); group=groups.SecurityGroups[0];
    if(group.IpPermissionsEgress?.length) await ec2.send(new RevokeSecurityGroupEgressCommand({GroupId:group.GroupId,IpPermissions:group.IpPermissionsEgress}));
    await ec2.send(new AuthorizeSecurityGroupEgressCommand({GroupId:group.GroupId,IpPermissions:[{IpProtocol:'tcp',FromPort:443,ToPort:443,IpRanges:[{CidrIp:'0.0.0.0/0'}]}]}));
  }
  group=(await ec2.send(new DescribeSecurityGroupsCommand({GroupIds:[group.GroupId]}))).SecurityGroups[0];
  if(group.IpPermissions?.length) throw new Error('Runner group unexpectedly permits inbound traffic');
  const egress=group.IpPermissionsEgress;
  if(egress?.length!==1||egress[0].IpProtocol!=='tcp'||egress[0].FromPort!==443||egress[0].ToPort!==443||egress[0].IpRanges?.length!==1||egress[0].IpRanges[0].CidrIp!=='0.0.0.0/0'||egress[0].Ipv6Ranges?.length||egress[0].UserIdGroupPairs?.length||egress[0].PrefixListIds?.length) throw new Error('Runner group has unexpected egress rules');
  const bucket=`socrastica-${account}-execution`;
  try {await s3.send(new HeadBucketCommand({Bucket:bucket,ExpectedBucketOwner:account}));} catch(e) {if(e.$metadata?.httpStatusCode!==404)throw e;await s3.send(new CreateBucketCommand({Bucket:bucket}));}
  await s3.send(new PutPublicAccessBlockCommand({Bucket:bucket,PublicAccessBlockConfiguration:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true}}));
  await s3.send(new PutBucketEncryptionCommand({Bucket:bucket,ServerSideEncryptionConfiguration:{Rules:[{ApplyServerSideEncryptionByDefault:{SSEAlgorithm:'AES256'}}]}}));
  await s3.send(new PutBucketLifecycleConfigurationCommand({Bucket:bucket,LifecycleConfiguration:{Rules:[{ID:'short-lived-execution-files',Status:'Enabled',Filter:{Prefix:''},Expiration:{Days:1},AbortIncompleteMultipartUpload:{DaysAfterInitiation:1}}]}}));
  console.log('Private result storage and runner networking configured.');
  const repoName='socrastica-runner'; let repo;
  try {repo=(await ecr.send(new DescribeRepositoriesCommand({repositoryNames:[repoName]}))).repositories[0];} catch(e) {if(e.name!=='RepositoryNotFoundException')throw e;repo=(await ecr.send(new CreateRepositoryCommand({repositoryName:repoName,imageTagMutability:'IMMUTABLE',imageScanningConfiguration:{scanOnPush:true}}))).repository;}
  const auth=(await ecr.send(new GetAuthorizationTokenCommand({}))).authorizationData[0];
  const decoded=Buffer.from(auth.authorizationToken,'base64').toString();
  docker(['login','--username','AWS','--password-stdin',auth.proxyEndpoint],decoded.slice(decoded.indexOf(':')+1));
  const tag=`build-${Date.now()}`, image=`${repo.repositoryUri}:${tag}`;
  docker(['tag','socrastica-runner:testing',image]); docker(['push',image]);
  const digest=(await ecr.send(new DescribeImagesCommand({repositoryName:repoName,imageIds:[{imageTag:tag}]}))).imageDetails[0].imageDigest;
  const cluster=(await ecs.send(new CreateClusterCommand({clusterName:'socrastica-learning',settings:[{name:'containerInsights',value:'disabled'}]}))).cluster.clusterArn;
  const logGroup='/socrastica/runner';
  try {await logs.send(new CreateLogGroupCommand({logGroupName:logGroup}));} catch(e) {if(e.name!=='ResourceAlreadyExistsException')throw e;}
  await logs.send(new PutRetentionPolicyCommand({logGroupName:logGroup,retentionInDays:3}));
  const definition=(await ecs.send(new RegisterTaskDefinitionCommand({family:'socrastica-runner',requiresCompatibilities:['FARGATE'],networkMode:'awsvpc',cpu:'512',memory:'1024',runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},executionRoleArn:`arn:aws:iam::${account}:role/socrastica-task-execution`,containerDefinitions:[{name:'runner',image:`${repo.repositoryUri}@${digest}`,essential:true,user:'1000:1000',readonlyRootFilesystem:true,stopTimeout:5,linuxParameters:{initProcessEnabled:true,capabilities:{drop:['ALL']}},logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':logGroup,'awslogs-region':'us-east-1','awslogs-stream-prefix':'execution','mode':'non-blocking','max-buffer-size':'1m'}}}]}))).taskDefinition.taskDefinitionArn;
  const env={AWS_PROFILE:'socrastica',AWS_REGION:'us-east-1',AWS_EXECUTION_BUCKET:bucket,AWS_ECS_CLUSTER:cluster,AWS_RUNNER_TASK_DEFINITION:definition,AWS_RUNNER_SUBNET:subnet,AWS_RUNNER_SECURITY_GROUP:group.GroupId};
  let local=fs.readFileSync('.env.local','utf8');
  for(const [key,value] of Object.entries(env)) {const regex=new RegExp(`^${key}=.*$`,'m'); local=regex.test(local)?local.replace(regex,`${key}=${value}`):`${local.trimEnd()}\n${key}=${value}\n`;}
  fs.writeFileSync('.env.local',local);
  fs.writeFileSync('infra/aws/execution-resources.json',JSON.stringify({...env,imageDigest:digest},null,2)+'\n');
  console.log('Execution task registered; local environment updated. No always-running service created.');
}
main().catch(error=>{console.error('Provisioning failed:',error.name, error.message?.includes('Docker')?'Docker operation failed':error.$metadata?.httpStatusCode||'see AWS permissions/configuration');process.exitCode=1;});
