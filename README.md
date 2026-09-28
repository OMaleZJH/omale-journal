# Omale · 探索不设边界

面向计算机、AI 和个人项目的博客与作品社区。首页、文章、作品集和关于页使用独立 URL；内容按页面加载，不再是锚点长页面。前进、后退和直接刷新都能工作。

## 本地使用

需要 Node.js **22.13 或更高版本**，推荐 Node.js 24。不需要安装运行时依赖。

```sh
npm run dev
```

打开 http://localhost:5173 。默认生成本地 SQLite 数据库 `.local/omale.sqlite`，注册用户、个人资料、文章、作品、评论和私信均保存在这个数据库中，刷新和重启服务后仍然存在。

首次运行会自动创建 Omale 的站长账号，随机密码位于 **`.local/owner-login.txt`**。使用该账号登录后，可以写文章、编辑文章、管理自己的作品和修改密码。这个文件以及整个 `.local/` 已加入 `.gitignore`，只用于本机，不能上传到 Git 或作为网页发布。

普通用户从「登录 → 注册」创建自己的账号。注册邮箱支持 QQ、163、126、Gmail、Outlook、iCloud 等主流邮箱以及高校 edu 邮箱；配置 GitHub OAuth App 后，也可以在登录页一键使用 GitHub 账号注册并登录，首次登录会自动同步 GitHub 昵称、简介和头像。也可以点击「以游客身份访问」，无需账号阅读公开内容。

## 功能与权限

| 功能 | 游客 | 注册用户 | Omale 站长 |
| --- | --- | --- | --- |
| 阅读文章、公开作品、评论、作者主页 | 可以 | 可以 | 可以 |
| 搜索文章和作品 | 可以 | 可以 | 可以 |
| 个人资料、头像上传、修改密码 | — | 可以 | 可以 |
| 发布和编辑自己的作品 | — | 可以 | 可以 |
| 克隆开放许可项目为自己的私密草稿 | — | 可以 | 可以 |
| 评论、删除自己的评论 | — | 可以 | 可以 |
| 私信作者、查看自己的对话 | — | 可以 | 可以 |
| 发布、编辑、删除文章 | — | — | 可以 |
| 删除不合适的作品和评论 | — | — | 可以 |

权限在后端执行，不依赖前端隐藏按钮。普通用户不能通过注册参数、修改个人资料或直接请求接口取得站长权限。草稿仅作者和站长可读；私信只有对话双方可读，站长也没有浏览别人的私信的接口。

「克隆」会复制项目介绍、标签和链接，保留原项目来源，并生成登录用户自己的草稿，不会擅自创建 GitHub Fork。源码仓库由作者提供，可打开仓库，或复制 `git clone` 命令。保留全部权利的作品不能克隆。

私信在打开页面时每 5 秒同步一次，支持未读数、回执以及 Ctrl / ⌘ + Enter 发送；它不是 WebSocket 实时推送。注册邮箱当前用作登录名，尚未接入邮件验证、邮件找回密码和消息邮件通知。

阅读量按同一来源 IP、同一内容 30 分钟去重，浏览器同一会话也避免重复提交。登录后可点赞或取消点赞，支持键盘操作；编辑内容保留统计，克隆作品从零计数。SQLite 事务与 Supabase 行锁保护并发计数。

导航铃铛显示点赞、评论、私信通知，当前标签页每 15 秒检查一次，恢复前台时立即检查。通知支持逐条或全部已读；阅读私信会消除该对话的通知。`/admin` 仅站长可用，可查看文章/作品、下架作品、删除内容或评论、封禁/解封账号。封禁会撤销已有登录会话。

`/search?q=关键词` 搜索公开文章与作品的标题、摘要、正文和标签；`/archive` 按月份浏览文章。页脚提供搜索、归档与 RSS 入口。`/feed.xml` 提供最近 30 篇文章，`/sitemap.xml` 仅列出公开内容。文章与作品的标题、摘要、canonical、Open Graph 和 Twitter 分享信息由服务端输出；有封面时使用公开封面图片接口，否则使用 `share-card.png`。私密页面禁止索引，草稿不会输出正文或分享图片。

## 动效与页面

- 持续运行的 WebGL 粒子宇宙：电脑端 22,550 颗，移动端 8,175 颗。
- 由四层场景组成：粒子星球／螺旋星云、深邃星野、随机划过的流星尾迹，以及星云辉光核心。
- 无需点击，打开网页即开始旋转；每颗粒子从四面八方飞入、盘旋汇聚成星球（可重播）；可切换星球与螺旋星云、鼠标视差、点击扩散。
- 粒子场景跨页面保留，切页不再等待遮屏光幕。首页翻转汇聚、文章斜切滑入、作品透视展开、关于页左右交错、登录/注册镜像折页、搜索横向扫描、归档纵向展开、通知弹入、管理页栅格展开；内容入场约 0.4–0.8 秒，首页粒子汇聚约 1.1 秒。系统启用减少动态效果时使用 120 毫秒淡入。
- 移动端降低粒子数量与像素比例；隐藏标签页暂停渲染。系统启用减少动态效果时，页面动效自动降级为柔和淡入（不会完全关闭），粒子低速运行。
- WebGL 不可用时自动回退到 Canvas 动画。

主要地址：`/`、`/articles`、`/articles/:id`、`/projects`、`/projects/:id`、`/about`、`/login`、`/register`、`/account`、`/authors/:id`、`/messages/:id`、`/write/article`、`/write/project`。

初始没有任何文章，由站长在「写一篇文章」中发布。作品集初始内置三个**明确标注的示例作品**，用于体验详情、评论、克隆与私信流程，站长登录后可在自己的空间删除。示例只在初始化数据库时写入，删除后不会在重启时重新出现。

文章和作品都支持上传自定义封面图片（PNG、JPEG、WebP，最大 8MB，自动压缩为 JPEG 存储）；不上传封面时使用内置的粒子宇宙／神经网络／终端风格封面。

## 上线到 Netlify

此版本包含服务端 API。**不能再只拖拽 `dist` 上线完整功能，也不要使用第一版静态部署包。** 应通过 Git 导入整个仓库，或者使用 Netlify CLI 部署构建与函数。

云端使用 Netlify Functions + Supabase PostgreSQL。本地数据库不会自动同步到云端；云端初始化自己的站长账号及示例内容。当前没有实际云账号和环境变量，因此云端连接与实际发布尚未执行。

1. 创建一个 Supabase 项目，在 SQL Editor 中执行 `supabase/schema.sql`。**已有部署升级本版也需要重新执行该文件**，以增加原子计数与内容保存函数；脚本可重复执行，不清空原数据。
2. 在 Netlify 导入这个代码仓库。构建配置已经写入 `netlify.toml`：`npm run build`，静态目录 `dist`，函数目录 `netlify/functions`。
3. 在 Netlify 的环境变量设置中配置以下变量，并让变量可用于 **Functions 运行时**：

   | 环境变量 | 内容 |
   | --- | --- |
   | `SUPABASE_URL` | Supabase 项目 URL |
   | `SUPABASE_SECRET_KEY` | Supabase 服务端 secret key，仅在函数运行时使用 |
   | `OWNER_EMAIL` | 你的正式站长登录邮箱 |
   | `OWNER_PASSWORD` | 足够长且唯一的初始站长密码，建议至少 20 个字符 |
   | `SITE_URL` | 可选，正式网站根地址，用于 RSS、站点地图、canonical 与分享图片；未设置时使用当前请求域名 |
   | `GITHUB_CLIENT_ID` | 可选。GitHub OAuth App 的 Client ID，启用一键登录 |
   | `GITHUB_CLIENT_SECRET` | 可选。GitHub OAuth App 的 Client Secret，仅在函数运行时使用 |

   兼容旧项目的 `SUPABASE_SERVICE_ROLE_KEY`，新项目优先使用 `SUPABASE_SECRET_KEY`。密钥绝不能以网页变量或前端脚本的形式提供。没有配置数据库时，首页仍可浏览，数据页面会清楚提示云端服务尚未配置，不会模拟操作成功。

4. 部署后，首次 API 请求会创建正式站长账号与示例内容。使用环境变量中的站长邮箱和密码登录。
5. 验证注册、作品发布、文章权限、评论和两个账号之间的私信。正式站账号与本地站账号彼此独立。

Supabase 表启用了 RLS，撤销了匿名及普通数据库角色对这些表的直接访问。所有数据读取和写入都经过 Netlify 函数中的身份及权限检查。浏览器只持有 HttpOnly 会话 Cookie，密码由服务端 scrypt 哈希，数据库只存储会话令牌的 SHA-256 摘要；生产 Cookie 使用 Secure、SameSite=Lax 和 `__Host-` 前缀。接口包含来源检查、字段校验、头像格式校验及数据库持久限流。

此版适合小型个人社区；内容列表当前按最多 2,000 条读取，Supabase 侧还受项目行数上限约束。用户和数据量增长后，应继续增加分页、邮件账号恢复、内容举报与运营管理功能。

## 构建与检查

```sh
npm run build
npm test
npm run preview
```

`npm run preview` 预览构建产物，同时启动本地 API。使用 `npm run dev -- --port 5174` 可指定其他端口。`npm test` 使用独立内存数据库验证游客权限、账号提权、文章发布、草稿隔离、克隆来源、评论所有权、私信隐私、退出登录、限流和密码修改。

浏览器检查需另行安装 Playwright，或设置 `PLAYWRIGHT_MODULE` 为本机现有模块的完整路径，再运行 `npm run test:browser`。测试会在 5188 端口启动单独服务，使用 `artifacts/qa-*.sqlite` 测试库，不会更改你的站长账号或作品。截图输出到 `artifacts/v2-*.png`。

## 文件位置

- `app.js`：前端路由、动效调度、页面交互。
- `views.js`、`app.css`、`style.css`：页面结构与视觉样式。
- `particles.js`：WebGL 着色器、星球／星云／星野／流星粒子生成与 Canvas 回退。
- `client.js`：API 调用、安全转义及受限 Markdown 渲染。
- `server/api.mjs`：账号、文章、作品、评论与私信接口及权限。
- `server/local-store.mjs`：本地 SQLite 存储。
- `server/cloud-store.mjs`：Supabase 服务端存储适配器。
- `server/seed.mjs`：站长初始化和示例文章、作品。
- `netlify/functions/api.mjs`、`supabase/schema.sql`：云端函数与数据库初始化。

## 参考

设计参考：[Bruno Simon](https://bruno-simon.com/)、[Charu Pragya](https://chauciao.com/)、[Brittany Chiang](https://brittanychiang.com/)。页面及动效为原创实现。

部署与数据库参考：[Netlify Functions API](https://docs.netlify.com/build/functions/api/)、[Netlify 路由重写](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)、[Supabase API 密钥](https://supabase.com/docs/guides/getting-started/api-keys)、[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
