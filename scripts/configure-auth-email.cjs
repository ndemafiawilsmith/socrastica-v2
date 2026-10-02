const {content,render,writeTemplates}=require('./email-templates.cjs');
require('@next/env').loadEnvConfig(process.cwd());
async function main() {
  writeTemplates();
  const token=process.env.SUPABASE_ACCESS_TOKEN;
  const host=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  if(!token||!/^[a-z0-9-]+\.supabase\.co$/.test(host))throw new Error('Missing management configuration');
  const url=`https://api.supabase.com/v1/projects/${host.split('.')[0]}/config/auth`;
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const patch={};
  for(const [type,c] of Object.entries(content)) {patch[`mailer_subjects_${type}`]=c.subject;patch[`mailer_templates_${type}_content`]=render(type);}
  const templatesOnly=process.argv.includes('--templates-only');
  if(!templatesOnly) {
    const key=process.env.RESEND_API_KEY||process.env.resend_API_KEY;
    const sender=process.env.SMTP_FROM||process.env.EMAIL_FROM;
    if(!key||!sender||!/^[-\w.+]+@[-\w.]+\.[a-z]{2,}$/i.test(sender))throw new Error('Set active RESEND_API_KEY and verified SMTP_FROM locally');
    const domains=await fetch('https://api.resend.com/domains',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
    const list=await domains.json();
    const senderDomain=sender.split('@')[1].toLowerCase();
    if(domains.ok) {
      if(!list.data?.some(d=>d.status==='verified'&&d.name.toLowerCase()===senderDomain))throw new Error('SMTP_FROM domain is not verified in Resend');
    } else if(list.name!=='restricted_api_key')throw new Error(`Resend credential check failed: HTTP ${domains.status}`);
    else console.log('Sending-only key: domain status requires verification in the Resend dashboard.');
    const transport=require('nodemailer').createTransport({host:'smtp.resend.com',port:465,secure:true,auth:{user:'resend',pass:key},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
    try {await transport.verify();} catch {throw new Error('Resend SMTP authentication/connectivity check failed');} finally {transport.close();}
    console.log('Resend SMTP authentication verified; no email sent.');
    const smtpPatch={smtp_host:'smtp.resend.com',smtp_port:'465',smtp_user:'resend',smtp_pass:key,smtp_admin_email:sender,smtp_sender_name:'Socrastica'};
    const smtpResult=await fetch(url,{method:'PATCH',headers,body:JSON.stringify(smtpPatch),signal:AbortSignal.timeout(20000)});
    if(!smtpResult.ok)throw new Error(`SMTP configuration failed: HTTP ${smtpResult.status}`);
  }
  const result=await fetch(url,{method:'PATCH',headers,body:JSON.stringify(patch),signal:AbortSignal.timeout(20000)});
  if(!result.ok)throw new Error(`Auth email configuration failed: HTTP ${result.status}`);
  const verify=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
  if(!verify.ok)throw new Error('Unable to verify saved auth email configuration');
  const saved=await verify.json();
  for(const type of Object.keys(content))if(saved[`mailer_templates_${type}_content`]!==render(type))throw new Error('Template verification failed');
  if(!templatesOnly&&(saved.smtp_host!=='smtp.resend.com'||saved.smtp_admin_email!==(process.env.SMTP_FROM||process.env.EMAIL_FROM)))throw new Error('SMTP verification failed');
  console.log(templatesOnly?'Six branded auth templates published and verified. Existing email transport preserved.':'Resend SMTP and six branded auth templates configured and verified.');
  console.log('No test email sent. Trigger signup/password recovery to test actual delivery.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
