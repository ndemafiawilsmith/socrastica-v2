const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {content,render}=require('./email-templates.cjs');
http.createServer((request,response)=>{
  const type=new URL(request.url,'http://localhost').pathname.slice(1)||'confirmation';
  if(type.startsWith('mermaid-assets/')) {
    const root=path.resolve('node_modules/mermaid/dist');
    const file=path.resolve(root,type.slice('mermaid-assets/'.length));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!file.endsWith('.mjs')){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'Content-Type':'text/javascript'});response.end(fs.readFileSync(file));return;
  }
  if(type==='map') {
    const diagram=fs.readFileSync('emails/preview/sample-map.mmd','utf8');
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    response.end(`<!doctype html><html><head><title>Socrastica map rendering check</title></head><body style="background:#0b0f1c;color:#eeebff;font:16px Arial;padding:24px"><h1>Reasoning map rendering check</h1><p>Sample graph using the same validated Mermaid builder as the studio.</p><main id="map" style="max-width:600px;margin:auto"></main><script type="module">import mermaid from '/mermaid-assets/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'dark',flowchart:{htmlLabels:false}});try{const {svg}=await mermaid.render('sample-map',${JSON.stringify(diagram)});document.getElementById('map').innerHTML=svg;}catch(e){document.getElementById('map').textContent='Render failed';}</script></body></html>`);return;
  }
  if(!content[type]) {response.writeHead(404);response.end('Email preview not found');return;}
  const html=render(type).replaceAll('{{ .ConfirmationURL }}','https://socrastica.com/auth/callback?preview=sample').replaceAll('{{ .Email }}','learner@example.com').replaceAll('{{ .Token }}','123456');
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);
}).listen(3010,'127.0.0.1',()=>console.log('Sample email previews available at http://localhost:3010/confirmation (no real auth tokens).'));
