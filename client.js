export const $=selector=>document.querySelector(selector);
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(path,options={}) {
  const response=await fetch(`/api/${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
  let data;try{data=await response.json();}catch{throw new Error('服务暂时无法连接，请稍后再试。');}
  if(!response.ok){const error=new Error(data.error||'操作失败，请稍后重试。');error.status=response.status;throw error;}
  return data;
}
export function date(value){return new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('/','.');}
export function time(value){return new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
export function avatar(user,size=''){return `<span class="avatar ${esc(user?.color||'mint')} ${size}">${user?.avatar?`<img src="${esc(user.avatar)}" alt="${esc(user.name)} 的头像">`:esc((user?.name||'?').slice(0,1).toUpperCase())}</span>`;}
export const categoryNames={ai:'人工智能',code:'计算机',systems:'系统与折腾',creative:'创意编程',web:'Web 开发'};
export function markdown(source='') {
  const blocks=[];let safe=esc(source).replace(/```([^\n]*)\n([\s\S]*?)```/g,(_,lang,code)=>{const id=blocks.length;blocks.push(`<pre><span class="code-language">${lang||'CODE'}</span><code>${code}</code></pre>`);return `\n@@BLOCK${id}@@\n`;});
  const inline=line=>line.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  return safe.split(/\n\s*\n/).map(block=>{
    const match=block.trim().match(/^@@BLOCK(\d+)@@$/);if(match)return blocks[Number(match[1])];
    if(/^#{1,3} /.test(block)){return block.split('\n').map(line=>{const h=line.match(/^(#{1,3}) (.*)$/);return h?`<h${Math.min(h[1].length+1,4)}>${inline(h[2])}</h${Math.min(h[1].length+1,4)}>`:`<p>${inline(line)}</p>`;}).join('');}
    if(/^&gt; /.test(block))return `<blockquote>${inline(block.replace(/^&gt; /gm,''))}</blockquote>`;
    if(/^[-*] /.test(block))return `<ul>${block.split('\n').map(line=>`<li>${inline(line.replace(/^[-*] /,''))}</li>`).join('')}</ul>`;
    if(/^\d+\. /.test(block))return `<ol>${block.split('\n').map(line=>`<li>${inline(line.replace(/^\d+\. /,''))}</li>`).join('')}</ol>`;
    return `<p>${inline(block).replaceAll('\n','<br>')}</p>`;
  }).join('');
}
let toastTimer;
export function toast(message){const target=$('#toast');target.textContent=message;target.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>target.classList.remove('visible'),3600);}
export async function submit(form,task) {const button=form.querySelector('[type="submit"]');const error=form.querySelector('.form-error');if(error)error.textContent='';button.disabled=true;button.classList.add('busy');try{await task(new FormData(form));}catch(e){if(error)error.textContent=e.message;else toast(e.message);}finally{if(button.isConnected){button.disabled=false;button.classList.remove('busy');}}}
