import { randomBytes } from 'node:crypto';
import { hashPassword } from './security.mjs';

// 站长的文章在这里发布；不再预置任何示例文章。
export const samplePosts = [];
export const sampleProjects = [
  {id:'particle-universe',title:'Particle Universe',summary:'一个可以穿行、旋转与切换形态的实时粒子宇宙。',category:'creative',tags:['WebGL','JavaScript'],art:'universe',content:'# 让好奇心成为一个宇宙\n\n作品集示例项目，用于体验详情、评论、克隆与私信流程。这个站点的首页展示了实际运行的粒子场景。\n\n## 交互\n\n- 自动运行的粒子星球与星云\n- 鼠标视差与点击冲击波\n- GPU 实时渲染与移动端适配\n\n欢迎克隆为自己的草稿，继续探索更多视觉形态。',repo:'',demo:'/',license:'MIT'},
  {id:'paper-compass',title:'Paper Compass',summary:'把 AI 论文里的知识点，连接成一张可以探索的地图。',category:'ai',tags:['AI','知识图谱','Python'],art:'ai',content:'# 论文阅读助手 · 概念示例\n\n这是用于展示作品集页面的示例项目，并非已经上线的产品。\n\n## 设想\n\n围绕一篇论文整理问题、方法、实验和引用，将自己的阅读笔记连接起来。\n\n## 可以继续探索\n\n- 段落引用与原文定位\n- 相近主题的论文推荐\n- 本地资料检索\n\n这个页面也可以用来交流实现思路。',repo:'',demo:'',license:'MIT'},
  {id:'tiny-linux',title:'Tiny Linux Lab',summary:'从零搭起的 Linux 小实验，记录每次踩坑与突破。',category:'systems',tags:['Linux','Shell','自托管'],art:'terminal',content:'# 我的 Linux 实验室 · 示例\n\n这个项目用于展示系统类作品。正式内容可以替换成自己的仓库、部署过程与运行截图。\n\n## 记录结构\n\n1. 环境与配置\n2. 复现步骤\n3. 问题与解决方案\n4. 下一步计划\n\n把每一次实践写下来，就是最好的成长记录。',repo:'',demo:'',license:'MIT'}
];
export async function seedDatabase(store,{email,password,onOwnerCreated}={}) {
  let owner=await store.get('users','omale');
  if(!owner) {
    if(!email||!password)throw Object.assign(new Error('请先配置站长账号环境变量 OWNER_EMAIL 和 OWNER_PASSWORD。'),{status:503});
    owner={id:'omale',email:email.toLowerCase(),name:'Omale',bio:'一名大学生，喜欢计算机与 AI，喜爱探索，也喜爱折腾。',avatar:'',color:'mint',role:'owner',password:await hashPassword(password),createdAt:new Date().toISOString()};
    try {await store.put('users','omale',owner,true);await onOwnerCreated?.({email,password});}catch(error){if(!await store.get('users','omale'))throw error;}
  }
  if(await store.get('meta','seeded'))return;
  for(const [i,post] of samplePosts.entries())if(!await store.get('posts',post.id))await store.put('posts',post.id,{...post,authorId:'omale',sample:true,createdAt:`2026-09-${28-i*3}T08:00:00.000Z`});
  for(const [i,project] of sampleProjects.entries())if(!await store.get('projects',project.id))await store.put('projects',project.id,{...project,authorId:'omale',sample:true,status:'published',createdAt:`2026-09-${28-i*2}T08:00:00.000Z`,clonedFrom:null});
  await store.put('meta','seeded',{at:new Date().toISOString()});
}
export const generateOwnerPassword=()=>randomBytes(18).toString('base64url');
