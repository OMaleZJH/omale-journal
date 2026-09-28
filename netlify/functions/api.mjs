import { createCloudStore } from '../../server/cloud-store.mjs';
import { createAPI } from '../../server/api.mjs';
import { seedDatabase } from '../../server/seed.mjs';
let ready;
async function init(){const store=createCloudStore();await seedDatabase(store,{email:process.env.OWNER_EMAIL,password:process.env.OWNER_PASSWORD});return createAPI(store,process.env);}
export default async (request,context)=>{
  try{ready??=init().catch(error=>{ready=null;throw error;});return (await ready)(request,{ip:context.ip||'unknown',secure:true});}
  catch(error){return Response.json({error:error.status===503?error.message:'云端服务初始化失败，请检查部署配置。'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
export const config={path:['/api/*','/feed.xml','/sitemap.xml']};
