# Passbook

Passbook 是一个轻量级、安全的账号密码与 2FA (TOTP) 管理器，特别适合个人用于记录 **非核心、非重要** 的账号信息（例如各类账号池、临时测试账号等）。本项目专为 **Cloudflare Pages** + **D1** 设计。

## 🚀 极简部署流程 (Fork & Deploy)

本项目已实现 **数据库自动初始化**，你无需手动执行任何 SQL 脚本。

### 1. 创建 D1 数据库
首先需要准备好存储：
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages** -> **D1** -> **Create database** -> **Dashboard**。
3. 数据库名称填入 `passbook`，点击创建并记住这个名字。

### 2. Fork 本项目
点击页面右上角的 **Fork** 按钮，将代码同步到你的 GitHub 账号。

### 3. 在 Cloudflare 中创建并连接应用
本项目支持 Cloudflare 最新的 **Workers Assets** 模式，实现全自动部署：
1. 进入 **Workers & Pages** -> **Create application** -> **Create Worker**.
2. 选择 **Import from Git**。
3. 选择你刚 Fork 的 `passbook` 仓库。
4. **Build settings** 配置：
   - **Build command**: `pnpm run build`
   - **Deploy command**: `npx wrangler deploy`
5. 点击 **Deploy**。系统会自动识别 `wrangler.json` 并根据名称绑定 D1 数据库。


### 4. 完成！
访问你的 Pages 链接，系统会自动识别并提示你设置主密码。如果应用提示数据库错误，请手动在控制台 Settings -> Bindings 中确认 `DB` 绑定到了你的 `passbook` 数据库。

---

## 核心特性
- **零知识架构**：所有加密都在浏览器完成，主密码不上传。
- **自动初始化**：代码会自动创建所需的数据库表。
- **实时 2FA**：支持动态验证码显示。
- **持久化入口**：支持在受信任设备上记住密码。

## 许可证
本项目采用 [MIT 许可证](./LICENSE)。
