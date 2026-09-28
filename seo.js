export const pageTitles={home:'探索不设边界',articles:'探索笔记',projects:'作品集',about:'关于我',archive:'时间归档',search:'搜索',login:'登录',register:'注册',account:'我的空间',messages:'私信',notifications:'消息通知',authors:'创作者',write:'创作空间',admin:'内容管理'};
export function metadata(pathname,origin,data){
  const parts=pathname.split('/').filter(Boolean),key=parts[0]||'home';
  const detail=['articles','projects'].includes(key)&&parts[1];
  const publicPage=['home','articles','projects','about','archive','authors'].includes(key);
  const title=`${data?.title||data?.profile?.name||pageTitles[key]||'页面未找到'} — Omale`;
  const description=data?.summary||data?.profile?.bio||'Omale 的个人博客与作品集。计算机、AI、开源项目与永不停止的好奇心。';
  const url=new URL(pathname,origin).href;
  return {title,description,url,type:key==='articles'&&detail?'article':'website',image:new URL(detail&&data?.cover&&data.status!=='draft'?`/api/share-image/${key==='articles'?'posts':'projects'}/${encodeURIComponent(parts[1])}`:'/share-card.png',origin).href,noindex:!publicPage||data?.status==='draft'};
}
