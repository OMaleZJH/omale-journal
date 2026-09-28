import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, digest, token, fail, text, safeURL, publicUser, checkEmail } from './security.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const newest=items=>items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const passwordCheck=value=>text(value,'密码',128,10);
const emailCheck=value=>{const email=text(value,'邮箱',160,5).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'请输入有效的邮箱。');checkEmail(email);return email;};
function coverCheck(value){if(value===undefined||value===null||value==='')return '';const cover=text(value,'封面',600000);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(cover))fail(400,'封面仅支持 PNG、JPEG、WebP 图片。');const bytes=Buffer.from(cover.split(',')[1],'base64');if(!(bytes.subarray(0,4).equals(Buffer.from([137,80,78,71]))||bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')))fail(400,'封面图片内容无效。');return cover;}
async function downloadAvatar(src){try{const res=await fetch(src,{signal:AbortSignal.timeout(10000)});if(!res.ok)return '';const type=res.headers.get('content-type')||'';if(!type.startsWith('image/'))return '';const buffer=Buffer.from(await res.arrayBuffer());if(buffer.length>300000)return '';const ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpeg';return `data:image/${ext};base64,${buffer.toString('base64')}`;}catch{return '';}}
export function createAPI(store,env=process.env) {
  return async function api(request,{ip='local',secure=new URL(request.url).protocol==='https:'}={}) {
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=request.method;
    const cookieName=secure?'__Host-omale_session':'omale_session';
    const cookie=(value,max=1209600)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}${secure?'; Secure':''}`;
    try {
      if(!['GET','POST','PATCH','DELETE'].includes(method))return json({error:'不支持的请求方法'},405,{Allow:'GET, POST, PATCH, DELETE'});
      if(method!=='GET') {
        const origin=request.headers.get('origin');
        if(origin&&origin!==url.origin)fail(403,'请求来源不匹配。');
        if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'不允许跨站请求。');
        if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'请发送 JSON 数据。');
        if(!await store.rate(`write:${digest(ip)}`,90,60))fail(429,'操作太频繁，请稍后重试。');
      }
      let body={};
      if(method!=='GET') {const raw=await request.text();if(raw.length>240000)fail(413,'提交的内容过大。');try{body=JSON.parse(raw||'{}');}catch{fail(400,'提交的数据格式有误。');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'提交的数据格式有误。');}
      const rawToken=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      const session=rawToken?await store.get('sessions',digest(rawToken)):null;
      const user=session&&session.expires>Date.now()?await store.get('users',session.userId):null;
      const requireUser=()=>{if(!user)fail(401,'请先登录，游客只能浏览公开内容。');return user;};
      const ownerOnly=()=>{requireUser();if(user.role!=='owner')fail(403,'只有 Omale 可以发布和管理文章。');};
      const author=async item=>({...item,author:publicUser(await store.get('users',item.authorId))});
      const canReadProject=item=>item&&(item.status==='published'||item.authorId===user?.id||user?.role==='owner');
      async function login(account){const secret=token();await store.put('sessions',digest(secret),{id:digest(secret),userId:account.id,expires:Date.now()+1209600000});return json({user:{...publicUser(account),email:account.email}},200,{'Set-Cookie':cookie(secret)});}
      if(path[0]==='session'&&method==='GET')return json({user:user?{...publicUser(user),email:user.email}:null});
      if(path[0]==='auth') {
        if(path[1]==='github') {
          const client=env.GITHUB_CLIENT_ID,secret=env.GITHUB_CLIENT_SECRET;
          const origin=`${url.protocol}//${url.host}`;
          const toLogin=(message,ok=false)=>new Response(`<!doctype html><meta charset="utf-8"><title>Omale · GitHub 登录</title><meta http-equiv="refresh" content="1.2;url=${ok?'/account':'/login'}"><body style="background:#090e0c;color:#eef3ed;font:14px system-ui;display:grid;place-items:center;height:100svh"><div style="text-align:center"><p style="color:${ok?'#bcf8cf':'#efb5a7'}">${message}</p><p><a href="${ok?'/account':'/login'}" style="color:#bcf8cf">${ok?'正在进入你的空间':'返回登录页'} ↗</a></p></div></body>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
          if(path[2]==='start') {
            if(!client||!secret)fail(503,'GitHub 登录尚未配置，请先在服务端设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET。');
            const state=token();
            await store.put('oauth',`gh:${digest(state)}`,{id:`gh:${digest(state)}`,expires:Date.now()+600000});
            const redirect=new URL('https://github.com/login/oauth/authorize');
            redirect.searchParams.set('client_id',client);
            redirect.searchParams.set('redirect_uri',`${origin}/api/auth/github/callback`);
            redirect.searchParams.set('scope','read:user user:email');
            redirect.searchParams.set('state',state);
            return Response.redirect(redirect.href,302);
          }
          if(path[2]==='callback'&&method==='GET') {
            const code=url.searchParams.get('code'),stateToken=url.searchParams.get('state');
            if(!code||!stateToken)return toLogin('GitHub 登录缺少授权参数。');
            const stateKey=`gh:${digest(stateToken)}`;
            if(!await store.get('oauth',stateKey))return toLogin('登录状态已过期，请重新发起 GitHub 登录。');
            await store.remove('oauth',stateKey);
            if(!client||!secret)return toLogin('GitHub 登录尚未配置。');
            const tokenRes=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({client_id:client,client_secret:secret,code,redirect_uri:`${origin}/api/auth/github/callback`}),signal:AbortSignal.timeout(10000)});
            const tokenData=await tokenRes.json().catch(()=>null);
            if(!tokenData?.access_token)return toLogin('GitHub 授权失败，请重试。');
            const headers={Authorization:`Bearer ${tokenData.access_token}`,'User-Agent':'omale-journal'};
            const ghUser=await (await fetch('https://api.github.com/user',{headers,signal:AbortSignal.timeout(10000)})).json();
            if(!ghUser?.id)return toLogin('无法读取 GitHub 账号信息。');
            let email=ghUser.email||'';
            if(!email){const emails=await (await fetch('https://api.github.com/user/emails',{headers,signal:AbortSignal.timeout(10000)})).json().catch(()=>[]);email=(Array.isArray(emails)?emails.find(e=>e.primary&&e.verified)||emails.find(e=>e.verified):null)?.email||'';}
            if(!email)return toLogin('GitHub 账号没有已验证的邮箱，无法完成注册；请用邮箱注册，或在 GitHub 设置中验证邮箱后重试。');
            email=email.toLowerCase();
            let account=(await store.list('users',{email}))[0];
            const avatarData=ghUser.avatar_url?await downloadAvatar(ghUser.avatar_url):'';
            if(account) {
              if(avatarData&&!account.avatar)await store.put('users',account.id,{...account,avatar:avatarData});
              return login(account.avatar?account:{...account,avatar:avatarData});
            }
            const name=text((ghUser.name||ghUser.login||'探险者').slice(0,30)||'探险者','昵称',30,2);
            account={id:randomUUID(),email,name,password:await hashPassword(token()),bio:(ghUser.bio||'').slice(0,240),avatar:avatarData,color:'blue',role:'member',createdAt:new Date().toISOString(),github:ghUser.login};
            try{await store.put('users',account.id,account,true);}catch{account={...account,id:`gh-${ghUser.id}`};try{await store.put('users',account.id,account,true);}catch{return toLogin('该邮箱已注册。');}}
            return login(account);
          }
          fail(404,'接口不存在。');
        }
        if(method!=='POST')fail(405,'不支持的请求方法。');
        if(path[1]==='logout'){if(rawToken)await store.remove('sessions',digest(rawToken));return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
        if(!await store.rate(`auth:${digest(ip)}`,20,900))fail(429,'登录尝试过多，请 15 分钟后再试。');
        if(path[1]==='register') {
          const email=emailCheck(body.email),password=passwordCheck(body.password),name=text(body.name,'昵称',30,2);
          if((await store.list('users',{email})).length)fail(409,'该邮箱已注册，请直接登录。');
          const account={id:randomUUID(),email,name,password:await hashPassword(password),bio:'',avatar:'',color:'mint',role:'member',createdAt:new Date().toISOString()};
          try{await store.put('users',account.id,account,true);}catch(error){if(error.status===409||error.code?.includes('SQLITE'))fail(409,'该邮箱已注册。');throw error;}
          return login(account);
        }
        if(path[1]==='login') {
          const email=emailCheck(body.email),password=text(body.password,'密码',128,1);
          const account=(await store.list('users',{email}))[0];
          if(!account){await hashPassword(password);fail(401,'邮箱或密码不正确。');}
          if(!await verifyPassword(password,account.password))fail(401,'邮箱或密码不正确。');
          return login(account);
        }
      }
      if(path[0]==='profile'&&method==='PATCH') {
        requireUser();const updated={...user,name:text(body.name,'昵称',30,2),bio:text(body.bio||'','简介',240),color:['mint','blue','violet','peach'].includes(body.color)?body.color:'mint'};
        if(body.avatar!==undefined){const avatar=text(body.avatar,'头像',180000);if(avatar&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))fail(400,'头像仅支持 PNG、JPEG、WebP 图片。');if(avatar){const bytes=Buffer.from(avatar.split(',')[1],'base64');if(!(bytes.subarray(0,4).equals(Buffer.from([137,80,78,71]))||bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')))fail(400,'图片内容无效。');}updated.avatar=avatar;}
        await store.put('users',user.id,updated);return json({user:{...publicUser(updated),email:updated.email}});
      }
      if(path[0]==='password'&&method==='PATCH') {requireUser();if(!await verifyPassword(text(body.current,'原密码',128,1),user.password))fail(400,'原密码不正确。');const password=await hashPassword(passwordCheck(body.password));await store.put('users',user.id,{...user,password});for(const s of await store.list('sessions',{userId:user.id}))await store.remove('sessions',s.id);return login({...user,password});}
      if(path[0]==='profiles'&&path[1]&&method==='GET'){const profile=await store.get('users',path[1]);if(!profile)fail(404,'作者不存在。');const projects=newest(await store.list('projects',{authorId:profile.id})).filter(canReadProject);return json({profile:publicUser(profile),projects});}
      if(path[0]==='posts') {
        if(method==='GET'){if(path[1]){const post=await store.get('posts',path[1]);if(!post)fail(404,'文章不存在。');return json(await author(post));}return json(await Promise.all(newest(await store.list('posts')).map(author)));}
        ownerOnly();
        if(method==='DELETE'){if(!path[1])fail(400,'缺少文章标识。');await store.remove('posts',path[1]);return json({ok:true});}
        if(!['POST','PATCH'].includes(method))fail(405,'不支持的请求方法。');
        const old=path[1]?await store.get('posts',path[1]):null;if(path[1]&&!old)fail(404,'文章不存在。');
        const post={id:old?.id||randomUUID(),title:text(body.title,'标题',100,2),summary:text(body.summary,'摘要',240,5),content:text(body.content,'正文',50000,10),category:['ai','code','systems'].includes(body.category)?body.category:'code',tags:Array.isArray(body.tags)?body.tags.slice(0,5).map(tag=>text(tag,'标签',20,1)):[],art:['ai','terminal','universe'].includes(body.art)?body.art:'universe',cover:body.cover===undefined?old?.cover||'':coverCheck(body.cover),authorId:user.id,sample:false,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
        await store.put('posts',post.id,post);return json(await author(post),old?200:201);
      }
      if(path[0]==='projects') {
        if(method==='GET'){if(path[1]){const project=await store.get('projects',path[1]);if(!canReadProject(project))fail(404,'作品不存在或尚未公开。');return json(await author(project));}const mine=url.searchParams.get('mine')==='1';if(mine)requireUser();const projects=await store.list('projects',mine?{authorId:user.id}:{status:'published'});return json(await Promise.all(newest(projects).map(author)));}
        requireUser();
        const old=path[1]?await store.get('projects',path[1]):null;
        if(path[1]&&!old)fail(404,'作品不存在。');
        if(path[2]==='clone'&&method==='POST'){if(!canReadProject(old))fail(404,'作品不存在。');if(old.license==='All rights reserved')fail(403,'作者未开放克隆授权。');const copy={...old,id:randomUUID(),title:`${old.title.slice(0,80)} · 我的分支`,authorId:user.id,status:'draft',sample:false,clonedFrom:old.id,cover:old.cover||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await store.put('projects',copy.id,copy);return json(copy,201);}
        if(old&&old.authorId!==user.id&&user.role!=='owner')fail(403,'只能修改自己的作品。');
        if(method==='DELETE'){if(!old)fail(404,'作品不存在。');await store.remove('projects',old.id);return json({ok:true});}
        if(!['POST','PATCH'].includes(method))fail(405,'不支持的请求方法。');
        const project={id:old?.id||randomUUID(),title:text(body.title,'作品名称',100,2),summary:text(body.summary,'简介',240,5),content:text(body.content,'项目介绍',30000,10),category:['ai','web','systems','creative'].includes(body.category)?body.category:'web',tags:Array.isArray(body.tags)?body.tags.slice(0,5).map(tag=>text(tag,'标签',20,1)):[],repo:safeURL(body.repo,'源码地址'),demo:safeURL(body.demo,'演示地址',{internal:true}),license:['MIT','Apache-2.0','GPL-3.0','All rights reserved'].includes(body.license)?body.license:'All rights reserved',art:['ai','terminal','universe'].includes(body.art)?body.art:'universe',cover:body.cover===undefined?old?.cover||'':coverCheck(body.cover),authorId:old?.authorId||user.id,status:body.status==='draft'?'draft':'published',sample:false,clonedFrom:old?.clonedFrom||null,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
        await store.put('projects',project.id,project);return json(await author(project),old?200:201);
      }
      if(path[0]==='comments') {
        if(method==='DELETE'){requireUser();const comment=await store.get('comments',path[1]);if(!comment)fail(404,'评论不存在。');if(comment.authorId!==user.id&&user.role!=='owner')fail(403,'只能删除自己的评论。');await store.remove('comments',comment.id);return json({ok:true});}
        const kind=method==='GET'?url.searchParams.get('kind'):body.kind,id=method==='GET'?url.searchParams.get('id'):body.targetId;
        if(!['posts','projects'].includes(kind)||typeof id!=='string')fail(400,'评论目标无效。');
        const target=await store.get(kind,id);if(!target||(kind==='projects'&&!canReadProject(target)))fail(404,'内容不存在。');
        if(method==='GET')return json(await Promise.all((await store.list('comments',{kind,targetId:id})).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(author)));
        if(method==='POST'){requireUser();const comment={id:randomUUID(),kind,targetId:id,authorId:user.id,content:text(body.content,'评论',2000,1),createdAt:new Date().toISOString()};await store.put('comments',comment.id,comment);return json(await author(comment),201);}
      }
      if(path[0]==='conversations'&&method==='GET') {
        requireUser();const messages=[...await store.list('messages',{senderId:user.id}),...await store.list('messages',{recipientId:user.id})];const groups=new Map();
        for(const message of newest(messages)){const peer=message.senderId===user.id?message.recipientId:message.senderId;if(!groups.has(peer))groups.set(peer,{peer:publicUser(await store.get('users',peer)),last:message,unread:0,read:(await store.get('reads',`${user.id}:${peer}`))?.at||''});const group=groups.get(peer);if(message.recipientId===user.id&&message.createdAt>group.read)group.unread++;}
        return json([...groups.values()].map(({read,...rest})=>rest));
      }
      if(path[0]==='messages'&&path[1]) {
        requireUser();const peer=await store.get('users',path[1]);if(!peer)fail(404,'对方账号不存在。');if(peer.id===user.id)fail(400,'不能向自己发送私信。');
        if(method==='GET'){const sent=await store.list('messages',{senderId:user.id,recipientId:peer.id}),received=await store.list('messages',{senderId:peer.id,recipientId:user.id});const messages=[...sent,...received].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));return json({peer:publicUser(peer),messages});}
        if(method==='POST'&&path[2]==='read'){await store.put('reads',`${user.id}:${peer.id}`,{at:new Date().toISOString()});return json({ok:true});}
        if(method==='POST'){const message={id:randomUUID(),senderId:user.id,recipientId:peer.id,content:text(body.content,'私信',4000,1),createdAt:new Date().toISOString()};await store.put('messages',message.id,message);return json(message,201);}
      }
      fail(404,'接口不存在。');
    } catch(error) {
      const status=error.status||500;
      if(status===500)console.error('API error:',error.code||error.message);
      return json({error:status===500?'服务暂时异常，请稍后重试。':error.message},status);
    }
  };
}
