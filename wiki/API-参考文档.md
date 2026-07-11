# API 参考文档

> 完整的交互式 API 文档请访问运行中的后端 `http://localhost:8000/docs`（Swagger UI）

## 基础信息

- 基础路径：`/api/v1`
- 认证方式：Bearer Token（JWT）
- Content-Type：`application/json`

## 认证模块

### POST /auth/login

登录获取 Token。

**请求体**：
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应**：
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": "uuid", "username": "admin", "role": "admin" }
}
```

### POST /auth/register

注册新用户。

**请求体**：
```json
{
  "username": "newuser",
  "password": "password123",
  "display_name": "新用户"
}
```

### GET /auth/me

获取当前用户信息。需要 Bearer Token。

## 容器模块

### GET /containers/{id}

获取容器详情，返回完整属性（含 baseAttrs、extAttrs、position、dimensions）。

### GET /containers/{id}/children

获取指定容器的子容器列表。

**查询参数**：
- `type`：按类型过滤（campus/building/floor/room/resource）

### POST /containers

创建新容器。需要管理员权限。

**请求体**：
```json
{
  "name": "新建筑",
  "type": "building",
  "parent_id": "campus-uuid",
  "base_attrs": { "built_year": 2024, "total_floors": 5 },
  "ext_attrs": {},
  "position": { "x": 10, "y": 0, "z": 5 },
  "dimensions": { "width": 40, "height": 20, "depth": 15 }
}
```

### PUT /containers/{id}

更新容器。需要管理员权限。

### DELETE /containers/{id}

删除容器（级联删除子容器）。需要管理员权限。

## 预约模块

### POST /reservations

创建预约。需要登录。

**请求体**：
```json
{
  "room_id": "room-uuid",
  "title": "小组讨论",
  "start_time": "2026-07-12T14:00:00",
  "end_time": "2026-07-12T16:00:00"
}
```

**注意**：前端传入的时间视为 CST（UTC+8），后端自动转换为 UTC 存储。

### PUT /reservations/{id}/approve

审核通过。需要管理员权限。

### PUT /reservations/{id}/reject

审核拒绝。需要管理员权限。

### DELETE /reservations/{id}

取消预约。仅预约本人或管理员可操作。

### GET /rooms/{id}/schedule

查看房间日程。返回指定日期的已占用时间段。

**查询参数**：
- `date`：日期，格式 YYYY-MM-DD

## 统计模块

### GET /stats/usage

空间利用率统计。返回按建筑/房间类型分组的利用率数据。

### GET /stats/reservation-trends

预约趋势分析。

**查询参数**：
- `days`：统计天数（7/14/30），默认 7

### GET /stats/recommend

智能预约推荐。

**查询参数**：
- `date`：目标日期
- `duration`：所需时长（分钟）

### GET /stats/anomalies

异常占用检测。返回过期未审核、频繁预约、潜在爽约等异常列表。

## 数据模块

### POST /data/import

导入 BMTS Schema 格式数据。支持 JSON 和 YAML。

**查询参数**：
- `format`：json 或 yaml，默认 json

### GET /data/export

导出当前数据为 BMTS Schema 格式。

**查询参数**：
- `format`：json 或 yaml，默认 json

## 健康检查

### GET /api/v1/health

服务健康检查。
