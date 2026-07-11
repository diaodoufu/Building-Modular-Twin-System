# BMTS Schema 规范

## 概述

BMTS Schema 是一套开放的建筑空间数据规范，定义了如何用 JSON 格式描述建筑空间的层级结构、属性和 3D 信息。它的目标是让任何建筑空间数据都可以被标准化地描述、交换和验证。

## 版本

当前版本：**v0.1**

Schema 文件位于：`bmts-backend/app/schemas/bmts_schema_v0.1.json`

## Schema 结构

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

## 数据导入

通过 `POST /api/v1/data/import` 接口导入数据，支持以下格式：

- **JSON**：标准 JSON 格式
- **YAML**：YAML 格式（自动转换为 JSON）

导入时会自动进行 Schema 验证，确保数据符合规范。

### 导入示例

```bash
# JSON 导入
curl -X POST http://localhost:8000/api/v1/data/import \
  -H "Content-Type: application/json" \
  -d @campus_data.json

# YAML 导入
curl -X POST http://localhost:8000/api/v1/data/import?format=yaml \
  -H "Content-Type: application/yaml" \
  -d @campus_data.yaml
```

## 数据导出

通过 `GET /api/v1/data/export` 接口导出当前数据，支持 JSON 和 YAML 格式。

## 编码兼容

BMTS 数据导入支持以下编码：
- UTF-8（推荐）
- UTF-8 with BOM
- Windows GBK（自动检测并转换）

## 设计目标

1. **开放**：任何人都可以使用 BMTS Schema 描述建筑空间
2. **标准化**：统一的数据格式便于不同系统之间的数据交换
3. **可验证**：JSON Schema 定义确保数据质量
4. **可扩展**：extAttrs 机制支持任意自定义属性
