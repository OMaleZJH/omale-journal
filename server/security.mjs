import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export async function hashPassword(password) {const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;}
export async function verifyPassword(password,stored) {const [salt,hash]=stored.split(':');const actual=await scrypt(password,salt,64);const expected=Buffer.from(hash,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected);}
export function fail(status,message){throw Object.assign(new Error(message),{status});}
export function text(value,name,max=1000,min=0){if(typeof value!=='string'||value.trim().length<min||value.length>max)fail(400,`${name}需为 ${min}–${max} 个字符。`);return value.trim();}
export const emailProviders=['qq.com','foxmail.com','163.com','126.com','yeah.net','sina.com','gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','icloud.com','me.com'];
export function checkEmail(email){const domain=email.split('@')[1];if(!domain)fail(400,'请输入有效的邮箱。');const allowed=emailProviders.some(p=>domain===p||domain.endsWith(`.${p}`))||/\.edu\.cn$/.test(domain);if(!allowed)fail(400,'暂只支持 QQ、163、126、Gmail、Outlook、iCloud 等主流邮箱，或高校 edu 邮箱注册。');}
export function safeURL(value,name,{internal=false}={}){if(!value)return '';if(internal&&value==='/' )return value;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error();return url.href;}catch{fail(400,`${name}需要有效的 HTTPS 地址。`);}}
export function publicUser(user){if(!user)return null;const {id,name,bio,avatar,color,role,createdAt}=user;return {id,name,bio,avatar,color,role,createdAt};}
