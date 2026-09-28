export function createCloudStore(env=process.env) {
  const origin=env.SUPABASE_URL;
  const secret=env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!origin||!secret)throw Object.assign(new Error('云端数据库尚未配置，请在 Netlify 设置数据库环境变量。'),{status:503});
  async function request(path,options={}) {
    const headers={'apikey':secret,'Content-Type':'application/json',...options.headers};
    if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
    const response=await fetch(`${origin}/rest/v1/${path}`,{...options,headers,signal:AbortSignal.timeout(10000)});
    if(!response.ok) {
      const error=await response.json().catch(()=>({}));
      if(response.status===409)throw Object.assign(new Error('该记录已存在'),{status:409});
      console.error('Database request failed:',response.status,error.code);
      throw Object.assign(new Error('数据库暂时无法访问，请稍后重试。'),{status:503});
    }
    return response.status===204?null:response.json();
  }
  const query=(kind,id)=>new URLSearchParams({kind:`eq.${kind}`,id:`eq.${id}`}).toString();
  return {
    async get(kind,id) {const rows=await request(`omale_records?${query(kind,id)}&select=data`);return rows[0]?.data||null;},
    async list(kind,filters={}) {const params=new URLSearchParams({kind:`eq.${kind}`,select:'data',limit:'2000'});for(const [key,value]of Object.entries(filters))params.set(`data->>${key}`,`eq.${value}`);return (await request(`omale_records?${params}`)).map(row=>row.data);},
    async put(kind,id,data,insert=false) {await request('omale_records',{method:'POST',headers:{Prefer:`${insert?'':'resolution=merge-duplicates,'}return=representation`},body:JSON.stringify({kind,id,data})});return data;},
    async remove(kind,id) {await request(`omale_records?${query(kind,id)}`,{method:'DELETE'});},
    async rate(id,limit,seconds) {return request('rpc/omale_rate_limit',{method:'POST',body:JSON.stringify({rate_key:id,max_count:limit,window_seconds:seconds})});}
  };
}
