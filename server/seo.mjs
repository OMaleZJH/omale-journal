import { metadata } from '../seo.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function renderPage(template,url,store,env={}){
  const parts=url.pathname.split('/').filter(Boolean),kind=parts[0]==='articles'?'posts':parts[0]==='projects'?'projects':null;
  let data=null,status=200;
  if(kind&&parts[1]){
    data=await store.get(kind,decodeURIComponent(parts[1]));
    if(!data||(kind==='projects'&&data.status!=='published')){data=null;status=404;}
  }
  const meta=metadata(url.pathname,new URL(env.SITE_URL||url.origin).origin,data);
  if(status===404){meta.title='内容不存在 — Omale';meta.noindex=true;}
  const tags=`<title>${esc(meta.title)}</title><meta name="description" content="${esc(meta.description)}"><link rel="canonical" href="${esc(meta.url)}"><meta name="robots" content="${meta.noindex?'noindex, nofollow':'index, follow'}"><meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}"><meta property="og:type" content="${meta.type}"><meta property="og:url" content="${esc(meta.url)}"><meta property="og:image" content="${esc(meta.image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(meta.title)}"><meta name="twitter:description" content="${esc(meta.description)}"><meta name="twitter:image" content="${esc(meta.image)}">`;
  let html=template.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/gi,'').replace(/<link\s+rel="canonical"[^>]*>/gi,'').replace('</head>',tags+'</head>');
  if(data)html=html.replace(/<div class="initial-loading">[\s\S]*?<\/div>/,`<article class="page content-page"><h1>${esc(data.title)}</h1><p>${esc(data.summary)}</p><div style="white-space:pre-wrap">${esc(data.content)}</div></article>`);
  return {html,status};
}
