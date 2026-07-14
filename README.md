# BMTS - Building Modular Twin System

<p align="center">
  <strong>建筑模块化孪生系统</strong>
</p>

<p align="center">
  基于开放空间数据规范的跨尺度建筑孪生平台，以 3D 模型为入口，支持空间占用查询、智能预约、资产管理和数据分析。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.4-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Three.js-0.160-000000?logo=three.js" alt="Three.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License" />
</p>

---

## 项目简介

BMTS（Building Modular Twin System）是一个开源的建筑数字孪生平台，核心理念是**分级容器模型**——一切空间实体（校园、建筑、楼层、房间、设备）都是同构的容器，拥有固有属性和可扩展属性。平台以 3D 可视化为交互入口，实现跨尺度无缝缩放，并内置空间预约、智能推荐和数据统计功能。

### 核心特性

- **分级容器模型** — 校园→建筑→楼层→房间→设备，同构容器结构，固有属性 + 可扩展属性
- **3D 可视化引擎** — 基于 Three.js 的跨尺度 3D 场景，支持交互选择、楼层切换、状态编码
- **跨尺度缩放** — 从校园全景到房间详情的无缝过渡，面包屑导航 + 跨级搜索
- **空间预约系统** — 房间预约、冲突检测、管理员审核、我的预约管理
- **BMTS Schema 规范** — 开放建筑空间数据规范，支持 JSON/YAML 导入导出与 Schema 验证
- **智能数据层** — 空间利用率统计、预约趋势分析、智能推荐、异常检测
- **三级权限体系** — 管理员（全权限含审核）、组织用户（查看+预约）、访客（仅查看）

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   客户端 (Browser)                    │
│   Vue 3 + Pinia + Three.js + Element Plus + ECharts  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / REST API
┌──────────────────────┼──────────────────────────────┐
│              FastAPI 应用层                           │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │认证模块 │ │容器CRUD  │ │预约模块  │ │统计模块 │ │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       └───────────┼────────────┼─────────────┘      │
│            ┌──────┴────────────┴──────┐              │
│            │      Service Layer       │              │
│            │  (业务逻辑 + Schema验证)  │              │
│            └────────────┬─────────────┘              │
└─────────────────────────┼────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────┐
│   PostgreSQL (持久化)    │    Redis (缓存/会话)        │
└──────────────────────────────────────────────────────┘
```

## 项目结构

```
BMTS/
├── bmts-frontend/          # 前端 - Vue 3 + TypeScript + Three.js
│   ├── src/
│   │   ├── api/            # API 调用封装
│   │   ├── components/     # 通用组件（预约对话框、房间面板等）
│   │   ├── composables/    # Vue Composition API hooks
│   │   ├── pages/          # 页面（首页、建筑、校园、登录、统计等）
│   │   ├── router/         # 路由配置
│   │   └── stores/         # Pinia 状态管理
│   ├── package.json
│   └── vite.config.ts
├── bmts-backend/           # 后端 - FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── models/         # SQLAlchemy 数据模型
│   │   ├── schemas/        # BMTS Schema 规范 + Pydantic 模型
│   │   ├── services/       # 业务逻辑层
│   │   └── utils/          # 工具函数
│   ├── requirements.txt
│   └── pyproject.toml
├── docs/                   # 项目文档
│   ├── PRD.md              # 产品需求文档
│   └── SPEC.md             # 技术规格文档
├── wiki/                   # GitHub Wiki 内容
├── LICENSE                 # MIT 开源协议
└── README.md               # 本文件
```

## 快速开始

### 环境要求

- **Node.js** >= 18
- **Python** >= 3.11
- **PostgreSQL** >= 14
- **Git**

### 1. 克隆仓库

```bash
git clone https://github.com/<your-username>/BMTS.git
cd BMTS
```

### 2. 启动后端

```bash
cd bmts-backend

# 创建虚拟环境
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 PostgreSQL 数据库连接信息

# 初始化数据库（自动建表）
python seed.py

# 启动服务
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端 API 文档：`http://localhost:8000/docs`

### 3. 启动前端

```bash
cd bmts-frontend

# 安装依赖
npm install

# 启动开发服务器
npx vite --host
```

前端访问地址：`http://localhost:3000`

### 4. 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| testuser | test123 | 普通用户 |
| viewer | viewer123 | 访客 |

## 功能展示

### 分级容器与 3D 可视化

- 校园全景俯视图，建筑以 3D 长方体渲染，不同类型颜色区分
- 建筑详情页，楼层切换 + 房间 3D 交互选择
- 房间状态颜色编码：空闲（绿）/ 使用中（蓝）/ 已预约（橙）

### 空间预约系统

- 选择空闲房间 → 指定日期时间 → 提交预约
- 管理员审核（通过/拒绝），30 分钟粒度时间轴展示占用情况
- 我的预约管理，支持取消操作

### BMTS Schema 数据规范

- 开放的建筑空间数据 JSON Schema 定义
- 支持 JSON/YAML 格式的数据导入导出
- 导入时自动 Schema 验证，UTF-8 BOM 兼容

### 智能统计与推荐

- 空间利用率统计（柱状图、饼图、数据表格）
- 预约趋势分析（7/14/30 天折线图）
- 智能预约推荐（推荐可用房间和最佳时段）
- 异常检测（过期未审核、频繁预约、潜在爽约）

## 开发路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0 | 基础搭建（脚手架、数据库、联调） | ✅ 已完成 |
| Phase 1 | 平台层核心（容器模型、3D 渲染、交互） | ✅ 已完成 |
| Phase 2 | 功能层（认证、预约、状态展示、数据录入） | ✅ 已完成 |
| Phase 3 | 规范层（BMTS Schema、导入导出、验证） | ✅ 已完成 |
| Phase 4 | 智能层（统计、趋势、推荐、异常检测） | ✅ 已完成 |
| Phase 5 | 跨尺度缩放（校园全景、无缝缩放、面包屑、搜索） | ✅ 已完成 |
| Phase 6 | 多组织 SaaS（组织管理、角色权限、容器级权限） | 🚧 开发中 |

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | Vue 3 + TypeScript | Composition API，类型安全 |
| 3D 引擎 | Three.js | 灵活的 3D 渲染与交互 |
| UI 组件库 | Element Plus | Vue 3 生态成熟组件库 |
| 图表 | ECharts | 数据可视化 |
| 状态管理 | Pinia | Vue 3 官方推荐 |
| 构建工具 | Vite | 极速开发体验 |
| 后端框架 | FastAPI | 异步高性能，自动 OpenAPI 文档 |
| ORM | SQLAlchemy 2.x | Python 最成熟 ORM |
| 数据库 | PostgreSQL 16 | JSONB + 空间扩展 |
| 数据验证 | Pydantic + JSON Schema | 请求验证 + BMTS Schema 规范 |

## API 概览

基础路径：`/api/v1`

| 模块 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 认证 | POST | `/auth/login` | 登录 |
| | POST | `/auth/register` | 注册 |
| | GET | `/auth/me` | 当前用户信息 |
| 容器 | GET | `/containers/{id}` | 获取容器详情 |
| | GET | `/containers/{id}/children` | 获取子容器 |
| | POST | `/containers` | 创建容器 |
| | PUT | `/containers/{id}` | 更新容器 |
| | DELETE | `/containers/{id}` | 删除容器 |
| 预约 | POST | `/reservations` | 创建预约 |
| | PUT | `/reservations/{id}/approve` | 审核通过 |
| | PUT | `/reservations/{id}/reject` | 审核拒绝 |
| | DELETE | `/reservations/{id}` | 取消预约 |
| | GET | `/rooms/{id}/schedule` | 房间日程 |
| 统计 | GET | `/stats/usage` | 空间利用率 |
| | GET | `/stats/reservation-trends` | 预约趋势 |
| | GET | `/stats/recommend` | 智能推荐 |
| | GET | `/stats/anomalies` | 异常检测 |
| 数据 | POST | `/data/import` | 导入数据 |
| | GET | `/data/export` | 导出数据 |

完整 API 文档请访问运行中的后端 `/docs` 端点。

## 部署

详细的本地部署指南请参考 [DEPLOYMENT.md](DEPLOYMENT.md)，包含 Windows/macOS/Linux 三平台的完整步骤。

## 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献流程。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 致谢

BMTS 是一个学习型开源项目，感谢以下开源社区：
- [Vue.js](https://vuejs.org/) / [Three.js](https://threejs.org/) / [FastAPI](https://fastapi.tiangolo.com/) / [Element Plus](https://element-plus.org/) / [ECharts](https://echarts.apache.org/)
