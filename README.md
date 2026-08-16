<p align="center">
  Vibe Coding 请勿使用
</p>

<p align="center">
  <a href="#-核心特性">特性</a> •
  <a href="#-版本亮点">版本亮点</a> •
  <a href="#-快速部署">快速部署</a> •
  <a href="#-环境变量说明">变量说明</a> •
</p>
---

## 🖼️ 效果预览

| 首页 | 后台管理 |
| :---: | :---: |
| ![首页预览](https://github.com/user-attachments/assets/b106be25-5be4-4ae6-98aa-e1fae38b5a3d) | ![后台预览](https://github.com/user-attachments/assets/49461d13-e48b-400d-b15c-3fa2d1a0460e) |
| ![首页预览](https://github.com/user-attachments/assets/4cb39e41-a7a5-46c7-876c-62021fa5611e) | ![后台预览](https://github.com/user-attachments/assets/4d3bb3f4-da65-400a-a41d-eeaecedb7197) |

| 大卡片 | 小卡片 |
| :---: | :---: |
| ![首页预览](https://github.com/user-attachments/assets/e77d1c10-aba4-4755-8a62-416fe3a8239e) | ![后台预览](https://github.com/user-attachments/assets/b2508b55-bbf6-4998-a111-a7b75eb8686b) |

| 简洁风格 | 夜间模式 |
| :---: | :---: |
| ![首页预览](https://github.com/user-attachments/assets/3a70b18a-5301-4218-a75f-869fbbdaa7a4)| ![后台预览](https://github.com/user-attachments/assets/9e51cf5c-4064-4b8d-ad2c-e0ca9e006834) |
> 卡片的毛玻璃效果和程度可以在后台设置里自定义。后台设置页面为url后加 /admin
## ✨ 核心特性

- 📱 **响应式设计**：完美适配桌面、平板和手机等各种设备。
- 🎨 **主题美观**：界面简洁优雅，支持自定义主色调。
- 🔍 **快速搜索**：内置站内模糊搜索，迅速定位所需网站。
- 📂 **分类清晰**：通过分类组织书签，浏览直观高效。
- 🔒 **安全后台**：基于 KV 的管理员认证，提供完整的书签增删改查后台。
- 📝 **用户提交（可配置）**：支持访客提交书签，经管理员审核后显示，可在环境变量中关闭入口。
- ⚡ **性能卓越**：利用 Cloudflare 边缘缓存，实现秒级加载，并极大节省 D1 数据库读取成本。
- 📤 **数据管理**：支持书签数据的导入与导出，格式兼容，方便迁移。

## 更新日志
- 12-25 增加夜间模式，首页设置增加记住上次选择分类
- 12-23 增加私密分类，导入和导出支持私密书签和分类，导入增加覆盖选项和预览框
- 12-20 增加卡片风格设置，首页设置，允许自定义字体，字体大小，颜色，增加首页外部搜索开关
- 12-19 增加360壁纸（速度较慢，轮询推荐bing），分类支持多级分类
- 12-18 布局设置中增加卡片增加毛玻璃效果开关和滑动条设置，背景增加虚化开关和虚化程度设置
  
- 12-17
  1. 系统设置增加调整横向菜单和5列布局选项，同时允许隐藏卡片描述，链接，分类等
  2. 系统设置增加自定义壁纸，通知提供bing在线壁纸选择（推荐使用Spotlight (Windows 聚焦)，这个壁纸质量不错）

## 🔄 版本亮点

- 🛡️ **后台会话安全升级**：登录 `/admin` 时将颁发 12 小时有效的 HttpOnly 会话 Cookie，凭据不再暴露在 URL 中，并新增一键退出登录。
- 🧹 **输入与展示双重校验**：新增 URL 规范化、HTML 转义与排序值归一化逻辑，前后台同时防止脏数据和潜在 XSS。
- 🚪 **访客投稿可控**：通过 `ENABLE_PUBLIC_SUBMISSION` 环境变量即可关闭前台投稿入口，相关接口自动返回 403，方便运营期按需开关。
- ⚙️ **增加AI一键自动生成描述**：提供Workers AI,Google Gemini和OpenAI接口。
- 📝 **增加logo自动生成**：默认使用同域 `/api/icon` 边缘缓存代理（Google 图标源失败时回退 faviconsnap），可通过环境变量自定义
- 📦 **导入导出数据**：提供书签数据的导入与导出，支持chorme导出的html格式一键导入


## 🚀 快速部署

> **准备工作**: 你需要一个 Cloudflare 账号。

### 步骤 1: Fork 本仓库
[![Fork on GitHub](https://img.shields.io/badge/Fork-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/jy02739244/iori-nav/fork)

 **Fork 项目**: 点击上方"Fork on GitHub"按钮，，并点上 Star !!!
### 步骤 2: 部署到Cloudflare Pages
[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github)

点击上方"DEPLOY  CLOUDFLARE PAGES"按钮,跳转到Cloudflare，然后选连接到Github，授权后选择刚才fork的项目

<img width="2252" height="1380" alt="image" src="https://github.com/user-attachments/assets/0588e0d0-befb-4962-b422-922a8c895674" />
点击开始设置后，需要填写 构建输出目录 为：public，其他保持默认即可。
<img width="2112" height="1404" alt="image" src="https://github.com/user-attachments/assets/654a23af-d75f-477d-848e-fea8a41740dc" />


### 步骤 3: 创建D1数据库

1.  在 Cloudflare 控制台，进入 `存储和数据库` -> `D1 SQL数据库`。
2.  点击 `创建数据库`，数据库名称输入 `book`，然后创建。

<img width="2836" height="1298" alt="image" src="https://github.com/user-attachments/assets/644032c6-304c-46cc-b039-9eafbc6f7a6b" />



### 步骤 4: 创建 KV 存储

1.  在 Cloudflare 控制台，进入 存储和数据库` -> `Worker KV`。
2.  点击 `创建命名空间`，名称输入 `NAV_AUTH`。

    <img width="2744" height="974" alt="image" src="https://github.com/user-attachments/assets/11d08862-7887-4883-97ce-390780e7fccd" />

3.  创建后，为此 KV 添加两个条目，用于设置后台登录的 **用户名** 和 **密码**。
    -   **admin_username**: 你的管理员用户名（例如 `admin`）
    -   **admin_password**: 你的管理员密码

    <img width="2810" height="1188" alt="image" src="https://github.com/user-attachments/assets/2114e42b-03d2-400f-a8f8-54dc156a7922" />


### 步骤 5: 绑定服务

1.  进入你刚刚创建的 Pages项目 的 `设置` -> `绑定`。
2.  点击 `添加绑定`，选择 `D1 数据库`：
    -   变量名称: `NAV_DB`
    -   D1 数据库: 选择你创建的 `book`
3.  点击 `添加绑定`，选择 `KV 命名空间`：：
    -   变量名称: `NAV_AUTH`
    -   KV 命名空间: 选择你创建的 `NAV_AUTH`
      
  <img width="2152" height="1236" alt="image" src="https://github.com/user-attachments/assets/9dd15cd0-8173-4dec-af87-d8ef0bdeaa38" />


### 步骤 6: 重新部署

1.  点击项目的 部署 选项，在最后一次的部署后边，选择重新部署，等待部署完成，绑定自定义域名即可开始使用。

    <img width="2482" height="1374" alt="image" src="https://github.com/user-attachments/assets/d2f12af3-9aba-458e-9d16-00f7468c22e9" />



## 🔑 环境变量说明

| 变量名 | 默认值 | 必填 | 备注 |
|--------|---------|-|-----|
| ENABLE_PUBLIC_SUBMISSION | `false` |❌| 允许访客添加书签 |
| SITE_NAME | `灰色轨迹` |❌| 网站名称以及首页显示名称 |
| SITE_DESCRIPTION | `一个简单易用的书签导航系统` |❌| 首页副标题 |
| FOOTER_TEXT | `曾梦想仗剑走天涯` |❌| 首页页脚 |
| ICON_API | 同域 `/api/icon?url=` |❌| 图标API；默认使用边缘缓存 |
| AI_REQUEST_DELAY | 1500 |❌| AI一键补全描述时的调用间隔 |
| DISPLAY_CATEGORY | 无 |❌| 首页默认显示分类，如设置 `常用推荐 `，访问首页就默认显示常用推荐的书签 |

> **注意**: 我使用免费的Gemini的api key，模型使用gemini-2.5-flash-lite,限制是15次/1分钟,自己看实际情况进行设置

### 管理后台安全
> 后台管理页面地址为： https://自定义域名/admin

后台登录凭据依然存放在 `NAV_AUTH` KV 中的 `admin_username` 与 `admin_password` 两个键内。登录 `/admin` 时需要在页面表单中输入账号与密码，系统会返回一个 12 小时有效的 HttpOnly 会话 Cookie，无需、也不再支持在 URL 查询参数中传递凭据。点击后台右上角的“退出登录”按钮即可立即销毁会话。

---

## 🔧 技术栈

-   **计算**: [Cloudflare Workers](https://workers.cloudflare.com/)
-   **数据库**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
-   **存储**: [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/)
-   **前端框架**: [TailwindCSS](https://tailwindcss.com/)

## 🌟 贡献

欢迎通过 Issue 或 Pull Request 为本项目贡献代码、提出问题或建议！

1.  Fork 本仓库
2.  创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3.  提交你的更改 (`git commit -m 'Add some amazing feature'`)
4.  推送到你的分支 (`git push origin feature/amazing-feature`)
5.  创建一个 Pull Request

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。
