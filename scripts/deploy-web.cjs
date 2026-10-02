const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
require('@next/env').loadEnvConfig(process.cwd());
const config=JSON.parse(fs.readFileSync('infra/aws/hosting-resources.json','utf8'));
if(config.account!=='954633149655'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(config.publicIp))throw new Error('Invalid host inventory');
const args=['-i',path.resolve(config.sshKeyPath),'-o','BatchMode=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=accept-new','-o',`UserKnownHostsFile=${path.resolve('infra/aws/private/known_hosts')}`,`ubuntu@${config.publicIp}`];
function ssh(command,input){
 const result=spawnSync('ssh',[...args,command],{input,stdio:input?['pipe','inherit','inherit']:'inherit'});
 if(result.status!==0)throw new Error('Remote deployment command failed');
}
if(process.argv.includes('--status')){ssh('sudo test -f /var/lib/socrastica-bootstrap-ready && node --version && sudo systemctl is-active socrastica caddy');process.exit(0);}
if(process.argv.includes('--update')){ssh('sudo /usr/local/bin/socrastica-deploy');process.exit(0);}
ssh('sudo test -f /var/lib/socrastica-bootstrap-ready');
const required=['OPENAI_API_KEY','OPENAI_MODEL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','AWS_REGION','AWS_EXECUTION_BUCKET','AWS_ECS_CLUSTER','AWS_RUNNER_TASK_DEFINITION','AWS_RUNNER_SUBNET','AWS_RUNNER_SECURITY_GROUP'];
const env={NEXT_PUBLIC_APP_URL:'https://socrastica.com'};
for(const name of required){
 const value=process.env[name];
 if(!value||/[\r\n]/.test(value))throw new Error('Missing or invalid runtime variable: '+name);
 env[name]=value;
}
// Send only application variables through SSH stdin. No SMTP/Resend, management
// tokens, local AWS profiles, or developer credentials belong on this host.
ssh("sudo bash -c 'umask 0077; cat > /etc/socrastica/app.env; chown root:socrastica /etc/socrastica/app.env; chmod 640 /etc/socrastica/app.env'",Object.entries(env).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n');
for(const [source,destination,mode] of [['infra/aws/socrastica.service','/etc/systemd/system/socrastica.service','644'],['infra/aws/deploy-web.sh','/usr/local/bin/socrastica-deploy','755']]){
 ssh(`sudo install -m ${mode} /dev/stdin ${destination}`,fs.readFileSync(source,'utf8').replaceAll('\r\n','\n'));
}
const caddy=`{
  admin localhost:2019
}
http://${config.publicIp} {
  reverse_proxy 127.0.0.1:3000
}
socrastica.com {
  encode zstd gzip
  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    X-Socrastica-Host socrastica-web
    Strict-Transport-Security "max-age=31536000"
    -Server
  }
  reverse_proxy 127.0.0.1:3000
}
www.socrastica.com {
  redir https://socrastica.com{uri} permanent
}
`;
ssh('sudo install -m 644 /dev/stdin /etc/caddy/Caddyfile',caddy);
ssh('sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl daemon-reload && sudo systemctl enable socrastica caddy && sudo systemctl reload caddy');
if(!process.argv.includes('--configure-only'))ssh('sudo /usr/local/bin/socrastica-deploy');
console.log('GitHub main deployed. HTTPS certificates will activate when domain DNS points to this server.');
