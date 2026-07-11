# FAQ（常见问题）

## 部署相关

### Q: 启动后端报数据库连接错误？

确保 PostgreSQL 正在运行，且 `.env` 中的 `DATABASE_URL` 配置正确：
```
DATABASE_URL=postgresql+asyncpg://用户名:密码@localhost:5432/bmts
```
同时确保数据库 `bmts` 已创建：
```sql
CREATE DATABASE bmts;
```

### Q: 前端启动后无法连接后端？

1. 确认后端已启动（访问 http://localhost:8000/docs）
2. 检查前端 `src/api/index.ts` 中的 baseURL 是否正确指向后端地址
3. 后端默认允许跨域，如果修改过 CORS 配置请确认

### Q: seed.py 执行报错？

1. 确认 PostgreSQL 已启动且数据库已创建
2. 确认 `.env` 文件存在且配置正确
3. 如果表已存在，可以尝试清空数据后重新执行

## 功能相关

### Q: 预约时间报错 TypeError？

这是因为前端传入的 naive datetime 和后端的 aware datetime 比较导致的。当前版本已修复：后端自动将前端时间视为 CST（UTC+8）并转换为 UTC 存储。请确保后端代码是最新的。

### Q: 管理员看不到审核入口？

审核入口位于导航栏中，仅管理员角色可见。如果看不到：
1. 确认使用 admin 账号登录
2. 刷新页面

### Q: 导入数据时编码错误？

BMTS 支持自动检测 UTF-8（含 BOM）和 Windows GBK 编码。如果仍然出错，请将文件转为 UTF-8 编码后重试。

### Q: 首页只显示一栋建筑？

可能存在重复的校园数据。检查数据库中 `containers` 表，确保只有一个 type='campus' 的记录，或者使用 seed.py 重新初始化数据。

## 开发相关

### Q: 如何添加新的房间类型？

1. 在后端 `app/models/models.py` 的 room type 枚举中添加新类型
2. 在前端 3D 场景中为新类型指定颜色
3. 在 BMTS Schema 中更新 room_type 定义

### Q: 如何自定义扩展属性？

扩展属性（extAttrs）无需改代码即可使用。在创建或编辑容器时，在属性面板中添加"新增属性"即可。后端使用 JSONB 字段存储，天然支持任意键值对。

### Q: 3D 场景渲染卡顿？

- 减少同时渲染的房间数量
- 使用 LOD 策略，远处简化渲染
- 检查是否有重复创建的 3D 对象（未清理）

## 其他

### Q: 这个项目可以用于生产环境吗？

BMTS 目前是学习/练手项目，不建议直接用于生产环境。如果需要，请至少完成以下加固：
- 修改 SECRET_KEY
- 使用 HTTPS
- 添加速率限制
- 引入正式的数据库迁移工具（Alembic）
- 完善单元测试和集成测试
