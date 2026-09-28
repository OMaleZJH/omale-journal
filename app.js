import { $,api,esc,avatar,date,markdown,submit,toast } from './client.js';
import { metadata } from './seo.js';
import * as view from './views.js';
import { createUniverse } from './particles.js';

const universe=createUniverse($('#universe'));
const state={user:null,scene:'sphere',items:[],route:0,current:null,cleanup:null,avatar:null,cover:null,search:null};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let routeAbort=null,firstRoute=true,confirmAction=null;
function likeClick(event){const button=event.target.closest('.like-button');if(!button||button.getAttribute('aria-disabled')==='true')return;event.preventDefault();if(!state.user){toast('登录后即可点赞，为作者加油');return;}button.setAttribute('aria-disabled','true');const kind=button.dataset.kind,id=button.dataset.id;api(`likes/${kind}/${id}`,{method:'POST',body:{}}).then(result=>{button.classList.toggle('liked',result.liked);button.setAttribute('aria-pressed',String(result.liked));const count=button.querySelector('b');if(count)count.textContent=result.count;}).catch(error=>toast(error.message)).finally(()=>{if(button.isConnected)button.setAttribute('aria-disabled','false');});}
async function refreshLike(kind,id){const run=state.route;const result=await api(`likes/${kind}/${id}`);const button=$('.like-button');if(!button||run!==state.route)return;button.classList.toggle('liked',result.liked);button.setAttribute('aria-pressed',String(result.liked));const count=button.querySelector('b');if(count)count.textContent=result.count;}
let searchPageGen=0;
async function runSearch(query){const generation=++searchPageGen;const box=$('#search-page-results');if(!box)return;const q=(query||'').trim();if(!q){box.innerHTML='<div class="empty-panel"><span>⌕</span><p>输入关键词，开始探索。</p></div>';return;}try{const results=await api(`search?q=${encodeURIComponent(q)}`);if(generation!==searchPageGen||!box.isConnected)return;box.innerHTML=results.length?results.map(item=>`<a class="search-result-row" href="/${item.type==='posts'?'articles':item.type}/${esc(item.id)}"><span>${item.label} · ${date(item.createdAt)}</span><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></a>`).join(''):'<div class="empty-panel"><span>✳</span><p>还没找到这颗星星。换个关键词试试？</p></div>';box.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'cubic-bezier(.16,1,.3,1)'});}catch(error){if(generation!==searchPageGen||!box.isConnected)return;box.innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}}
async function bindAdmin(){
  const run=state.route;
  try{const [comments,users,content]=await Promise.all([api('admin/comments'),api('admin/users'),api('admin/content')]);
    if(run!==state.route)return;
    $('#admin-comments').innerHTML=view.adminComments(comments);
    $('#admin-users').innerHTML=view.adminUsers(users);
    $('#admin-content').innerHTML=view.adminContent(content);
    $('#admin-comments').querySelectorAll('[data-admin-delete-comment]').forEach(button=>button.addEventListener('click',()=>confirmDelete(async()=>{await api(`comments/${button.dataset.adminDeleteComment}`,{method:'DELETE',body:{}});toast('评论已删除');await bindAdmin();})));
    $('#admin-content').querySelectorAll('[data-admin-delete-content]').forEach(button=>button.addEventListener('click',()=>confirmDelete(async()=>{await api(button.dataset.adminDeleteContent,{method:'DELETE',body:{}});state.search=null;toast('内容已删除');await bindAdmin();})));
    $('#admin-content').querySelectorAll('[data-admin-hide]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{const item=content.find(item=>item.id===button.dataset.adminHide);await api(`admin/content/projects/${item.id}`,{method:'PATCH',body:{status:'draft'}});state.search=null;toast('作品已下架，仅作者与站长可见');await bindAdmin();}catch(error){toast(error.message);button.disabled=false;}}));
    $('#admin-users').querySelectorAll('[data-admin-ban]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{const id=button.dataset.adminBan,banned=button.dataset.banned!=='1';await api(`admin/users/${id}`,{method:'PATCH',body:{banned}});toast(banned?'已封禁该账号':'已解除封禁');await bindAdmin();}catch(error){toast(error.message);button.disabled=false;}}));
  }catch(error){if(run!==state.route)return;toast(error.message);for(const id of ['admin-comments','admin-users','admin-content'])document.getElementById(id).innerHTML='<p class="form-error">加载失败，请重新进入管理面板。</p>';}
}
async function updateNotifications(){if(!state.user)return;try{const result=await api('notifications');const dot=$('#notif-dot');if(dot){dot.classList.toggle('show',result.unread>0);dot.textContent=result.unread>9?'9+':result.unread;}}catch{/* 通知检查失败时静默，不打扰用户 */}}
function sessionNav(){
  $('#session-nav').innerHTML=state.user?`<a class="nav-messages" href="/messages" aria-label="我的私信">✉<span id="unread-count"></span></a><a class="nav-bell" href="/notifications" aria-label="我的通知">🔔<i id="notif-dot" class="notif-dot"></i></a><a class="nav-avatar" href="/account" aria-label="我的账号">${avatar(state.user)}<span>${esc(state.user.name)}</span></a>${state.user?.role==='owner'?'<a class="nav-admin" href="/admin" aria-label="内容管理">⚙</a>':''}`:`${sessionStorage.getItem('omale-guest')?'<span class="guest-tag">游客访问中</span>':''}<a class="login-link" href="/login">登录 <span>↗</span></a>`;
  if(state.user){updateUnread();updateNotifications();}
}
async function updateUnread(){try{const items=await api('conversations');const count=items.reduce((sum,item)=>sum+item.unread,0);const target=$('#unread-count');if(target)target.innerHTML=count?`<i class="unread-dot">${Math.min(count,99)}</i>`:'';}catch{/* A private page presents its own connection errors. */}}
// 每个页面都有自己独特的入场签名动画；prefers-reduced-motion 时统一降级为柔和淡入
const pageEntrances={
  home:{nodes:[{opacity:0,transform:'translateY(46px) rotateX(72deg)',transformOrigin:'50% 100%',filter:'blur(10px)'},{opacity:1,transform:'translateY(0) rotateX(0deg)',filter:'blur(0px)'}],duration:620,stagger:52,max:170,easing:'cubic-bezier(.19,1,.24,1)'},
  articles:{nodes:[{opacity:0,transform:'translateY(-26px) scale(1.06)',filter:'blur(5px)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0px)'}],duration:400,stagger:0,max:0,easing:'cubic-bezier(.2,1,.3,1)',cards:{transform:'translateX(-60px) skewX(-7deg)',duration:520,stagger:64,max:210}},
  projects:{nodes:[{opacity:0,transform:'translateY(34px) rotateY(38deg) scale(.92)',transformOrigin:'50% 50%'},{opacity:1,transform:'translateY(0) rotateY(0deg) scale(1)'}],duration:540,stagger:58,max:200,easing:'cubic-bezier(.2,1,.3,1)',cards:{transform:'scale(.7)',duration:560,stagger:44,max:150}},
  articlesDetail:{nodes:[{opacity:0,transform:'translateY(30px)',filter:'blur(6px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0px)'}],duration:560,stagger:46,max:180,easing:'cubic-bezier(.16,1,.3,1)',hero:{art:[{opacity:0,transform:'scale(.86) translateY(24px)',filter:'saturate(0)'},{opacity:1,transform:'scale(1) translateY(0)',filter:'saturate(1)'}],duration:680},title:[{opacity:0,transform:'translateY(22px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}]},
  projectsDetail:{nodes:[{opacity:0,transform:'translateX(58px)',filter:'blur(5px)'},{opacity:1,transform:'translateX(0)',filter:'blur(0px)'}],duration:540,stagger:48,max:190,easing:'cubic-bezier(.16,1,.3,1)',hero:{art:[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],duration:660}},
  about:{nodes:[{opacity:0,transform:'translateX(-44px)'},{opacity:1,transform:'translateX(0)'}],duration:500,stagger:44,max:170,easing:'cubic-bezier(.2,1,.3,1)',alt:[{opacity:0,transform:'translateX(44px)'},{opacity:1,transform:'translateX(0)'}]},
  login:{nodes:[{opacity:0,transform:'translateX(-52px) rotateY(14deg)',transformOrigin:'100% 50%'},{opacity:1,transform:'translateX(0) rotateY(0deg)'}],duration:540,stagger:56,max:180,easing:'cubic-bezier(.19,1,.24,1)',alt:[{opacity:0,transform:'translateX(52px) rotateY(-14deg) scale(.97)',transformOrigin:'0% 50%'},{opacity:1,transform:'translateX(0) rotateY(0deg) scale(1)'}]},
  register:{nodes:[{opacity:0,transform:'translateX(52px) rotateY(-14deg)',transformOrigin:'0% 50%'},{opacity:1,transform:'translateX(0) rotateY(0deg)'}],duration:540,stagger:56,max:180,easing:'cubic-bezier(.19,1,.24,1)',alt:[{opacity:0,transform:'translateX(-52px) rotateY(14deg) scale(.97)',transformOrigin:'100% 50%'},{opacity:1,transform:'translateX(0) rotateY(0deg) scale(1)'}]},
  account:{nodes:[{opacity:0,transform:'translateY(40px) scale(.96)'},{opacity:1,transform:'translateY(0) scale(1)'}],duration:540,stagger:50,max:190,easing:'cubic-bezier(.19,1,.24,1)',cards:{transform:'translateY(34px) rotate(.6deg)',duration:500,stagger:52,max:170}},
  messages:{nodes:[{opacity:0,transform:'scaleY(.6)',transformOrigin:'50% 20%',filter:'blur(6px)'},{opacity:1,transform:'scaleY(1)',filter:'blur(0px)'}],duration:600,stagger:46,max:170,easing:'cubic-bezier(.2,1,.3,1)'},
  authors:{nodes:[{opacity:0,transform:'scale(.55)',filter:'blur(9px)'},{opacity:1,transform:'scale(1)',filter:'blur(0px)'}],duration:620,stagger:48,max:180,easing:'cubic-bezier(.19,1,.3,1)'},
  write:{nodes:[{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}],duration:440,stagger:34,max:140,easing:'cubic-bezier(.16,1,.3,1)'},
  search:{nodes:[{opacity:0,clipPath:'inset(0 100% 0 0)',transform:'translateX(-24px)'},{opacity:1,clipPath:'inset(0 0 0 0)',transform:'none'}],duration:440,stagger:38,max:90,easing:'cubic-bezier(.16,1,.3,1)'},
  archive:{nodes:[{opacity:0,clipPath:'inset(0 0 100% 0)',transform:'translateY(-32px)'},{opacity:1,clipPath:'inset(0 0 0 0)',transform:'none'}],duration:520,stagger:40,max:140,easing:'cubic-bezier(.2,1,.3,1)'},
  notifications:{nodes:[{opacity:0,transform:'translateX(90px) scale(.94)'},{opacity:1,transform:'translateX(-4px) scale(1.01)',offset:.75},{opacity:1,transform:'none'}],duration:450,stagger:36,max:140,easing:'cubic-bezier(.2,.8,.3,1)'},
  admin:{nodes:[{opacity:0,clipPath:'inset(48% 0 48% 0)',transform:'scaleX(.85)'},{opacity:1,clipPath:'inset(0 0 0 0)',transform:'none'}],duration:480,stagger:55,max:140,easing:'cubic-bezier(.16,1,.3,1)'},
  error:{nodes:[{opacity:0,transform:'translateX(-9px) skewX(4deg)'},{opacity:1,transform:'translateX(5px) skewX(-3deg)',offset:.3},{opacity:1,transform:'translateX(-3px)',offset:.55},{opacity:1,transform:'translateX(0) skewX(0)'}],duration:520,stagger:56,max:150,easing:'cubic-bezier(.2,1,.3,1)'},
  gate:{nodes:[{opacity:0,transform:'scale(.9)',filter:'blur(7px)'},{opacity:1,transform:'scale(1)',filter:'blur(0px)'}],duration:560,stagger:48,max:170,easing:'cubic-bezier(.19,1,.24,1)'}
};
function enter({skip=false,stagger=0,mode=''}={}){const nodes=[...$('#app').querySelectorAll('[data-enter]')];const gentle=reduced.matches;const spec=skip||gentle?null:pageEntrances[mode];
  if(gentle){nodes.forEach(node=>node.animate([{opacity:0},{opacity:1}],{duration:120,delay:0,fill:'backwards'}));return;}
  if(!spec){nodes.forEach((node,index)=>node.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:460,delay:stagger+Math.min(index*26,130),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));return;}
  document.body.dataset.entrance=mode;
  const alt=spec.alt;const cards=spec.cards;const isGrid=document.getElementById('collection');const gridNodes=isGrid?[...isGrid.children]:[];
  nodes.forEach((node,index)=>{
    if(cards&&gridNodes.includes(node)){const order=gridNodes.indexOf(node);node.animate([{opacity:0,transform:cards.transform},{opacity:1,transform:'none'}],{duration:cards.duration,delay:stagger+Math.min(order*cards.stagger,cards.max),easing:spec.easing,fill:'backwards'});return;}
    if(spec.hero?.art&&node.closest('.reading-art,.project-detail-cover')){node.animate(spec.hero.art,{duration:spec.hero.duration,delay:stagger,easing:'cubic-bezier(.2,1,.3,1)',fill:'backwards'});return;}
    const frames=alt&&index%2?alt:spec.nodes;
    node.animate(frames,{duration:spec.duration,delay:stagger+Math.min(index*spec.stagger,spec.max),easing:spec.easing,fill:'backwards'});
  });
  signature(mode);
  if(spec.title){$('#app').querySelector('.reading-header h1')?.animate(spec.title,{duration:spec.duration+120,delay:stagger+80,easing:'cubic-bezier(.2,1,.3,1)',fill:'backwards'});}
}
function signature(mode){
  document.querySelectorAll('.entry-signature').forEach(node=>node.remove());
  if(reduced.matches)return;
  const shape=document.createElement('div');shape.className=`entry-signature signature-${mode}`;shape.setAttribute('aria-hidden','true');
  shape.innerHTML='<i></i><i></i><i></i>';document.body.append(shape);
  const frames=mode==='home'||mode==='authors'?[{opacity:0,transform:'scale(.2) rotate(-25deg)'},{opacity:.7,offset:.25},{opacity:0,transform:'scale(1.5) rotate(20deg)'}]:mode==='articles'||mode==='search'?[{opacity:0,transform:'translateX(-80%) skewX(-24deg)'},{opacity:.65,offset:.2},{opacity:0,transform:'translateX(100%) skewX(-24deg)'}]:mode==='projects'||mode==='projectsDetail'?[{opacity:0,transform:'perspective(800px) rotateY(75deg) scale(.5)'},{opacity:.6,offset:.25},{opacity:0,transform:'perspective(800px) rotateY(-20deg) scale(1.25)'}]:[{opacity:0,transform:'scaleY(.05)'},{opacity:.5,offset:.2},{opacity:0,transform:'scaleY(1.2)'}];
  shape.animate(frames,{duration:560,easing:'cubic-bezier(.2,.8,.3,1)'}).finished.finally(()=>shape.remove());
}
async function route({push=false,url=location.pathname+location.search,replace=false}={}) {
  const target=new URL(url,location.origin);if(target.origin!==location.origin)return;
  if(push)history[replace?'replaceState':'pushState']({},'',target.pathname+target.search);
  const run=++state.route;routeAbort?.abort();routeAbort=new AbortController();const signal=routeAbort.signal;
  state.cleanup?.();state.cleanup=null;clearTimeout(state.searchTimer);searchPageGen++;document.body.classList.add('navigating');
  document.querySelectorAll('.entry-signature').forEach(node=>node.remove());
  const parts=target.pathname.split('/').filter(Boolean);const key=parts[0]||'home';let html,data=null;
  try {
    if(key==='home')html=view.home();
    else if(key==='about')html=view.about();
    else if(key==='articles') {if(parts[1]){data=await api(`posts/${encodeURIComponent(parts[1])}`,{signal});html=view.article(data,state.user);}else{data=await api('posts',{signal});html=view.articles(data,state.user);}}
    else if(key==='projects') {if(parts[1]){data=await api(`projects/${encodeURIComponent(parts[1])}`,{signal});html=view.project(data,state.user);}else{data=await api('projects',{signal});html=view.projects(data,state.user);}}
    else if(key==='login'||key==='register'){if(state.user){return route({push:true,replace:true,url:safeNext(target.searchParams.get('next'))});}html=view.auth(key==='register');}
    else if(key==='account'){if(!state.user)html=view.gate();else{data=await api('projects?mine=1',{signal});html=view.account(state.user,data);}}
    else if(key==='authors'&&parts[1]){data=await api(`profiles/${encodeURIComponent(parts[1])}`,{signal});html=view.authorProfile(data.profile,data.projects,state.user);}
    else if(key==='notifications'){if(!state.user)html=view.gate('登录后查看你的通知');else{data=await api('notifications',{signal});html=view.notifications(data);}}
    else if(key==='search'){const initial=target.searchParams.get('q')||'';html=view.searchPage(initial);setTimeout(()=>{if(state.route===run)runSearch(initial);},60);}
    else if(key==='archive'){data=await api('archive',{signal});html=view.archivePage(data);}
    else if(key==='admin'){if(state.user?.role!=='owner')html=view.errorPage('内容管理面板只有站长可以进入。',403);else html=view.adminPage();}
    else if(key==='messages'){if(!state.user)html=view.gate('登录后，和有趣的人聊聊');else{const [conversations,thread]=await Promise.all([api('conversations',{signal}),parts[1]?api(`messages/${encodeURIComponent(parts[1])}`,{signal}):null]);data={conversations,thread};html=view.messages(conversations,thread,state.user);}}
    else if(key==='write'&&['project','article'].includes(parts[1])){if(!state.user)html=view.gate('登录后，发布你的创造');else if(parts[1]==='article'&&state.user.role!=='owner'){html=view.errorPage('只有站长 Omale 可以发布文章。你可以在作品集分享自己的项目。',403);}else{data=parts[2]?await api(`${parts[1]==='article'?'posts':'projects'}/${encodeURIComponent(parts[2])}`,{signal}):{};if(parts[1]==='project'&&data.id&&data.authorId!==state.user.id&&state.user.role!=='owner')throw Object.assign(new Error('你只能编辑自己的作品。'),{status:403});html=view.editor(parts[1],data);}}
    else html=view.errorPage('没有找到这个页面，返回首页继续探索吧。',404);
    if(run!==state.route)return;
    state.current={key,parts,data};state.items=Array.isArray(data)?data:[];
    document.body.dataset.page=key;universe.setActive(key==='home');
    $('#app').innerHTML=html;window.scrollTo({top:0,behavior:'instant'});
    const meta=metadata(target.pathname,location.origin,data);document.title=meta.title;
    const metaValues={'description':meta.description,'robots':meta.noindex?'noindex, nofollow':'index, follow','og:title':meta.title,'og:description':meta.description,'og:type':meta.type,'og:url':meta.url,'og:image':meta.image,'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image};
    for(const [name,value] of Object.entries(metaValues)){const attr=name.startsWith('og:')?'property':'name';let tag=document.querySelector(`meta[${attr}="${name}"]`);if(!tag){tag=document.createElement('meta');tag.setAttribute(attr,name);document.head.append(tag);}tag.content=value;}
    let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=meta.url;

    document.querySelectorAll('.nav-link').forEach(link=>{const active=link.pathname==='/'?key==='home':link.pathname===`/${key}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    enter({mode:(key==='articles'||key==='projects')&&parts[1]?key+'Detail':key});bindPage();if(!firstRoute)$('#app').focus({preventScroll:true});firstRoute=false;
  }catch(error){if(error.name==='AbortError'||run!==state.route)return;$('#app').innerHTML=view.errorPage(error.message,error.status);document.body.dataset.page=key;universe.setActive(false);document.title='暂时没能抵达 — Omale';document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex, nofollow');enter({mode:'error'});$('#retry-page')?.addEventListener('click',()=>route());}
  finally{if(run===state.route)document.body.classList.remove('navigating');}
}
function navigate(url,replace=false){return route({push:true,url,replace});}
function safeNext(value){return value&&/^\/(?!\/)/.test(value)?value:'/account';}
function requireLogin(){if(state.user)return true;navigate(`/login?next=${encodeURIComponent(location.pathname)}`);return false;}
function motionButton(){const button=$('#pause-motion');if(button){button.textContent=universe.paused?'▷':'Ⅱ';button.setAttribute('aria-label',universe.paused?'播放粒子动画':'暂停粒子动画');button.setAttribute('aria-pressed',String(universe.paused));}}
async function refreshComments(){const form=$('#comment-form');const {key,data}=state.current||{};if(!data?.id||!['articles','projects'].includes(key))return;const run=state.route;try{const items=await api(`comments?kind=${key==='articles'?'posts':'projects'}&id=${encodeURIComponent(data.id)}`);if(run!==state.route)return;$('#comment-list').innerHTML=view.comments(items,state.user);$('#comment-count').textContent=`${items.length.toString().padStart(2,'0')}`;$('#comment-list').querySelectorAll('[data-delete-comment]').forEach(button=>button.addEventListener('click',()=>confirmDelete(async()=>{await api(`comments/${button.dataset.deleteComment}`,{method:'DELETE',body:{}});await refreshComments();toast('评论已删除');})));}catch(error){if(run===state.route&&$('#comment-list'))$('#comment-list').innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}}
function confirmDelete(action){confirmAction=action;$('#confirm-dialog').showModal();}
function bindPage(){
  const {key,parts,data}=state.current;
  $('#retry-page')?.addEventListener('click',()=>route());
  if(key==='home'){
    universe.replay();universe.setMode(state.scene);motionButton();
    $('#particle-count').textContent=`${universe.count.toLocaleString()} PARTICLES / LIVE`;
    document.querySelectorAll('[data-scene]').forEach(button=>{const selected=button.dataset.scene===state.scene;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.addEventListener('click',()=>{state.scene=button.dataset.scene;universe.setMode(state.scene);$('.nebula-haze').classList.toggle('galaxy',state.scene==='galaxy');document.querySelectorAll('[data-scene]').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',String(active));});});});
    $('#pause-motion').addEventListener('click',()=>{universe.toggle();motionButton();});$('#replay').addEventListener('click',()=>{universe.replay();motionButton();});
  }
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});const filtered=state.items.filter(item=>button.dataset.filter==='all'||item.category===button.dataset.filter);$('#collection').innerHTML=filtered.length?filtered.map(key==='articles'?view.postCard:view.projectCard).join(''):'<div class="empty-panel"><span>✳</span><p>这个方向的新探索，正在路上。</p></div>';$('#collection').animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});}));
  if($('#comment-list'))refreshComments();
  const collection=$('#collection');
  if(collection&&(key==='articles'||key==='projects'))collection.addEventListener('click',likeClick);
  const detailKind=(key==='articles'||key==='projects')&&parts[1]?(key==='articles'?'posts':'projects'):null;
  if(detailKind&&data?.id){const run=state.route;const visitKey=`omale-view:${detailKind}:${data.id}`;if(!sessionStorage.getItem(visitKey))api(`views/${detailKind}/${data.id}`,{method:'POST',body:{}}).then(result=>{sessionStorage.setItem(visitKey,'1');if(run===state.route&&$('#view-count'))$('#view-count').textContent=result.views.toLocaleString();}).catch(()=>{});refreshLike(detailKind,data.id).catch(()=>{});$('.reading-meta .like-button,.detail-metrics .like-button')?.addEventListener('click',likeClick);}
  if(key==='search'){$('#search-page-input')?.addEventListener('input',event=>{clearTimeout(state.searchTimer);searchPageGen++;const query=event.target.value;history.replaceState({},'',query?`/search?q=${encodeURIComponent(query)}`:'/search');state.searchTimer=setTimeout(()=>runSearch(query),220);});$('#search-page-input')?.focus();}
  if(key==='notifications'){$('#notification-list')?.addEventListener('click',event=>{const link=event.target.closest('[data-notification]');if(link)api(`notifications/${encodeURIComponent(link.dataset.notification)}/read`,{method:'POST',body:{}}).then(updateNotifications).catch(()=>{});});$('#read-all-notifications')?.addEventListener('click',async()=>{try{await api('notifications/read-all',{method:'POST',body:{}});updateNotifications();route();}catch(error){toast(error.message);}});}
  if(key==='archive')document.querySelectorAll('[data-archive-filter]').forEach(button=>button.addEventListener('click',()=>{const value=button.dataset.archiveFilter;const groups=$('.archive-groups');groups.querySelectorAll('.archive-month').forEach(month=>{month.style.display=value==='all'||month.dataset.month===value?'':'none';});document.querySelectorAll('[data-archive-filter]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});groups.animate([{opacity:.25},{opacity:1}],{duration:320,easing:'ease-out'});}));
  if(key==='admin'&&state.user?.role==='owner')bindAdmin();
  $('#comment-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{await api('comments',{method:'POST',body:{kind:event.target.dataset.kind,targetId:event.target.dataset.id,content:form.get('content')}});event.target.reset();await refreshComments();toast('评论已发布');});});
  $('#clone-project')?.addEventListener('click',async event=>{if(!requireLogin())return;event.currentTarget.disabled=true;try{const copy=await api(`projects/${data.id}/clone`,{method:'POST',body:{}});toast('已克隆为私密草稿，原作者来源已保留');await navigate(`/write/project/${copy.id}`);}catch(error){toast(error.message);if(event.target.isConnected)event.target.disabled=false;}});
  $('#copy-clone')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`git clone ${data.repo}`);toast('git clone 命令已复制');}catch{toast(`复制失败，请使用项目源码地址：${data.repo}`);}});
  $('#auth-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{const result=await api(`auth/${event.target.dataset.mode}`,{method:'POST',body:Object.fromEntries(form)});state.user=result.user;sessionStorage.removeItem('omale-guest');sessionNav();toast(`欢迎，${state.user.name}`);await navigate(safeNext(new URLSearchParams(location.search).get('next')),true);});});
  $('#toggle-password')?.addEventListener('click',event=>{const input=$('#auth-form [name=password]'),show=input.type==='password';input.type=show?'text':'password';event.target.textContent=show?'隐藏':'显示';event.target.setAttribute('aria-label',show?'隐藏密码':'显示密码');});
  $('#guest-access')?.addEventListener('click',()=>{sessionStorage.setItem('omale-guest','1');sessionNav();toast('已进入游客模式，可以自由浏览文章和作品');navigate('/');});
  $('#logout')?.addEventListener('click',async()=>{try{await api('auth/logout',{method:'POST',body:{}});state.user=null;state.avatar=null;sessionNav();toast('已退出登录');navigate('/');}catch(error){toast(error.message);}});
  $('#profile-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{const values=Object.fromEntries(form);if(state.avatar!==null)values.avatar=state.avatar;const result=await api('profile',{method:'PATCH',body:values});state.user=result.user;state.avatar=null;sessionNav();toast('个人资料已保存');await route();});});
  $('#cover-file')?.addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('请选择不超过 8MB 的 PNG、JPEG 或 WebP 图片。');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const ratio=Math.min(1120/bitmap.width,630/bitmap.height,1);canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();state.cover=canvas.toDataURL('image/jpeg',.82);const label=event.target.closest('.upload-cover');label.querySelector('.cover-thumb')?.remove();const thumb=document.createElement('span');thumb.className='cover-thumb cover-image';thumb.style.backgroundImage=`url('${state.cover}')`;label.appendChild(thumb);label.firstChild.textContent='更换封面图片 ';toast('封面已选择，保存后生效');}catch(error){toast(error.message);event.target.value='';}});
  $('#avatar-file')?.addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('请选择不超过 5MB 的 PNG、JPEG 或 WebP 图片。');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const context=canvas.getContext('2d');const size=Math.min(bitmap.width,bitmap.height);context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,192,192);bitmap.close();state.avatar=canvas.toDataURL('image/webp',.85);$('#avatar-preview').innerHTML=avatar({...state.user,avatar:state.avatar},'xl');toast('头像已选择，保存资料后生效');}catch(error){toast(error.message);event.target.value='';}});
  $('#password-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{await api('password',{method:'PATCH',body:Object.fromEntries(form)});event.target.reset();toast('密码已更新，其他登录会话已失效');});});
  $('#editor-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{const item=Object.fromEntries(form);item.tags=item.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean);if(state.cover!==null)item.cover=state.cover;const collection=event.target.dataset.kind==='article'?'posts':'projects',id=event.target.dataset.id;const saved=await api(collection+(id?'/'+id:''),{method:id?'PATCH':'POST',body:item});state.cover=null;state.search=null;toast(collection==='posts'?'文章已发布':saved.status==='draft'?'已保存为私密草稿':'作品已发布');await navigate(`/${collection==='posts'?'articles':'projects'}/${saved.id}`);});});
  $('#preview-markdown')?.addEventListener('click',event=>{const preview=$('#markdown-preview'),source=$('#editor-content');const show=preview.hidden;preview.hidden=!show;source.hidden=show;if(show)preview.innerHTML=markdown(source.value);event.target.textContent=show?'继续编辑 ↗':'预览排版 ↗';});
  $('#delete-content')?.addEventListener('click',()=>confirmDelete(async()=>{const collection=parts[1]==='article'?'posts':'projects';await api(`${collection}/${data.id}`,{method:'DELETE',body:{}});state.search=null;toast('内容已删除');await navigate(collection==='posts'?'/articles':'/account');}));
  if(key==='messages'&&state.user&&data){
    const peer=data.thread?.peer.id;let stopped=false,fetching=false,lastMessages=JSON.stringify(data.thread?.messages||[]);
    const thread=$('#thread-messages');if(thread)thread.scrollTop=thread.scrollHeight;
    async function read(){if(peer&&!document.hidden)await api(`messages/${peer}/read`,{method:'POST',body:{}});}
    async function poll(){if(stopped||fetching||document.hidden)return;fetching=true;try{const [conversations,updated]=await Promise.all([api('conversations'),peer?api(`messages/${peer}`):null]);if(stopped)return;$('#conversations').innerHTML=view.conversationItems(conversations,peer);if(updated&&JSON.stringify(updated.messages)!==lastMessages){const closeToBottom=thread.scrollHeight-thread.scrollTop-thread.clientHeight<100;thread.innerHTML=view.messageItems(updated.messages,state.user);lastMessages=JSON.stringify(updated.messages);if(closeToBottom)thread.scrollTop=thread.scrollHeight;}await read();updateUnread();updateNotifications();}catch(error){if(!stopped&&error.status===401){state.user=null;sessionNav();route();}}finally{fetching=false;}}
    read().then(()=>updateUnread()).catch(()=>{});const timer=setInterval(poll,5000);state.cleanup=()=>{stopped=true;clearInterval(timer);};
    $('#message-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{await api(`messages/${peer}`,{method:'POST',body:{content:form.get('content')}});event.target.reset();await poll();if(thread)thread.scrollTop=thread.scrollHeight;});});
    $('#message-content')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();if(!$('#message-form [type=submit]').disabled)$('#message-form').requestSubmit();}});
  }
}

document.addEventListener('click',event=>{const link=event.target.closest('a');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.hash||!['http:','https:'].includes(url.protocol))return;if(url.pathname.startsWith('/api/')||['/feed.xml','/sitemap.xml'].includes(url.pathname))return;event.preventDefault();if($('#search-dialog').open)$('#search-dialog').close();navigate(url.pathname+url.search);});
window.addEventListener('popstate',()=>route());
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
$('#confirm-delete').addEventListener('click',async event=>{const action=confirmAction;if(!action)return;event.target.disabled=true;try{await action();$('#confirm-dialog').close();confirmAction=null;}catch(error){toast(error.message);}finally{event.target.disabled=false;}});
let searchGeneration=0;
async function renderSearch(){const generation=++searchGeneration;const query=$('#search-input').value.trim().toLowerCase();try{if(!state.search){const [posts,projects]=await Promise.all([api('posts'),api('projects')]);state.search=[...posts.map(item=>({...item,type:'articles',label:'文章'})),...projects.map(item=>({...item,type:'projects',label:'作品'}))];}if(generation!==searchGeneration)return;const found=state.search.filter(item=>[item.title,item.summary,item.content,...item.tags].join(' ').toLowerCase().includes(query));$('#search-results').innerHTML=found.length?found.slice(0,12).map(item=>`<a class="search-result" href="/${item.type==='posts'?'articles':item.type}/${esc(item.id)}"><span>${item.label}<small>↗</small></span><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></a>`).join(''):'<p class="empty-state">还没找到这颗星星。试试 <a class="text-link" href="/search?q='+encodeURIComponent(query||'')+'">进入完整搜索页 ↗</a>，或用「AI」「粒子」等关键词。</p>';}catch(error){$('#search-results').innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}}
function openSearch(){if(document.querySelector('dialog[open]'))return;$('#search-dialog').showModal();$('#search-input').focus();$('#search-results').innerHTML='<p class="empty-state">正在寻找灵感…</p>';renderSearch();}
$('#open-search').addEventListener('click',openSearch);$('#search-input').addEventListener('input',renderSearch);
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!event.target.isContentEditable){event.preventDefault();openSearch();}});
$('#year').textContent=new Date().getFullYear();
try{state.user=(await api('session')).user;}catch{/* Public homepage stays available if the database is not yet provisioned. */}
sessionNav();
setInterval(()=>{if(state.user&&!document.hidden){updateUnread();updateNotifications();}},15000);
document.addEventListener('visibilitychange',()=>{if(state.user&&!document.hidden){updateUnread();updateNotifications();}});
const legacy={'#home':'/','#notes':'/articles','#lab':'/projects','#about':'/about'};
if(legacy[location.hash])history.replaceState({},'',legacy[location.hash]);
await route();
