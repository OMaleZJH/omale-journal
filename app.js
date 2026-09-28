import { $,api,esc,avatar,markdown,submit,toast } from './client.js';
import * as view from './views.js';
import { createUniverse } from './particles.js';

const universe=createUniverse($('#universe'));
const state={user:null,scene:'sphere',items:[],route:0,current:null,cleanup:null,avatar:null,cover:null,search:null};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const titles={home:'探索不设边界',articles:'探索笔记',projects:'作品集',about:'关于我',login:'登录',register:'注册',account:'我的空间',messages:'私信',authors:'创作者',write:'创作空间'};
let routeAbort=null,firstRoute=true,confirmAction=null,routeCurtain=null,routeFade=null;
function sessionNav(){
  $('#session-nav').innerHTML=state.user?`<a class="nav-messages" href="/messages" aria-label="我的私信">✉<span id="unread-count"></span></a><a class="nav-avatar" href="/account" aria-label="我的账号">${avatar(state.user)}<span>${esc(state.user.name)}</span></a>`:`${sessionStorage.getItem('omale-guest')?'<span class="guest-tag">游客访问中</span>':''}<a class="login-link" href="/login">登录 <span>↗</span></a>`;
  if(state.user)updateUnread();
}
async function updateUnread(){try{const items=await api('conversations');const count=items.reduce((sum,item)=>sum+item.unread,0);const target=$('#unread-count');if(target)target.innerHTML=count?`<i class="unread-dot">${Math.min(count,99)}</i>`:'';}catch{/* A private page presents its own connection errors. */}}
function enter({skip=false,stagger=0}={}){const nodes=[...$('#app').querySelectorAll('[data-enter]')];const gentle=reduced.matches;nodes.forEach((node,index)=>{node.animate(gentle?[{opacity:0},{opacity:1}]:[{opacity:0,transform:skip?'translateY(12px)':'translateY(28px) scale(.986)',filter:'blur(6px)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0px)'}],{duration:gentle?460:(skip?640:860),delay:stagger+Math.min(index*(skip?24:42),skip?140:280),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});});}
async function route({push=false,url=location.pathname+location.search,replace=false}={}) {
  const target=new URL(url,location.origin);if(target.origin!==location.origin)return;
  if(push)history[replace?'replaceState':'pushState']({},'',target.pathname+target.search);
  const run=++state.route;routeAbort?.abort();routeAbort=new AbortController();const signal=routeAbort.signal;
  state.cleanup?.();state.cleanup=null;document.body.classList.add('navigating');
  routeCurtain?.remove();routeCurtain=null;routeFade?.cancel();routeFade=null;
  const navStart=performance.now();let curtain=null;
  if(!firstRoute){
    curtain=document.createElement('div');curtain.className='route-curtain';document.body.appendChild(curtain);routeCurtain=curtain;
    curtain.animate([{transform:'translateX(101%)'},{transform:'translateX(0%)'}],{duration:420,easing:'cubic-bezier(.77,0,.18,1)',fill:'forwards'});
  }
  const parts=target.pathname.split('/').filter(Boolean);const key=parts[0]||'home';let html,data=null,snap=false;
  try {
    if(key==='home')html=view.home();
    else if(key==='about')html=view.about();
    else if(key==='articles') {if(parts[1]){data=await api(`posts/${encodeURIComponent(parts[1])}`,{signal});html=view.article(data,state.user);}else{data=await api('posts',{signal});html=view.articles(data,state.user);}}
    else if(key==='projects') {if(parts[1]){data=await api(`projects/${encodeURIComponent(parts[1])}`,{signal});html=view.project(data,state.user);}else{data=await api('projects',{signal});html=view.projects(data,state.user);}}
    else if(key==='login'||key==='register'){if(state.user){return route({push:true,replace:true,url:safeNext(target.searchParams.get('next'))});}snap=true;html=view.auth(key==='register');}
    else if(key==='account'){if(!state.user)html=view.gate();else{data=await api('projects?mine=1',{signal});html=view.account(state.user,data);}}
    else if(key==='authors'&&parts[1]){data=await api(`profiles/${encodeURIComponent(parts[1])}`,{signal});html=view.authorProfile(data.profile,data.projects,state.user);}
    else if(key==='messages'){if(!state.user)html=view.gate('登录后，和有趣的人聊聊');else{const [conversations,thread]=await Promise.all([api('conversations',{signal}),parts[1]?api(`messages/${encodeURIComponent(parts[1])}`,{signal}):null]);data={conversations,thread};html=view.messages(conversations,thread,state.user);}}
    else if(key==='write'&&['project','article'].includes(parts[1])){if(!state.user)html=view.gate('登录后，发布你的创造');else if(parts[1]==='article'&&state.user.role!=='owner'){html=view.errorPage('只有站长 Omale 可以发布文章。你可以在作品集分享自己的项目。',403);}else{data=parts[2]?await api(`${parts[1]==='article'?'posts':'projects'}/${encodeURIComponent(parts[2])}`,{signal}):{};if(parts[1]==='project'&&data.id&&data.authorId!==state.user.id&&state.user.role!=='owner')throw Object.assign(new Error('你只能编辑自己的作品。'),{status:403});html=view.editor(parts[1],data);}}
    else html=view.errorPage('没有找到这个页面，返回首页继续探索吧。',404);snap=true;
    if(run!==state.route)return;
    if(curtain)await new Promise(resolve=>setTimeout(resolve,Math.max(0,450-(performance.now()-navStart))));
    if(run!==state.route)return;
    state.current={key,parts,data};state.items=Array.isArray(data)?data:[];
    document.body.dataset.page=key;universe.setActive(key==='home');
    $('#app').innerHTML=html;window.scrollTo({top:0,behavior:'instant'});
    document.title=`${data?.title||titles[key]||'页面未找到'} — Omale`;
    document.querySelectorAll('.nav-link').forEach(link=>{const active=link.pathname==='/'?key==='home':link.pathname===`/${key}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    enter({skip:snap,stagger:curtain?200:0});bindPage();if(curtain){routeCurtain=null;curtain.animate([{transform:'translateX(0%)'},{transform:'translateX(-101%)'}],{duration:560,easing:'cubic-bezier(.77,0,.18,1)',fill:'forwards'}).finished.then(()=>curtain.remove()).catch(()=>curtain.remove());}if(!firstRoute)$('#app').focus({preventScroll:true});firstRoute=false;
  }catch(error){if(error.name==='AbortError'||run!==state.route)return;curtain?.remove();routeCurtain=null;routeFade?.cancel();routeFade=null;$('#app').innerHTML=view.errorPage(error.message,error.status);document.body.dataset.page=key;universe.setActive(false);enter();$('#retry-page')?.addEventListener('click',()=>route());}
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
    async function poll(){if(stopped||fetching||document.hidden)return;fetching=true;try{const [conversations,updated]=await Promise.all([api('conversations'),peer?api(`messages/${peer}`):null]);if(stopped)return;$('#conversations').innerHTML=view.conversationItems(conversations,peer);if(updated&&JSON.stringify(updated.messages)!==lastMessages){const closeToBottom=thread.scrollHeight-thread.scrollTop-thread.clientHeight<100;thread.innerHTML=view.messageItems(updated.messages,state.user);lastMessages=JSON.stringify(updated.messages);if(closeToBottom)thread.scrollTop=thread.scrollHeight;}await read();updateUnread();}catch(error){if(!stopped&&error.status===401){state.user=null;sessionNav();route();}}finally{fetching=false;}}
    read().then(()=>updateUnread()).catch(()=>{});const timer=setInterval(poll,5000);state.cleanup=()=>{stopped=true;clearInterval(timer);};
    $('#message-form')?.addEventListener('submit',event=>{event.preventDefault();submit(event.currentTarget,async form=>{await api(`messages/${peer}`,{method:'POST',body:{content:form.get('content')}});event.target.reset();await poll();if(thread)thread.scrollTop=thread.scrollHeight;});});
    $('#message-content')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();if(!$('#message-form [type=submit]').disabled)$('#message-form').requestSubmit();}});
  }
}

document.addEventListener('click',event=>{const link=event.target.closest('a');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.hash||!['http:','https:'].includes(url.protocol))return;if(url.pathname.startsWith('/api/'))return;event.preventDefault();if($('#search-dialog').open)$('#search-dialog').close();navigate(url.pathname+url.search);});
window.addEventListener('popstate',()=>route());
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
$('#confirm-delete').addEventListener('click',async event=>{const action=confirmAction;if(!action)return;event.target.disabled=true;try{await action();$('#confirm-dialog').close();confirmAction=null;}catch(error){toast(error.message);}finally{event.target.disabled=false;}});
let searchGeneration=0;
async function renderSearch(){const generation=++searchGeneration;const query=$('#search-input').value.trim().toLowerCase();try{if(!state.search){const [posts,projects]=await Promise.all([api('posts'),api('projects')]);state.search=[...posts.map(item=>({...item,type:'articles',label:'文章'})),...projects.map(item=>({...item,type:'projects',label:'作品'}))];}if(generation!==searchGeneration)return;const found=state.search.filter(item=>[item.title,item.summary,item.content,...item.tags].join(' ').toLowerCase().includes(query));$('#search-results').innerHTML=found.length?found.slice(0,12).map(item=>`<a class="search-result" href="/${item.type}/${esc(item.id)}"><span>${item.label}<small>↗</small></span><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></a>`).join(''):'<p class="empty-state">还没找到这颗星星。试试「AI」「粒子」或「Linux」。</p>';}catch(error){$('#search-results').innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}}
function openSearch(){if(document.querySelector('dialog[open]'))return;$('#search-dialog').showModal();$('#search-input').focus();$('#search-results').innerHTML='<p class="empty-state">正在寻找灵感…</p>';renderSearch();}
$('#open-search').addEventListener('click',openSearch);$('#search-input').addEventListener('input',renderSearch);
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!event.target.isContentEditable){event.preventDefault();openSearch();}});
$('#year').textContent=new Date().getFullYear();
try{state.user=(await api('session')).user;}catch{/* Public homepage stays available if the database is not yet provisioned. */}
sessionNav();
const legacy={'#home':'/','#notes':'/articles','#lab':'/projects','#about':'/about'};
if(legacy[location.hash])history.replaceState({},'',legacy[location.hash]);
await route();
