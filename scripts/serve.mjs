import http from 'node:http';
import { renderPage } from '../server/seo.mjs';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalStore } from '../server/local-store.mjs';
import { createAPI } from '../server/api.mjs';
import { seedDatabase,generateOwnerPassword } from '../server/seed.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const root=process.argv.includes('--dist')?path.join(project,'dist'):project;
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||5173);
const store=createLocalStore(process.env.OMALE_DB||path.join(project,'.local','omale.sqlite'));
await seedDatabase(store,{email:process.env.OWNER_EMAIL||'omale@qq.com',password:process.env.OWNER_PASSWORD||generateOwnerPassword(),onOwnerCreated:async({email,password})=>{if(process.env.OWNER_PASSWORD)return;await mkdir(path.join(project,'.local'),{recursive:true});await writeFile(path.join(project,'.local','owner-login.txt'),`Omale 本地站长账号（仅本地，不要上传到 Git 或 Netlify）\n\n登录邮箱：${email}\n登录密码：${password}\n\n登录后可在「个人空间 → 修改密码」中更换。\n`);console.log('本地站长账号已生成：.local/owner-login.txt');}});
const api=createAPI(store,process.env);
const publicFiles=new Set(['index.html','style.css','app.css','app.js','views.js','client.js','particles.js','favicon.svg','404.html','robots.txt','seo.js','share-card.png']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname.startsWith('/api/')||['/feed.xml','/sitemap.xml'].includes(url.pathname)) {
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>250000){res.writeHead(413);res.end('{"error":"请求过大"}');return;}chunks.push(chunk);}
      const method=req.method;const apiURL=new URL(url);if(!apiURL.pathname.startsWith('/api/'))apiURL.pathname='/api'+apiURL.pathname;const request=new Request(apiURL,{method,headers:req.headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})});
      const response=await api(request,{ip:req.socket.remoteAddress,secure:false});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(url.pathname);const name=pathname.replace(/^\//,'');
    let file;
    if(publicFiles.has(name))file=name;
    else if(pathname==='/'||/^\/(articles|projects|about|login|register|account|messages|authors|write|notifications|search|archive|admin)(\/[^.]*)?\/?$/.test(pathname))file='index.html';
    else{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(path.join(root,'404.html')));return;}
    let body=await readFile(path.join(root,file));let status=200;if(file==='index.html'){const rendered=await renderPage(body.toString('utf8'),url,store,process.env);body=rendered.html;status=rendered.status;}res.writeHead(status,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }catch(error){console.error(error.message);res.writeHead(500);res.end('Server error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Omale is ready at http://localhost:${port}`));
process.on('SIGINT',()=>server.close(()=>{store.close();process.exit(0);}));
