const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {fromIni}=require('@aws-sdk/credential-providers');
const {STSClient,GetCallerIdentityCommand}=require('@aws-sdk/client-sts');
const {EC2Client,DescribeInstancesCommand,DescribeVpcsCommand,DescribeSubnetsCommand,DescribeRouteTablesCommand,DescribeImagesCommand,DescribeSecurityGroupsCommand,CreateSecurityGroupCommand,AuthorizeSecurityGroupIngressCommand,DescribeKeyPairsCommand,ImportKeyPairCommand,RunInstancesCommand,DescribeAddressesCommand,AllocateAddressCommand,AssociateAddressCommand}=require('@aws-sdk/client-ec2');
const options={region:'us-east-1',credentials:fromIni({profile:'socrastica'})};
const account='954633149655', name='socrastica-web';
const tags=[{Key:'Name',Value:name},{Key:'Project',Value:'Socrastica'}];
const inventory='infra/aws/hosting-resources.json';
async function main(){
 const identity=await new STSClient(options).send(new GetCallerIdentityCommand({}));
 if(identity.Account!==account)throw new Error('WRONG_AWS_ACCOUNT');
 // The web host needs no AWS role: code checks run in-process and nothing calls AWS at runtime.
 const ec2=new EC2Client(options);
 const ip=(await(await fetch('https://api.ipify.org')).text()).trim();
 if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))throw new Error('Invalid operator IP');
 const vpc=(await ec2.send(new DescribeVpcsCommand({Filters:[{Name:'is-default',Values:['true']}]}))).Vpcs[0]?.VpcId;
 if(!vpc)throw new Error('Default VPC required');
 const subnets=(await ec2.send(new DescribeSubnetsCommand({Filters:[{Name:'vpc-id',Values:[vpc]},{Name:'default-for-az',Values:['true']}]}))).Subnets;
 const subnet=subnets.find(s=>s.AvailabilityZone==='us-east-1a')||subnets[0];
 const routes=(await ec2.send(new DescribeRouteTablesCommand({Filters:[{Name:'vpc-id',Values:[vpc]}]}))).RouteTables;
 const table=routes.find(r=>r.Associations?.some(a=>a.SubnetId===subnet.SubnetId))||routes.find(r=>r.Associations?.some(a=>a.Main));
 if(!table?.Routes?.some(r=>r.DestinationCidrBlock==='0.0.0.0/0'&&r.GatewayId?.startsWith('igw-')))throw new Error('No public route');
 let group=(await ec2.send(new DescribeSecurityGroupsCommand({Filters:[{Name:'group-name',Values:[name]},{Name:'vpc-id',Values:[vpc]}]}))).SecurityGroups[0];
 if(!group){
  const created=await ec2.send(new CreateSecurityGroupCommand({GroupName:name,VpcId:vpc,Description:'Socrastica web: HTTP/HTTPS public; SSH operator only',TagSpecifications:[{ResourceType:'security-group',Tags:tags}]}));
  await ec2.send(new AuthorizeSecurityGroupIngressCommand({GroupId:created.GroupId,IpPermissions:[{IpProtocol:'tcp',FromPort:80,ToPort:80,IpRanges:[{CidrIp:'0.0.0.0/0'}]},{IpProtocol:'tcp',FromPort:443,ToPort:443,IpRanges:[{CidrIp:'0.0.0.0/0'}]},{IpProtocol:'tcp',FromPort:22,ToPort:22,IpRanges:[{CidrIp:`${ip}/32`,Description:'Deployment operator'}]}]}));
  group=(await ec2.send(new DescribeSecurityGroupsCommand({GroupIds:[created.GroupId]}))).SecurityGroups[0];
 }
 if(group.IpPermissions.some(rule=>rule.FromPort===22&&rule.IpRanges?.some(range=>range.CidrIp==='0.0.0.0/0')))throw new Error('SSH must not be public');
 const keyPath=path.resolve('infra/aws/private/socrastica-web');fs.mkdirSync(path.dirname(keyPath),{recursive:true});
 const pairs=(await ec2.send(new DescribeKeyPairsCommand({Filters:[{Name:'key-name',Values:[name]}]}))).KeyPairs;
 if(!fs.existsSync(keyPath)){
  if(pairs.length)throw new Error('AWS SSH key exists but local private key is missing');
  const result=spawnSync('ssh-keygen',['-t','ed25519','-f',keyPath,'-N','','-C','socrastica-web-deployment'],{encoding:'utf8'});
  if(result.status!==0)throw new Error('SSH key generation failed');
 }
 if(process.platform==='win32'){
  const result=spawnSync('icacls',[keyPath,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(F)`],{encoding:'utf8'});
  if(result.status!==0)throw new Error('Private SSH key ACL failed');
 }else fs.chmodSync(keyPath,0o600);
 if(!pairs.length)await ec2.send(new ImportKeyPairCommand({KeyName:name,PublicKeyMaterial:Buffer.from(fs.readFileSync(keyPath+'.pub','utf8')),TagSpecifications:[{ResourceType:'key-pair',Tags:tags}]}));
 const images=(await ec2.send(new DescribeImagesCommand({Owners:['099720109477'],Filters:[{Name:'name',Values:['ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*']},{Name:'state',Values:['available']}]}))).Images.sort((a,b)=>b.CreationDate.localeCompare(a.CreationDate));
 const existing=(await ec2.send(new DescribeInstancesCommand({Filters:[{Name:'tag:Name',Values:[name]},{Name:'instance-state-name',Values:['pending','running','stopping','stopped']}]}))).Reservations.flatMap(r=>r.Instances);
 if(existing.length>1)throw new Error('Multiple web instances found');
 let host=existing[0];
 if(!host)host=(await ec2.send(new RunInstancesCommand({ImageId:images[0].ImageId,InstanceType:'t3.small',MinCount:1,MaxCount:1,KeyName:name,ClientToken:'socrastica-web-initial-20261002',NetworkInterfaces:[{DeviceIndex:0,SubnetId:subnet.SubnetId,Groups:[group.GroupId],AssociatePublicIpAddress:true}],BlockDeviceMappings:[{DeviceName:'/dev/sda1',Ebs:{VolumeSize:20,VolumeType:'gp3',Encrypted:true,DeleteOnTermination:true}}],CreditSpecification:{CpuCredits:'standard'},MetadataOptions:{HttpTokens:'required',HttpEndpoint:'enabled',HttpPutResponseHopLimit:1},Monitoring:{Enabled:false},UserData:Buffer.from(fs.readFileSync('infra/aws/bootstrap-web.sh','utf8').replaceAll('\r\n','\n')).toString('base64'),TagSpecifications:[{ResourceType:'instance',Tags:tags},{ResourceType:'volume',Tags:tags}]}))).Instances[0];
 if(host.InstanceType!=='t3.small')throw new Error('Unexpected existing instance type');
 let address=(await ec2.send(new DescribeAddressesCommand({Filters:[{Name:'tag:Name',Values:[name]}]}))).Addresses[0];
 if(!address)address=await ec2.send(new AllocateAddressCommand({Domain:'vpc',TagSpecifications:[{ResourceType:'elastic-ip',Tags:tags}]}));
 const saved={account,region:'us-east-1',instanceId:host.InstanceId,instanceType:'t3.small',allocationId:address.AllocationId,publicIp:address.PublicIp,securityGroupId:group.GroupId,sshAllowedIp:ip,sshKeyPath:'infra/aws/private/socrastica-web',domain:'socrastica.com',repository:'https://github.com/ndemafiawilsmith/socrastica-v2.git'};
 fs.writeFileSync(inventory,JSON.stringify(saved,null,2)+'\n');
 try{await ec2.send(new AssociateAddressCommand({AllocationId:address.AllocationId,InstanceId:host.InstanceId}));}catch(error){if(host.State.Name!=='pending')throw error;console.log('Instance pending; rerun to associate reserved IP.');}
 console.log(JSON.stringify(saved,null,2));
}
main().catch(error=>{console.error('Web provisioning failed:',error.name,error.message);process.exitCode=1;});
