import { readFile } from 'node:fs/promises';
import { createCloudStore } from '../../server/cloud-store.mjs';
import { renderPage } from '../../server/seo.mjs';
const template=readFile('index.html','utf8').catch(()=>readFile(new URL('../../index.html',import.meta.url),'utf8'));
export default async request=>{
  try{
    const url=new URL(request.url);
    const needsContent=/^\/(articles|projects)\/[^/]+\/?$/.test(url.pathname);
    const result=await renderPage(await template,url,needsContent?createCloudStore():null,process.env);
    return new Response(result.html,{status:result.status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }catch{return new Response(await template,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'60'}});}
};
export const config={path:['/articles','/articles/*','/projects','/projects/*','/about','/archive','/authors/*','/search','/login','/register','/account','/messages','/messages/*','/notifications','/admin','/write/*']};
