# 贡献指南

感谢你对 BMTS 项目的关注！欢迎以任何形式参与贡献。

## 如何贡献

### 报告 Bug

1. 在 [Issues](../../issues) 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含以下信息：
   - 问题描述
   - 复现步骤
   - 期望行为 vs 实际行为
   - 环境信息（浏览器、Python 版本、Node 版本等）
   - 相关日志或截图

### 提交功能建议

1. 在 [Issues](../../issues) 中创建新 Issue
2. 标记为 `enhancement`
3. 描述功能需求、使用场景和预期效果

### 提交代码

#### 开发环境准备

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/<your-username>/BMTS.git
cd BMTS

# 2. 后端设置
cd bmts-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # 配置数据库连接

# 3. 前端设置
cd ../bmts-frontend
npm install
```

#### 开发流程

1. 从 `main` 分支创建功能分支：
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. 编写代码，确保符合现有代码风格
3. 提交更改，使用清晰的提交信息：
   ```bash
   git commit -m "feat: add xxx feature"
   ```
4. 推送到你的 Fork：
   ```bash
   git push origin feature/your-feature-name
   ```
5. 创建 Pull Request 到主仓库的 `main` 分支

#### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>: <description>

类型：
  feat:     新功能
  fix:      Bug 修复
  docs:     文档变更
  style:    代码格式（不影响逻辑）
  refactor: 重构（不是新功能也不是修复）
  perf:     性能优化
  test:     测试相关
  chore:    构建/工具变更
```

示例：
- `feat: add room reservation conflict detection`
- `fix: resolve timezone comparison error in reservation`
- `docs: update API documentation`

### 代码规范

#### 前端（TypeScript / Vue）

- 使用 Composition API + `<script setup>` 语法
- 使用 TypeScript 严格模式
- 组件命名使用 PascalCase，文件命名使用 PascalCase.vue
- API 调用统一封装在 `src/api/` 目录

#### 后端（Python / FastAPI）

- 遵循 PEP 8 代码风格
- 使用 type hints
- API 路由在 `app/api/`，业务逻辑在 `app/services/`
- 数据模型在 `app/models/`，Schema 验证在 `app/schemas/`

### Pull Request 检查清单

- [ ] 代码能正常运行（前后端均启动无报错）
- [ ] 提交信息符合 Conventional Commits 规范
- [ ] 新功能涉及 API 变更时，更新了相关文档
- [ ] 不包含 `.env` 文件或敏感信息

## 项目结构

```
BMTS/
├── bmts-frontend/    # Vue 3 + TypeScript 前端
├── bmts-backend/     # FastAPI 后端
├── docs/             # 项目文档（PRD、SPEC）
└── wiki/             # GitHub Wiki 内容
```

## 开发阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0-5 | 基础搭建 → 跨尺度缩放 | ✅ 已完成 |
| Phase 6 | 多组织 SaaS | 🚧 开发中 |

详细的阶段划分请参考 [PRD.md](docs/PRD.md)。

## 联系方式

如有问题，请通过 [Issues](../../issues) 或 [Discussions](../../discussions) 联系。
