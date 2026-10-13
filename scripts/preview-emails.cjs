const http=require('node:http');
const {content,render}=require('./email-templates.cjs');
http.createServer((request,response)=>{
  const type=new URL(request.url,'http://localhost').pathname.slice(1)||'confirmation';
  if(!content[type]) {response.writeHead(404);response.end('Email preview not found');return;}
  const html=render(type).replaceAll('{{ .ConfirmationURL }}','https://socrastica.com/auth/callback?preview=sample').replaceAll('{{ .Email }}','learner@example.com').replaceAll('{{ .Token }}','123456');
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);
}).listen(3010,'127.0.0.1',()=>console.log('Sample email previews available at http://localhost:3010/confirmation (no real auth tokens).'));
