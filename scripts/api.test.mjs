import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../server/local-store.mjs';
import { createAPI } from '../server/api.mjs';
import { seedDatabase } from '../server/seed.mjs';
import { markdown } from '../client.js';
import { renderPage } from '../server/seo.mjs';

async function fixture(){
  const store=createLocalStore(':memory:');
  await seedDatabase(store,{email:'owner@qq.com',password:'Owner-test-password-123!'});
  const api=createAPI(store);let counter=0;
  async function call(path,{method='GET',body,cookie='',origin='http://localhost',ip}={}){
    const response=await api(new Request('http://localhost/api/'+path,{method,headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},...(method==='GET'?{}:{body:JSON.stringify(body||{})})}),{ip:ip||`test-${counter++}`,secure:false});
    const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{parsed=text;}
    return {status:response.status,body:parsed,cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
  }
  async function register(email='alice@qq.com',name='Alice'){const result=await call('auth/register',{method:'POST',body:{email,name,password:'Long-test-password-123!',role:'owner',id:'omale'}});assert.equal(result.status,200);return result;}
  return {store,call,register};
}
const project={title:'测试项目',summary:'可以正常发布和保存的项目简介',content:'# 项目介绍\n\n这是一个用于测试权限与持久化的真实条目。',category:'ai',tags:['AI'],repo:'https://github.com/example/project',demo:'',license:'MIT',art:'ai',status:'published'};
const post={title:'站长的测试文章',summary:'只有站长能够发布的文章摘要',content:'# 正文\n\n从服务端验证用户权限，不能依赖隐藏按钮。',category:'code',tags:['测试'],art:'terminal'};

test('游客只读，注册无法提权，站长文章权限和密码哈希',async()=>{
  const {store,call,register}=await fixture();try{
    assert.equal((await call('posts')).status,200);
    assert.equal((await call('projects',{method:'POST',body:project})).status,401);
    assert.equal((await call('messages/omale')).status,401);
    const ownerSeed=await call('auth/login',{method:'POST',body:{email:'owner@qq.com',password:'Owner-test-password-123!'}});
    const seeded=await call('posts',{method:'POST',cookie:ownerSeed.cookie,body:post});assert.equal(seeded.status,201);
    assert.equal((await call('comments',{method:'POST',body:{kind:'posts',targetId:seeded.body.id,content:'评论'}})).status,401);
    const alice=await register();assert.equal(alice.body.user.role,'member');assert.notEqual(alice.body.user.id,'omale');
    assert.match(alice.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
    assert.equal((await call('posts',{method:'POST',cookie:alice.cookie,body:post})).status,403);
    await call('profile',{method:'PATCH',cookie:alice.cookie,body:{name:'Omale',bio:'',role:'owner'}});
    assert.equal((await call('session',{cookie:alice.cookie})).body.user.role,'member');
    const raw=await store.get('users',alice.body.user.id);assert.ok(raw.password.includes(':'));assert.ok(!raw.password.includes('Long-test'));
    const owner=await call('auth/login',{method:'POST',body:{email:'owner@qq.com',password:'Owner-test-password-123!'}});
    const created=await call('posts',{method:'POST',cookie:owner.cookie,body:post});assert.equal(created.status,201);
    assert.equal((await call('posts/'+created.body.id,{method:'DELETE',cookie:alice.cookie})).status,403);
    assert.equal((await call('profiles/'+alice.body.user.id)).body.profile.email,undefined);
    assert.equal((await call('profiles/'+alice.body.user.id)).body.profile.password,undefined);
    assert.equal((await call('auth/register',{method:'POST',body:{email:'ALICE@qq.com',name:'Alice2',password:'Another-password-123'}})).status,409);
    assert.equal((await call('auth/register',{method:'POST',body:{email:'someone@unknown-domain.xyz',name:'Alice3',password:'Another-password-123'}})).status,400);
    for(const domain of ['qq.com','163.com','gmail.com','outlook.com','icloud.com','stu.example.edu.cn'])assert.equal((await call('auth/register',{method:'POST',body:{email:`probe@${domain}`,name:'探针',password:'Another-password-123'}})).status,200,'domain '+domain+' should be allowed');
  }finally{store.close();}
});
test('作品投稿、草稿隔离、克隆来源与作者权限',async()=>{
  const {store,call,register}=await fixture();try{
    const alice=await register(),bob=await register('bob@163.com','Bob');
    const draft=await call('projects',{method:'POST',cookie:alice.cookie,body:{...project,status:'draft'}});assert.equal(draft.status,201);
    assert.equal((await call('projects/'+draft.body.id)).status,404);
    assert.equal((await call('projects/'+draft.body.id,{cookie:bob.cookie})).status,404);
    assert.equal((await call('projects/'+draft.body.id+'/clone',{method:'POST',cookie:bob.cookie})).status,404);
    const published=await call('projects/'+draft.body.id,{method:'PATCH',cookie:alice.cookie,body:project});assert.equal(published.body.status,'published');
    const clone=await call('projects/'+draft.body.id+'/clone',{method:'POST',cookie:bob.cookie});assert.equal(clone.status,201);assert.equal(clone.body.clonedFrom,draft.body.id);assert.equal(clone.body.authorId,bob.body.user.id);assert.equal(clone.body.status,'draft');
    const sampleClone=await call('projects/particle-universe/clone',{method:'POST',cookie:bob.cookie});
    const savedClone=await call('projects/'+sampleClone.body.id,{method:'PATCH',cookie:bob.cookie,body:sampleClone.body});assert.equal(savedClone.status,200);assert.equal(savedClone.body.demo,'/');
    assert.equal((await call('projects/'+draft.body.id,{method:'PATCH',cookie:bob.cookie,body:project})).status,403);
    assert.equal((await call('projects/'+draft.body.id,{method:'DELETE',cookie:bob.cookie})).status,403);
    assert.equal((await call('projects',{method:'POST',cookie:alice.cookie,body:{...project,repo:'javascript:alert(1)'}})).status,400);
    const locked=await call('projects',{method:'POST',cookie:alice.cookie,body:{...project,license:'All rights reserved'}});
    assert.equal((await call('projects/'+locked.body.id+'/clone',{method:'POST',cookie:bob.cookie})).status,403);
    const comment=await call('comments',{method:'POST',cookie:alice.cookie,body:{kind:'projects',targetId:published.body.id,content:'真正持久化的评论'}});assert.equal(comment.status,201);
    assert.equal((await call('comments?kind=projects&id='+published.body.id)).body[0].content,'真正持久化的评论');
    assert.equal((await call('comments/'+comment.body.id,{method:'DELETE',cookie:bob.cookie})).status,403);
    assert.equal((await call('comments/'+comment.body.id,{method:'DELETE',cookie:alice.cookie})).status,200);
  }finally{store.close();}
});
test('私信仅参与者可读，未读回执、第三方隔离和登录失效',async()=>{
  const {store,call,register}=await fixture();try{
    const alice=await register(),bob=await register('bob@163.com','Bob'),charlie=await register('charlie@gmail.com','Charlie');
    const sent=await call('messages/'+bob.body.user.id,{method:'POST',cookie:alice.cookie,body:{content:'只给 Bob 的私密内容',senderId:charlie.body.user.id}});assert.equal(sent.status,201);assert.equal(sent.body.senderId,alice.body.user.id);
    assert.equal((await call('messages/'+alice.body.user.id,{cookie:bob.cookie})).body.messages.length,1);
    assert.equal((await call('messages/'+alice.body.user.id,{cookie:charlie.cookie})).body.messages.length,0);
    assert.equal((await call('conversations',{cookie:charlie.cookie})).body.length,0);
    assert.equal((await call('conversations',{cookie:bob.cookie})).body[0].unread,1);
    await call('messages/'+alice.body.user.id+'/read',{method:'POST',cookie:bob.cookie});
    assert.equal((await call('conversations',{cookie:bob.cookie})).body[0].unread,0);
    assert.equal((await call('messages/'+alice.body.user.id,{method:'POST',cookie:alice.cookie,body:{content:'自言自语'}})).status,400);
    await call('auth/logout',{method:'POST',cookie:alice.cookie});assert.equal((await call('session',{cookie:alice.cookie})).body.user,null);
    assert.equal((await call('messages/'+bob.body.user.id,{cookie:alice.cookie})).status,401);
  }finally{store.close();}
});
test('GitHub OAuth state 一次性校验',async()=>{
  const {store,call}=await fixture();try{
    assert.equal((await call('auth/github/start',{method:'POST'})).status,503);
    const bad=await call('auth/github/callback?code=x&state=bad',{method:'GET'});
    assert.equal(bad.status,200);assert.match(bad.body,typeof bad.body==='string'?/过期|缺少/:/error/);
  }finally{store.close();}
});
test('点赞防重、阅读量、通知、搜索归档和管理员审核',async()=>{
  const {store,call,register}=await fixture();try{
    const owner=await call('auth/login',{method:'POST',body:{email:'owner@qq.com',password:'Owner-test-password-123!'}});
    const created=await call('posts',{method:'POST',cookie:owner.cookie,body:post});assert.equal(created.status,201);
    const alice=await register();
    assert.equal((await call(`likes/posts/${created.body.id}`,{method:'POST'})).status,401,'guests cannot like via API');
    const first=await call(`likes/posts/${created.body.id}`,{method:'POST',cookie:alice.cookie});assert.equal(first.status,200);assert.equal(first.body.count,1);assert.equal(first.body.liked,true);
    const again=await call(`likes/posts/${created.body.id}`,{method:'POST',cookie:alice.cookie});assert.equal(again.body.count,0);assert.equal(again.body.liked,false,'double like toggles off');
    const third=await call(`likes/posts/${created.body.id}`,{method:'POST',cookie:alice.cookie});assert.equal(third.body.count,1);
    const state=await call(`likes/posts/${created.body.id}`,{cookie:alice.cookie});assert.deepEqual(state.body,{count:1,liked:true});
    assert.equal((await call(`likes/posts/${created.body.id}`)).body.count,1,'public can read like count');
    assert.ok((await call(`views/posts/${created.body.id}`,{method:'POST',body:{}})).body.views>=1,'view counting works');
    const notifications=await call('notifications',{cookie:owner.cookie});assert.ok(notifications.body.items.some(n=>n.type==='like'),'owner got a like notification');
    assert.ok((await call('notifications/read-all',{method:'POST',cookie:owner.cookie})).body.ok);
    assert.equal((await call('notifications',{cookie:owner.cookie})).body.unread,0);
    await call('comments',{method:'POST',cookie:alice.cookie,body:{kind:'posts',targetId:created.body.id,content:'测试评论通知'}});
    assert.ok((await call('notifications',{cookie:owner.cookie})).body.items.some(n=>n.type==='comment'),'owner got a comment notification');
    const search=await call('search?q=测试文章');assert.equal(search.status,200);assert.ok(search.body.some(r=>r.type==='posts'));
    assert.equal((await call('search?q=')).status,400);
    const archive=await call('archive');assert.ok(archive.body.months.length>=1);assert.ok(archive.body.months[0].posts[0].title);
    assert.equal((await call('admin/comments',{cookie:alice.cookie})).status,403,'members cannot access admin');
    const adminComments=await call('admin/comments',{cookie:owner.cookie});assert.ok(adminComments.body.length>=1);
    const bob=await register('bob@163.com','Bob');
    const ban=await call(`admin/users/${bob.body.user.id}`,{method:'PATCH',cookie:owner.cookie,body:{banned:true}});assert.equal(ban.body.banned,true);
    assert.equal((await call('profile',{method:'PATCH',cookie:bob.cookie,body:{name:'Bob'}})).status,401,'banned user sessions are revoked immediately');
    assert.equal((await call(`admin/users/${bob.body.user.id}`,{method:'PATCH',cookie:owner.cookie,body:{banned:false}})).status,200);
    assert.equal((await call(`admin/users/${owner.body.user.id}`,{method:'PATCH',cookie:owner.cookie,body:{banned:true}})).status,403,'cannot ban owner');
    const feed=await call('feed.xml');assert.equal(feed.status,200);assert.match(String(feed.body),/<rss version="2.0"/);
    const sitemap=await call('sitemap.xml');assert.equal(sitemap.status,200);assert.match(String(sitemap.body),/<urlset/);
  }finally{store.close();}
});
test('并发统计、编辑保留、克隆清零和阅读去重',async()=>{
  const {store,call,register}=await fixture();try{
    const alice=await register(),bob=await register('bob@163.com','Bob');
    const created=await call('projects',{method:'POST',cookie:alice.cookie,body:project});const id=created.body.id;
    await Promise.all([
      call(`likes/projects/${id}`,{method:'POST',cookie:alice.cookie}),
      call(`likes/projects/${id}`,{method:'POST',cookie:bob.cookie}),
      ...Array.from({length:12},(_,i)=>call(`views/projects/${id}`,{method:'POST',ip:`reader-${i}`}))
    ]);
    let saved=await call(`projects/${id}`);assert.equal(saved.body.likes,2);assert.equal(saved.body.views,12);
    await call(`views/projects/${id}`,{method:'POST',ip:'reader-0'});
    await call(`projects/${id}`,{method:'PATCH',cookie:alice.cookie,body:{...project,title:'更新标题',likes:999,views:999}});
    saved=await call(`projects/${id}`);assert.equal(saved.body.likes,2);assert.equal(saved.body.views,12);
    const clone=await call(`projects/${id}/clone`,{method:'POST',cookie:bob.cookie});assert.equal(clone.body.likes,0);assert.equal(clone.body.views,0);
    assert.equal((await call(`likes/users/${alice.body.user.id}`)).status,400);
    assert.equal((await call(`views/projects/${clone.body.id}`,{method:'POST'})).status,404);
    assert.ok(!(await call('search?q='+encodeURIComponent('我的分支'))).body.some(item=>item.id===clone.body.id));
  }finally{store.close();}
});

test('通知逐条已读与隔离、私信提醒和内容下架',async()=>{
  const {store,call,register}=await fixture();try{
    const owner=await call('auth/login',{method:'POST',body:{email:'owner@qq.com',password:'Owner-test-password-123!'}}),alice=await register(),bob=await register('bob@163.com','Bob');
    await call(`messages/${alice.body.user.id}`,{method:'POST',cookie:bob.cookie,body:{content:'私信正文不应出现在提醒摘要'}});
    const notice=(await call('notifications',{cookie:alice.cookie})).body.items[0];assert.equal(notice.type,'message');assert.ok(!notice.content.includes('正文'));
    assert.equal((await call(`notifications/${encodeURIComponent(notice.id)}/read`,{method:'POST',cookie:bob.cookie})).status,404);
    assert.equal((await call(`notifications/${encodeURIComponent(notice.id)}/read`,{method:'POST',cookie:alice.cookie})).status,200);
    assert.equal((await call('notifications',{cookie:alice.cookie})).body.unread,0);
    const created=await call('projects',{method:'POST',cookie:alice.cookie,body:project});
    assert.equal((await call('admin/content',{cookie:alice.cookie})).status,403);
    assert.ok((await call('admin/content',{cookie:owner.cookie})).body.some(item=>item.id===created.body.id));
    assert.equal((await call(`admin/content/projects/${created.body.id}`,{method:'PATCH',cookie:alice.cookie,body:{status:'draft'}})).status,403);
    await call(`admin/content/projects/${created.body.id}`,{method:'PATCH',cookie:owner.cookie,body:{status:'draft'}});
    assert.equal((await call(`projects/${created.body.id}`)).status,404);
    assert.equal((await call(`projects/${created.body.id}`,{cookie:alice.cookie})).status,200);
  }finally{store.close();}
});

test('服务端分享卡、SEO 转义与草稿不泄露',async()=>{
  const {store,call,register}=await fixture();try{
    const alice=await register();const created=await call('projects',{method:'POST',cookie:alice.cookie,body:{...project,title:'标题 <script> & "分享"'}});
    const template='<html><head><title>旧标题</title><meta property="og:title" content="旧标题"></head><body><div class="initial-loading">等待</div></body></html>';
    const result=await renderPage(template,new URL(`http://localhost/projects/${created.body.id}`),store,{SITE_URL:'https://example.com'});
    assert.equal(result.status,200);assert.match(result.html,/标题 &lt;script&gt; &amp; &quot;分享&quot;/);assert.ok(!result.html.includes('<script>'));assert.ok(result.html.includes(`https://example.com/projects/${created.body.id}`));assert.match(result.html,/summary_large_image/);assert.match(result.html,/https:\/\/example.com\/share-card.png/);
    await call(`projects/${created.body.id}`,{method:'PATCH',cookie:alice.cookie,body:{...project,status:'draft'}});
    const draft=await renderPage(template,new URL(`http://localhost/projects/${created.body.id}`),store);assert.equal(draft.status,404);assert.match(draft.html,/noindex/);assert.ok(!draft.html.includes(project.content));
    const sitemap=await call('sitemap.xml');assert.ok(!sitemap.body.includes(created.body.id));
  }finally{store.close();}
});

test('来源检查、持久限流、安全渲染和修改密码撤销旧会话',async()=>{
  const {store,call,register}=await fixture();try{
    assert.equal((await call('auth/register',{method:'POST',origin:'https://evil.example',body:{}})).status,403);
    for(let i=0;i<20;i++)await call('auth/login',{method:'POST',ip:'rate-test',body:{email:'invalid'}});
    assert.equal((await call('auth/login',{method:'POST',ip:'rate-test',body:{email:'invalid'}})).status,429);
    const alice=await register();const changed=await call('password',{method:'PATCH',cookie:alice.cookie,body:{current:'Long-test-password-123!',password:'Replacement-password-456!'}});assert.equal(changed.status,200);
    assert.equal((await call('session',{cookie:alice.cookie})).body.user,null);assert.ok((await call('session',{cookie:changed.cookie})).body.user);
    const html=markdown('<script>alert(1)</script>\n\n# Safe\n\n```html\n<img src=x onerror=alert(1)>\n```');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
    assert.equal((await call('profile',{method:'PATCH',cookie:changed.cookie,body:{name:'Alice',bio:'',avatar:'data:image/svg+xml;base64,AAAA'}})).status,400);
  }finally{store.close();}
});
