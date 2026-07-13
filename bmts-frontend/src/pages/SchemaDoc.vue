<template>
  <div class="schema-page">
    <div class="schema-header">
      <h2>BMTS Schema 规范文档</h2>
      <el-button @click="router.push('/')">返回首页</el-button>
    </div>

    <div class="schema-body">
      <el-card class="info-card">
        <h3>什么是 BMTS Schema？</h3>
        <p>
          BMTS Schema 是建筑模块化孪生系统的开放数据规范，定义了建筑空间数据的标准化格式。
          任何遵循此规范的 JSON/YAML 数据都可以被 BMTS 平台导入和使用。
        </p>
      </el-card>

      <el-card class="info-card">
        <h3>数据结构层级</h3>
        <div class="hierarchy">
          <div v-for="item in hierarchy" :key="item.type" class="hierarchy-item" :style="{ paddingLeft: item.level * 24 + 'px' }">
            <el-tag :type="item.tag" size="small">{{ item.type }}</el-tag>
            <span class="hierarchy-desc">{{ item.desc }}</span>
          </div>
        </div>
      </el-card>

      <el-card class="info-card">
        <h3>示例数据</h3>
        <div class="code-block">
          <el-button text size="small" style="float: right" @click="copyExample">复制</el-button>
          <pre><code>{{ exampleData }}</code></pre>
        </div>
      </el-card>

      <el-card class="info-card">
        <h3>属性说明</h3>
        <el-table :data="attrTable" size="small">
          <el-table-column prop="container" label="容器类型" width="100" />
          <el-table-column prop="attr" label="属性名" width="150" />
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="required" label="必填" width="80">
            <template #default="{ row }">
              <el-tag :type="row.required ? 'danger' : 'info'" size="small">{{ row.required ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="desc" label="说明" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

const hierarchy = [
  { type: 'campus', level: 0, desc: '校园/组织 — 最顶层容器', tag: '' },
  { type: 'building', level: 1, desc: '建筑 — 校园内的建筑', tag: 'success' },
  { type: 'floor', level: 2, desc: '楼层 — 建筑内的楼层', tag: 'warning' },
  { type: 'room', level: 3, desc: '房间 — 楼层内的房间', tag: 'info' },
  { type: 'resource', level: 4, desc: '设备/工位 — 房间内的资源', tag: 'danger' },
]

const attrTable = [
  { container: 'campus', attr: 'baseAttrs.address', type: 'string', required: false, desc: '校园地址' },
  { container: 'campus', attr: 'baseAttrs.areaSqm', type: 'number', required: false, desc: '校园面积（平方米）' },
  { container: 'building', attr: 'baseAttrs.builtYear', type: 'integer', required: false, desc: '建成年份' },
  { container: 'building', attr: 'baseAttrs.totalFloors', type: 'integer', required: false, desc: '总楼层数' },
  { container: 'floor', attr: 'baseAttrs.level', type: 'integer', required: false, desc: '楼层号（负数为地下室）' },
  { container: 'floor', attr: 'baseAttrs.heightM', type: 'number', required: false, desc: '层高（米）' },
  { container: 'room', attr: 'baseAttrs.roomNumber', type: 'string', required: false, desc: '房间号' },
  { container: 'room', attr: 'baseAttrs.capacity', type: 'integer', required: false, desc: '容纳人数' },
  { container: 'room', attr: 'baseAttrs.roomType', type: 'enum', required: false, desc: 'classroom|lab|office|meeting|...' },
  { container: '*', attr: 'extAttrs', type: 'object', required: false, desc: '自定义扩展属性（任意键值对）' },
  { container: '*', attr: 'position', type: '{x,y,z}', required: false, desc: '3D空间位置坐标' },
  { container: '*', attr: 'dimensions', type: '{w,h,d}', required: false, desc: '3D空间尺寸' },
]

const exampleData = `{
  "version": "0.1.0",
  "campus": {
    "name": "示例大学",
    "baseAttrs": { "address": "北京市海淀区", "areaSqm": 100000 },
    "children": [
      {
        "name": "教学楼A",
        "baseAttrs": { "builtYear": 2020, "totalFloors": 5 },
        "position": { "x": 0, "y": 0, "z": 0 },
        "dimensions": { "width": 50, "height": 20, "depth": 20 },
        "children": [
          {
            "name": "1F",
            "baseAttrs": { "level": 1, "heightM": 4 },
            "children": [
              {
                "name": "101教室",
                "baseAttrs": { "roomNumber": "101", "capacity": 50, "roomType": "classroom" },
                "extAttrs": { "hasProjector": true },
                "position": { "x": 0, "y": 0, "z": 0 },
                "dimensions": { "width": 8, "height": 3.5, "depth": 7 }
              }
            ]
          }
        ]
      }
    ]
  }
}`

function copyExample() {
  navigator.clipboard.writeText(exampleData)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped>
.schema-page {
  height: 100vh;
  background: #0a1628;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.schema-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #1e3a5f;
}
.schema-header h2 { color: #64b5f6; margin: 0; }
.schema-body {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}
.info-card {
  margin-bottom: 16px;
  background: #0f2744;
  border: 1px solid #1e3a5f;
}
.info-card h3 { color: #64b5f6; margin-bottom: 12px; }
.info-card p { color: #b0bec5; line-height: 1.6; }
.hierarchy-item {
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e0e6ed;
}
.hierarchy-desc { font-size: 13px; color: #90a4ae; }
.code-block {
  background: #0a1628;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}
.code-block pre { color: #b0bec5; margin: 0; font-size: 13px; }
</style>
