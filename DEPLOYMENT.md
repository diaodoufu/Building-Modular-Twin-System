# 本地部署指南

本文档详细介绍如何在本地环境中克隆并运行 BMTS（Building Modular Twin System）项目。

## 目录

1. [环境要求](#1-环境要求)
2. [安装依赖](#2-安装依赖)
   - [Windows](#windows)
   - [macOS](#macos)
   - [Linux](#linux)
3. [克隆仓库](#3-克隆仓库)
4. [配置数据库](#4-配置数据库)
5. [启动后端](#5-启动后端)
6. [启动前端](#6-启动前端)
7. [验证部署](#7-验证部署)
8. [常见问题排查](#8-常见问题排查)
9. [环境变量说明](#9-环境变量说明)

---

## 1. 环境要求

| 依赖 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Python | 3.11 | 3.12 |
| Node.js | 18 | 20 LTS |
| PostgreSQL | 14 | 16 |
| Git | 2.x | 最新 |

---

## 2. 安装依赖

### Windows

#### 安装 Python
1. 下载安装包：https://www.python.org/downloads/windows/
2. 勾选 "Add Python to PATH"
3. 安装完成后打开命令提示符验证：
   ```cmd
   python --version
   ```

#### 安装 Node.js
1. 下载安装包：https://nodejs.org/
2. 选择 LTS 版本
3. 安装完成后验证：
   ```cmd
   node --version
   npm --version
   ```

#### 安装 PostgreSQL
1. 下载安装包：https://www.postgresql.org/download/windows/
2. 安装过程中设置密码（记好，后续需要）
3. 默认端口：5432
4. 安装完成后打开命令提示符验证：
   ```cmd
   psql -U postgres
   ```
   输入密码后进入 PostgreSQL 命令行，输入 `\q` 退出。

#### 安装 Git
1. 下载安装包：https://git-scm.com/download/win
2. 安装完成后验证：
   ```cmd
   git --version
   ```

### macOS

#### 安装 Homebrew（如未安装）
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 安装 Python、Node.js、PostgreSQL、Git
```bash
brew install python@3.12 node@20 postgresql git

# 验证安装
python3 --version
node --version
npm --version
git --version
```

#### 启动 PostgreSQL 服务
```bash
# 启动服务
brew services start postgresql

# 设置密码
psql postgres
\password postgres
# 输入密码（记好，后续需要）
\q
```

### Linux (Ubuntu/Debian)

#### 更新包列表
```bash
sudo apt update && sudo apt upgrade -y
```

#### 安装 Python、Node.js、PostgreSQL、Git
```bash
# Python 3.12
sudo apt install python3.12 python3.12-venv python3-pip -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Git
sudo apt install git -y
```

#### 配置 PostgreSQL
```bash
# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 设置密码
sudo -u postgres psql
\password postgres
# 输入密码（记好，后续需要）
\q
```

---

## 3. 克隆仓库

```bash
git clone https://github.com/diaodoufu/Building-Modular-Twin-System.git
cd Building-Modular-Twin-System
```

---

## 4. 配置数据库

### 创建数据库

**Windows/macOS/Linux：**

```bash
psql -U postgres
```

进入 PostgreSQL 命令行后执行：

```sql
CREATE DATABASE bmts;
\q
```

---

## 5. 启动后端

### 进入后端目录

```bash
cd bmts-backend
```

### 创建虚拟环境

**Windows：**
```cmd
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux：**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

编辑 `.env` 文件，修改以下内容：

```env
DATABASE_URL=postgresql+asyncpg://postgres:你的密码@localhost:5432/bmts
SECRET_KEY=bmts-dev-secret-key-change-in-production
DEBUG=true
```

**注意**：将 `你的密码` 替换为安装 PostgreSQL 时设置的密码。

### 初始化数据库

```bash
python seed.py
```

此命令会自动创建数据库表并插入示例数据（校园、建筑、楼层、房间、测试用户等）。

### 启动后端服务器

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端启动成功后：
- API 地址：http://localhost:8000
- API 文档（Swagger UI）：http://localhost:8000/docs

---

## 6. 启动前端

### 打开新终端窗口

**重要**：不要关闭后端终端，打开一个新的终端窗口。

### 进入前端目录

```bash
cd Building-Modular-Twin-System/bmts-frontend
```

### 安装依赖

```bash
npm install
```

### 启动前端开发服务器

```bash
npm run dev
```

或使用：

```bash
npx vite --host
```

前端启动成功后：
- 访问地址：http://localhost:3000

### 前端与后端连接说明

前端通过 Vite 代理自动连接后端：
- 前端访问地址：http://localhost:3000
- Vite 自动将 `/api/*` 请求代理到：http://localhost:8000
- 无需手动配置跨域

---

## 7. 验证部署

### 步骤 1：访问前端

打开浏览器访问：http://localhost:3000

### 步骤 2：登录系统

使用以下测试账号登录：

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 全部权限，含审核、数据管理 |
| testuser | test123 | 普通用户 | 查看空间、创建预约 |
| viewer | viewer123 | 访客 | 仅查看空间信息 |

### 步骤 3：验证功能

1. **首页**：查看校园建筑列表
2. **3D 视图**：点击建筑卡片进入 3D 建筑视图，尝试切换楼层、点击房间
3. **预约功能**：选择空闲房间，创建预约
4. **审核功能**（管理员）：访问审核页面，审核预约请求
5. **统计功能**：访问数据统计页面，查看空间利用率和预约趋势

---

## 8. 常见问题排查

### Q: 启动后端时报错：`Connection refused` 或 `could not connect to server`

**原因**：PostgreSQL 服务未启动或连接配置错误。

**解决**：

1. **Windows**：
   - 打开服务管理器，找到 "postgresql-x64-16" 服务并启动
   - 或在命令提示符执行：`net start postgresql-x64-16`

2. **macOS**：
   ```bash
   brew services start postgresql
   ```

3. **Linux**：
   ```bash
   sudo systemctl start postgresql
   ```

4. **检查连接配置**：
   - 确认 `.env` 中的密码正确
   - 确认 PostgreSQL 端口为 5432

### Q: 启动后端时报错：`password authentication failed`

**原因**：`.env` 中的密码与 PostgreSQL 设置的密码不一致。

**解决**：

1. 修改 `.env` 文件中的 `DATABASE_URL`
2. 或重新设置 PostgreSQL 密码：
   ```bash
   psql -U postgres
   \password postgres
   # 重新设置密码
   \q
   ```

### Q: `pip install` 时报错：`error: Microsoft Visual C++ 14.0 or greater is required`

**原因**：Windows 缺少 C++ 编译工具。

**解决**：

1. 下载安装：https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. 选择 "Desktop development with C++" 工作负载
3. 安装完成后重新执行 `pip install`

### Q: `npm install` 时报错：`EACCES` 或权限不足（macOS/Linux）

**解决**：

```bash
# 不建议使用 sudo，推荐修复 npm 权限
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Q: 前端能访问，但 API 请求失败（404/500）

**原因**：后端未启动，或端口不匹配。

**解决**：

1. 确认后端正在运行：访问 http://localhost:8000/docs
2. 确认 Vite 配置正确（`vite.config.ts` 中 `proxy` 配置指向 `http://localhost:8000`）
3. 确认前端访问地址为 http://localhost:3000（不是 5173）

### Q: 预约时间报错：`TypeError` 或时区错误

**解决**：当前版本已修复时区问题，确保代码是最新的：

```bash
git pull origin main
```

### Q: `seed.py` 执行报错：表已存在

**解决**：

```bash
# 删除旧数据库，重新创建
psql -U postgres -c "DROP DATABASE bmts;"
psql -U postgres -c "CREATE DATABASE bmts;"
python seed.py
```

### Q: 首页只显示一栋建筑或数据异常

**原因**：数据库中存在重复的校园数据。

**解决**：

```bash
python seed.py
```

`seed.py` 会清理旧数据并重新插入正确的示例数据。

---

## 9. 环境变量说明

### 后端（bmts-backend/.env）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | postgresql+asyncpg://postgres:postgres@localhost:5432/bmts |
| SECRET_KEY | JWT 签名密钥 | bmts-dev-secret-key-change-in-production |
| DEBUG | 调试模式 | true |

### 前端（bmts-frontend/.env，可选）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| VITE_API_BASE | 后端 API 基础地址 | 空（使用 Vite 代理） |

**生产环境部署**时，可设置：

```env
VITE_API_BASE=http://your-server-ip:8000
```

---

## 项目结构

```
Building-Modular-Twin-System/
├── bmts-backend/          # 后端（FastAPI + SQLAlchemy）
│   ├── app/               # 应用代码
│   ├── .env.example       # 环境变量示例
│   ├── requirements.txt   # Python 依赖
│   └── seed.py            # 数据库初始化脚本
├── bmts-frontend/         # 前端（Vue 3 + TypeScript + Three.js）
│   ├── src/               # 源码
│   ├── package.json       # Node.js 依赖
│   └── vite.config.ts     # Vite 配置（含代理）
├── docs/                  # 项目文档（PRD、SPEC）
├── wiki/                  # GitHub Wiki 内容
├── README.md              # 项目简介
├── LICENSE                # MIT 开源协议
├── CONTRIBUTING.md        # 贡献指南
├── CHANGELOG.md           # 版本变更记录
└── DEPLOYMENT.md          # 本文件
```

---

## 快速命令参考

```bash
# 克隆仓库
git clone https://github.com/diaodoufu/Building-Modular-Twin-System.git
cd Building-Modular-Twin-System

# === 后端 ===
cd bmts-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，修改数据库密码
python seed.py
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# === 前端（新终端）===
cd Building-Modular-Twin-System/bmts-frontend
npm install
npm run dev

# === 验证 ===
# 前端：http://localhost:3000
# 后端文档：http://localhost:8000/docs
```
