# BMTS - 技术规格文档 (SPEC)

> Building Modular Twin System - 建筑模块化孪生系统
> 版本：v1.0 | 日期：2026-07-11

---

## 1. 技术栈

| 层 | 技术 | 版本 | 选型理由 |
|----|------|------|----------|
| **前端框架** | Vue 3 + TypeScript | ^3.4 | 中文生态最好，上手曲线平缓，Composition API适合复杂交互 |
| **3D引擎** | Three.js | ^0.160 | 灵活度最高，与Vue集成可控性强，社区资源丰富 |
| **UI组件库** | Element Plus | ^2.x | Vue 3生态最成熟的组件库，开箱即用 |
| **响应式方案** | CSS Media Query + 动态组件 | - | PC端3D视图 + 移动端2D平面图，同一数据源不同渲染 |
| **状态管理** | Pinia | ^2.x | Vue 3官方推荐，TypeScript支持好 |
| **构建工具** | Vite | ^5.x | 开发体验极快，Vue生态首选 |
| **后端框架** | Python + FastAPI | ^3.11 / ^0.110 | 开发效率高，异步支持强，AI/ML生态无缝衔接 |
| **ORM** | SQLAlchemy | ^2.x | Python最成熟的ORM，配合Alembic做迁移 |
| **数据库** | PostgreSQL | ^16 | 支持JSON字段（扩展属性）、PostGIS空间扩展、成熟可靠 |
| **缓存** | Redis | ^7.x | 会话管理、预约锁定、热数据缓存 |
| **API规范** | REST + OpenAPI 3.0 | - | FastAPI原生支持OpenAPI，自动生成文档 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      客户端 (Browser)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Vue 3 App│  │Pinia Store│  │  Three.js 3D Engine  │  │
│  └─────┬────┘  └─────┬────┘  └──────────┬───────────┘  │
│        └──────────────┼──────────────────┘              │
│                       │ Axios / WebSocket               │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTP/WS
┌───────────────────────┼─────────────────────────────────┐
│                  API Gateway / Nginx                     │
└───────────────────────┼─────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│                 FastAPI 应用层                            │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │认证模块 │  │容器CRUD  │  │预约模块  │  │统计模块 │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       └────────────┼─────────────┼─────────────┘       │
│                    │             │                      │
│            ┌───────┴─────────────┴───────┐              │
│            │      Service Layer          │              │
│            │  (业务逻辑 + Schema验证)     │              │
│            └───────────────┬─────────────┘              │
└────────────────────────────┼────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────┐
│                    数据层                                 │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ PostgreSQL   │  │    Redis     │                     │
│  │ (持久化存储)  │  │ (缓存/会话)  │                     │
│  └──────────────┘  └──────────────┘                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 核心容器模型

所有空间实体共用统一的容器表结构：

```sql
-- 核心容器表
CREATE TABLE containers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,  -- 多租户隔离
    type        VARCHAR(32) NOT NULL,  -- campus|building|floor|room|resource
    name        VARCHAR(128) NOT NULL,
    parent_id   UUID REFERENCES containers(id) ON DELETE CASCADE,
    sort_order  INTEGER DEFAULT 0,

    -- 固有属性（按type不同有不同字段）
    base_attrs  JSONB NOT NULL DEFAULT '{}',

    -- 可扩展属性（用户自定义）
    ext_attrs   JSONB NOT NULL DEFAULT '{}',

    -- 3D相关
    position    JSONB,          -- { x, y, z }
    dimensions  JSONB,          -- { width, height, depth }

    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_containers_org ON containers(org_id);
CREATE INDEX idx_containers_type ON containers(type);
CREATE INDEX idx_containers_parent ON containers(parent_id);
CREATE INDEX idx_containers_name ON containers USING gin(to_tsvector('simple', name));
```

### 3.2 base_attrs 按类型的Schema定义

| type | base_attrs 字段 |
|------|----------------|
| campus | `{ "address": "", "area_sqm": 0, "description": "" }` |
| building | `{ "built_year": 0, "total_floors": 0, "area_sqm": 0, "address": "" }` |
| floor | `{ "level": 0, "height_m": 0, "area_sqm": 0 }` |
| room | `{ "room_number": "", "area_sqm": 0, "capacity": 0, "room_type": "classroom|office|lab|dormitory|meeting|utility" }` |
| resource | `{ "resource_type": "desk|projector|whiteboard|bed", "status": "available|in_use|maintenance" }` |

### 3.3 组织与多租户

```sql
-- 组织表（最顶层容器）
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(128) NOT NULL,
    slug        VARCHAR(64) UNIQUE NOT NULL,  -- URL友好标识，如 bupt
    org_type    VARCHAR(32) NOT NULL,  -- campus|hospital|government|enterprise
    description TEXT,
    invite_code VARCHAR(32) UNIQUE,     -- 邀请码，用于快速加入
    logo_url    VARCHAR(512),
    base_attrs  JSONB NOT NULL DEFAULT '{}',
    ext_attrs   JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 组织-用户关联（多对多，支持多组织切换）
CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(16) NOT NULL DEFAULT 'member',  -- owner|admin|member
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(org_id);
```

**多租户数据隔离策略**：每个组织拥有独立的容器树根节点。容器表中通过 `org_id` 字段实现数据隔离，所有查询必须带 org_id 条件。

### 3.4 权限模型（渐进式）

**Phase 1-5（简单角色）**：
- `owner`：组织创建者，拥有全部权限
- `admin`：可管理数据、审核预约
- `member`：可查询、预约

**Phase 6（容器级细粒度权限，预留）**：
```sql
-- 容器级权限表（Phase 6实现）
CREATE TABLE container_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
    permission  VARCHAR(16) NOT NULL,  -- view|edit|manage
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, user_id, container_id)
);
```

### 3.5 预约系统

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(64) UNIQUE NOT NULL,
    password    VARCHAR(256) NOT NULL,  -- bcrypt hash
    display_name VARCHAR(128) NOT NULL,
    role        VARCHAR(16) NOT NULL DEFAULT 'user',  -- admin|user
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.4 预约系统

```sql
CREATE TABLE reservations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES containers(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    title       VARCHAR(256),
    start_time  TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time    TIMESTAMP WITH TIME ZONE NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|cancelled
    reviewed_by UUID REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reservations_room_time ON reservations(room_id, start_time, end_time);
CREATE INDEX idx_reservations_user ON reservations(user_id);
```

---

## 4. API设计

### 4.1 RESTful API 概览

基础路径：`/api/v1`

| 模块 | 方法 | 路径 | 描述 |
|------|------|------|------|
| **认证** | POST | `/auth/login` | 登录 |
| | POST | `/auth/register` | 注册 |
| | GET | `/auth/me` | 当前用户信息 |
| **组织** | GET | `/orgs` | 我加入的组织列表 |
| | POST | `/orgs` | 创建组织 |
| | GET | `/orgs/{slug}` | 组织详情 |
| | POST | `/orgs/{slug}/join` | 加入组织（邀请码） |
| | DELETE | `/orgs/{slug}/leave` | 退出组织 |
| | GET | `/orgs/{slug}/members` | 组织成员列表 |
| | PUT | `/orgs/{slug}/members/{uid}` | 修改成员角色 |
| **容器** | GET | `/orgs/{slug}/containers` | 查询容器列表 |
| | GET | `/containers/{id}` | 获取容器详情 |
| | GET | `/containers/{id}/children` | 获取子容器 |
| | POST | `/containers` | 创建容器（管理员） |
| | PUT | `/containers/{id}` | 更新容器（管理员） |
| | DELETE | `/containers/{id}` | 删除容器（管理员） |
| **预约** | GET | `/reservations` | 查询预约列表 |
| | GET | `/reservations/{id}` | 预约详情 |
| | POST | `/reservations` | 创建预约 |
| | PUT | `/reservations/{id}/approve` | 审核通过（管理员） |
| | PUT | `/reservations/{id}/reject` | 审核拒绝（管理员） |
| | DELETE | `/reservations/{id}` | 取消预约 |
| | GET | `/rooms/{id}/schedule` | 查看房间日程 |
| **统计** | GET | `/stats/usage` | 空间利用率统计 |
| | GET | `/stats/reservation-trends` | 预约趋势 |
| **数据** | POST | `/data/import` | 导入BMTS Schema数据 |
| | GET | `/data/export` | 导出为BMTS Schema格式 |

---

## 5. 前端架构

### 5.1 项目结构

```
bmts-frontend/
├── public/
├── src/
│   ├── assets/              # 静态资源
│   ├── components/          # 通用组件
│   │   ├── common/          # 通用UI组件
│   │   └── three/           # Three.js相关组件
│   ├── composables/         # Vue Composition API hooks
│   │   ├── useThree.ts      # 3D场景管理
│   │   ├── useContainer.ts  # 容器数据操作
│   │   └── useReservation.ts# 预约操作
│   ├── layouts/             # 布局组件
│   │   ├── DesktopLayout.vue
│   │   └── MobileLayout.vue
│   ├── pages/               # 页面
│   │   ├── Login.vue
│   │   ├── OrgList.vue      # 我加入的组织列表
│   │   ├── OrgJoin.vue      # 加入/创建组织
│   │   ├── Campus.vue       # 校园全景
│   │   ├── Building.vue     # 建筑详情
│   │   ├── Admin.vue        # 管理后台
│   │   └── Profile.vue      # 个人中心（我的预约等）
│   ├── stores/              # Pinia stores
│   │   ├── auth.ts
│   │   ├── org.ts           # 当前组织状态
│   │   ├── container.ts
│   │   └── reservation.ts
│   ├── types/               # TypeScript类型定义
│   │   └── container.ts     # 容器模型类型
│   ├── utils/               # 工具函数
│   ├── api/                 # API调用封装
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 5.2 3D场景设计

**渲染层次**：
- 校园层：俯视图，建筑为简化的长方体，不同类型用不同颜色区分
- 建筑层：可展开查看楼层，楼层为水平切片，房间用颜色区分状态
- 房间层：点击房间后高亮，弹出详情面板

**交互方式**：
- 鼠标左键点击：选中建筑/楼层/房间
- 鼠标滚轮：缩放
- 鼠标右键拖拽：旋转视角
- 双击：进入下一层级（如双击建筑进入楼层视图）

**颜色编码**：
- 空闲房间：绿色
- 使用中：蓝色
- 已预约：橙色
- 维护中：灰色

**移动端适配策略**：
- PC端（≥768px）：完整3D视图 + 侧边面板
- 移动端（<768px）：2D楼层平面图替代3D，底部Tab导航，核心功能（查询、预约、我的）可用
- 3D场景在移动端降级为可交互的SVG/Canvas平面图，保持颜色编码一致

---

## 6. 后端架构

### 6.1 项目结构

```
bmts-backend/
├── app/
│   ├── main.py              # FastAPI入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models/              # SQLAlchemy模型
│   │   ├── container.py
│   │   ├── organization.py
│   │   ├── user.py
│   │   └── reservation.py
│   ├── schemas/             # Pydantic Schema（请求/响应模型）
│   │   ├── container.py
│   │   ├── organization.py
│   │   ├── user.py
│   │   └── reservation.py
│   ├── api/                 # API路由
│   │   ├── auth.py
│   │   ├── organizations.py
│   │   ├── containers.py
│   │   ├── reservations.py
│   │   ├── stats.py
│   │   └── data.py
│   ├── services/            # 业务逻辑层
│   │   ├── container_service.py
│   │   ├── organization_service.py
│   │   ├── reservation_service.py
│   │   └── stats_service.py
│   └── utils/               # 工具函数
├── alembic/                 # 数据库迁移
├── tests/                   # 测试
├── requirements.txt
└── pyproject.toml
```

### 6.2 BMTS Schema 规范（v0.1草案）

```json
{
  "$schema": "https://bmts.dev/schema/v0.1",
  "version": "0.1.0",
  "campus": {
    "id": "uuid",
    "name": "校园名称",
    "baseAttrs": {
      "address": "地址",
      "areaSqm": 100000,
      "description": "描述"
    },
    "extAttrs": {},
    "children": [
      {
        "type": "building",
        "id": "uuid",
        "name": "建筑名称",
        "baseAttrs": {
          "builtYear": 2020,
          "totalFloors": 6,
          "areaSqm": 5000
        },
        "extAttrs": {},
        "position": { "x": 0, "y": 0, "z": 0 },
        "dimensions": { "width": 50, "height": 24, "depth": 20 },
        "children": [
          {
            "type": "floor",
            "name": "1F",
            "baseAttrs": { "level": 1, "heightM": 4, "areaSqm": 800 },
            "children": [
              {
                "type": "room",
                "name": "101教室",
                "baseAttrs": {
                  "roomNumber": "101",
                  "areaSqm": 60,
                  "capacity": 50,
                  "roomType": "classroom"
                },
                "extAttrs": {
                  "hasProjector": true,
                  "hasWhiteboard": true
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 7. 开发路线图

### Phase 0：基础搭建
- [ ] 前端脚手架（Vite + Vue 3 + TS + Element Plus + Pinia）
- [ ] 后端脚手架（FastAPI + SQLAlchemy + Alembic）
- [ ] 数据库设计与迁移
- [ ] 前后端联调跑通（健康检查接口）
- [ ] 项目目录结构和代码规范

### Phase 1：平台层核心
- [ ] 容器CRUD API
- [ ] 3D场景初始化（Three.js + Vue集成）
- [ ] 单栋建筑3D渲染（楼层+房间）
- [ ] 点击房间高亮+信息面板
- [ ] 楼层切换功能
- [ ] 左侧导航树

### Phase 2：功能层
- [ ] 用户认证（登录/注册/JWT）
- [ ] 房间占用状态展示（3D颜色编码）
- [ ] 预约API和界面
- [ ] 预约审核流程
- [ ] 我的预约页面
- [ ] 数据录入/编辑界面

### Phase 3：规范层
- [ ] BMTS Schema JSON Schema定义
- [ ] 数据导入功能
- [ ] 数据导出功能
- [ ] Schema验证工具
- [ ] 规范文档

### Phase 4：智能层
- [ ] 空间利用率统计API和图表
- [ ] 预约趋势分析
- [ ] 智能预约推荐算法
- [ ] 异常占用检测

### Phase 5：跨尺度缩放
- [ ] 校园全景3D场景
- [ ] 缩放过渡动画
- [ ] 面包屑导航
- [ ] 跨级搜索功能

### Phase 6：多组织与细粒度权限
- [ ] 组织CRUD API
- [ ] 加入组织（搜索/邀请码）
- [ ] 组织切换界面
- [ ] 组织内角色管理
- [ ] 容器级权限系统
- [ ] 个人视图（我的教室、我的预约）
- [ ] 移动端响应式适配（2D平面图 + Tab导航）

---

## 8. 技术风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| Three.js与Vue集成复杂度 | 中 | 使用composable封装3D逻辑，保持3D代码与Vue组件解耦 |
| 大量房间3D渲染性能 | 中 | 采用LOD（细节层次）策略，远处房间合并渲染，近处才显示细节 |
| 分级容器查询性能 | 低 | PostgreSQL递归查询（CTE），加parent_id索引 |
| 扩展属性查询困难 | 中 | PostgreSQL JSONB支持GIN索引，可对ext_attrs建索引 |
| AI推荐冷启动 | 低 | 初期使用规则引擎，数据积累后切换ML模型 |
| 多租户数据泄露 | 高 | 所有API强制带org_id，中间件层统一校验，禁止跨组织查询 |
| 移动端3D性能差 | 中 | 移动端降级为2D平面图，3D仅在PC端渲染 |
