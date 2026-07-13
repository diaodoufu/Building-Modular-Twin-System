<template>
  <div class="admin-page">
    <div class="admin-header">
      <h2>数据管理</h2>
      <div style="display: flex; align-items: center; gap: 8px">
        <div style="display: flex; gap: 8px">
          <el-upload
            :show-file-list="false"
            :before-upload="handleImport"
            accept=".json,.yaml,.yml"
          >
            <el-button type="success" size="small">导入数据</el-button>
          </el-upload>
          <el-dropdown @command="handleExport">
            <el-button type="warning" size="small">导出数据</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="json">JSON格式</el-dropdown-item>
                <el-dropdown-item command="yaml">YAML格式</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-button @click="router.push('/')">返回首页</el-button>
      </div>
    </div>

    <div class="admin-body">
      <!-- 左侧：容器树 -->
      <div class="tree-panel">
        <div class="panel-header">
          <span>容器结构</span>
          <el-button type="primary" size="small" @click="openCreateDialog(null)">+ 新建</el-button>
        </div>
        <el-tree
          v-if="treeData.length"
          :data="treeData"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          highlight-current
          :default-expand-all="true"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <el-tag size="small" :type="typeTag(data.type)" style="margin-right: 4px">{{ typeLabel(data.type) }}</el-tag>
              <span>{{ data.name }}</span>
              <span class="tree-actions">
                <el-button text size="small" @click.stop="openCreateDialog(data)">+</el-button>
                <el-button text size="small" type="primary" @click.stop="openEditDialog(data)">编辑</el-button>
                <el-button text size="small" type="danger" @click.stop="handleDelete(data)">删除</el-button>
              </span>
            </span>
          </template>
        </el-tree>
        <el-empty v-else description="暂无数据" />
      </div>

      <!-- 右侧：编辑区域 -->
      <div class="edit-panel" v-if="selectedNode">
        <h3>{{ selectedNode.name }}</h3>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="类型">{{ typeLabel(selectedNode.type) }}</el-descriptions-item>
          <el-descriptions-item label="ID">{{ selectedNode.id }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ selectedNode.created_at }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 16px; color: #64b5f6">固有属性 (base_attrs)</h4>
        <el-table :data="baseAttrsList" size="small" style="margin-top: 8px">
          <el-table-column prop="key" label="键" width="150" />
          <el-table-column prop="value" label="值" />
        </el-table>

        <h4 style="margin-top: 16px; color: #64b5f6">扩展属性 (ext_attrs)</h4>
        <el-table :data="extAttrsList" size="small" style="margin-top: 8px">
          <el-table-column prop="key" label="键" width="150" />
          <el-table-column prop="value" label="值" />
        </el-table>
      </div>
      <div class="edit-panel" v-else>
        <el-empty description="请在左侧选择一个容器" />
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新建容器' : '编辑容器'" width="560px">
      <el-form :model="dialogForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="dialogForm.name" />
        </el-form-item>
        <el-form-item label="类型" v-if="dialogMode === 'create'">
          <el-select v-model="dialogForm.type" style="width: 100%">
            <el-option label="校园" value="campus" />
            <el-option label="建筑" value="building" />
            <el-option label="楼层" value="floor" />
            <el-option label="房间" value="room" />
            <el-option label="设备/工位" value="resource" />
          </el-select>
        </el-form-item>
        <el-form-item label="父容器" v-if="dialogMode === 'create'">
          <el-input :model-value="dialogForm.parent_name" disabled />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="dialogForm.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="固有属性">
          <div class="attr-list">
            <div v-for="(item, idx) in dialogForm.baseAttrs" :key="idx" class="attr-row">
              <el-input v-model="item.key" placeholder="属性名" size="small" style="width: 140px" />
              <el-input v-model="item.value" placeholder="数值" size="small" style="flex: 1" />
              <el-button type="danger" text size="small" @click="dialogForm.baseAttrs.splice(idx, 1)">删除</el-button>
            </div>
            <el-button type="primary" text size="small" @click="dialogForm.baseAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
          </div>
        </el-form-item>
        <el-form-item label="扩展属性">
          <div class="attr-list">
            <div v-for="(item, idx) in dialogForm.extAttrs" :key="idx" class="attr-row">
              <el-input v-model="item.key" placeholder="属性名" size="small" style="width: 140px" />
              <el-input v-model="item.value" placeholder="数值" size="small" style="flex: 1" />
              <el-button type="danger" text size="small" @click="dialogForm.extAttrs.splice(idx, 1)">删除</el-button>
            </div>
            <el-button type="primary" text size="small" @click="dialogForm.extAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
          </div>
        </el-form-item>
        <el-form-item label="位置">
          <div class="attr-list">
            <div class="attr-row">
              <el-input v-model="dialogForm.positionX" placeholder="X" size="small" style="width: 80px" />
              <el-input v-model="dialogForm.positionY" placeholder="Y" size="small" style="width: 80px" />
              <el-input v-model="dialogForm.positionZ" placeholder="Z" size="small" style="width: 80px" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="尺寸">
          <div class="attr-list">
            <div class="attr-row">
              <el-input v-model="dialogForm.dimW" placeholder="宽" size="small" style="width: 80px" />
              <el-input v-model="dialogForm.dimH" placeholder="高" size="small" style="width: 80px" />
              <el-input v-model="dialogForm.dimD" placeholder="深" size="small" style="width: 80px" />
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleDialogSubmit" :loading="dialogLoading">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { containerApi, type ContainerTreeNode } from '../api/containers'
import { dataApi } from '../api/data'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const ORG_ID = computed(() => auth.currentOrgId || '')
const treeData = ref<ContainerTreeNode[]>([])
const selectedNode = ref<ContainerTreeNode | null>(null)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)

interface AttrItem { key: string; value: string }

function objToAttrs(obj: Record<string, any>): AttrItem[] {
  return Object.entries(obj || {}).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  }))
}

function attrsToObj(attrs: AttrItem[]): Record<string, any> {
  const obj: Record<string, any> = {}
  for (const item of attrs) {
    if (!item.key.trim()) continue
    const trimmed = item.value.trim()
    if (trimmed === '' || trimmed === 'null') continue
    if (trimmed === 'true') { obj[item.key] = true; continue }
    if (trimmed === 'false') { obj[item.key] = false; continue }
    const num = Number(trimmed)
    if (!isNaN(num) && trimmed !== '') { obj[item.key] = num; continue }
    try { obj[item.key] = JSON.parse(trimmed) } catch { obj[item.key] = trimmed }
  }
  return obj
}

const dialogForm = ref({
  name: '',
  type: 'building',
  parent_id: '' as string | null,
  parent_name: '',
  sort_order: 0,
  baseAttrs: [] as AttrItem[],
  extAttrs: [] as AttrItem[],
  positionX: '',
  positionY: '',
  positionZ: '',
  dimW: '',
  dimH: '',
  dimD: '',
  editing_id: '',
})

const typeLabel = (t: string) => {
  const m: Record<string, string> = { campus: '校园', building: '建筑', floor: '楼层', room: '房间', resource: '设备' }
  return m[t] || t
}
const typeTag = (t: string) => {
  const m: Record<string, string> = { campus: '', building: 'success', floor: 'warning', room: 'info', resource: 'danger' }
  return (m[t] || 'info') as any
}

const baseAttrsList = computed(() => {
  if (!selectedNode.value?.base_attrs) return []
  return Object.entries(selectedNode.value.base_attrs).map(([key, value]) => ({ key, value: JSON.stringify(value) }))
})

const extAttrsList = computed(() => {
  if (!selectedNode.value?.ext_attrs) return []
  return Object.entries(selectedNode.value.ext_attrs).map(([key, value]) => ({ key, value: JSON.stringify(value) }))
})

async function fetchTree() {
  const { data } = await containerApi.tree(ORG_ID.value)
  treeData.value = data
}

function onNodeClick(node: ContainerTreeNode) {
  selectedNode.value = node
}

function openCreateDialog(parent: ContainerTreeNode | null) {
  dialogMode.value = 'create'
  dialogForm.value = {
    name: '',
    type: parent ? getNextType(parent.type) : 'campus',
    parent_id: parent?.id || null,
    parent_name: parent?.name || '无（顶层）',
    sort_order: 0,
    baseAttrs: [],
    extAttrs: [],
    positionX: '',
    positionY: '',
    positionZ: '',
    dimW: '',
    dimH: '',
    dimD: '',
    editing_id: '',
  }
  dialogVisible.value = true
}

function getNextType(parentType: string): string {
  const m: Record<string, string> = { campus: 'building', building: 'floor', floor: 'room', room: 'resource' }
  return m[parentType] || 'room'
}

function openEditDialog(node: ContainerTreeNode) {
  dialogMode.value = 'edit'
  dialogForm.value = {
    name: node.name,
    type: node.type,
    parent_id: null,
    parent_name: '',
    sort_order: node.sort_order || 0,
    baseAttrs: objToAttrs(node.base_attrs),
    extAttrs: objToAttrs(node.ext_attrs),
    positionX: node.position?.x != null ? String(node.position.x) : '',
    positionY: node.position?.y != null ? String(node.position.y) : '',
    positionZ: node.position?.z != null ? String(node.position.z) : '',
    dimW: node.dimensions?.width != null ? String(node.dimensions.width) : '',
    dimH: node.dimensions?.height != null ? String(node.dimensions.height) : '',
    dimD: node.dimensions?.depth != null ? String(node.dimensions.depth) : '',
    editing_id: node.id,
  }
  dialogVisible.value = true
}

async function handleDialogSubmit() {
  dialogLoading.value = true
  try {
    const baseAttrs = attrsToObj(dialogForm.value.baseAttrs)
    const extAttrs = attrsToObj(dialogForm.value.extAttrs)

    // 解析位置
    let position = null
    const px = parseFloat(dialogForm.value.positionX)
    const py = parseFloat(dialogForm.value.positionY)
    const pz = parseFloat(dialogForm.value.positionZ)
    if (!isNaN(px) && !isNaN(py) && !isNaN(pz)) {
      position = { x: px, y: py, z: pz }
    }

    // 解析尺寸
    let dimensions = null
    const dw = parseFloat(dialogForm.value.dimW)
    const dh = parseFloat(dialogForm.value.dimH)
    const dd = parseFloat(dialogForm.value.dimD)
    if (!isNaN(dw) && !isNaN(dh) && !isNaN(dd)) {
      dimensions = { width: dw, height: dh, depth: dd }
    }

    if (dialogMode.value === 'create') {
      await containerApi.create({
        org_id: ORG_ID.value,
        type: dialogForm.value.type,
        name: dialogForm.value.name,
        parent_id: dialogForm.value.parent_id,
        sort_order: dialogForm.value.sort_order,
        base_attrs: baseAttrs,
        ext_attrs: extAttrs,
        position: position || undefined,
        dimensions: dimensions || undefined,
      })
      ElMessage.success('创建成功')
    } else {
      await containerApi.update(dialogForm.value.editing_id, {
        name: dialogForm.value.name,
        sort_order: dialogForm.value.sort_order,
        base_attrs: baseAttrs,
        ext_attrs: extAttrs,
        position: position || undefined,
        dimensions: dimensions || undefined,
      })
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    await fetchTree()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '操作失败')
  } finally {
    dialogLoading.value = false
  }
}

async function handleDelete(node: ContainerTreeNode) {
  try {
    await ElMessageBox.confirm(`确认删除「${node.name}」及其所有子容器？`, '警告', { type: 'warning' })
    await containerApi.delete(node.id)
    ElMessage.success('删除成功')
    if (selectedNode.value?.id === node.id) selectedNode.value = null
    await fetchTree()
  } catch { /* cancelled */ }
}

async function handleImport(file: File) {
  if (!auth.currentOrgId) {
    ElMessage.error('请先选择组织')
    return false
  }
  try {
    const { data } = await dataApi.importFile(auth.currentOrgId, file)
    ElMessage.success(`导入成功！创建了 ${data.stats.created} 个容器`)
    await fetchTree()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '导入失败')
  }
  return false // 阻止el-upload默认上传
}

async function handleExport(format: string) {
  if (!auth.currentOrgId) {
    ElMessage.error('请先选择组织')
    return
  }
  try {
    if (format === 'json') {
      const { data } = await dataApi.exportJson(auth.currentOrgId)
      downloadFile(JSON.stringify(data, null, 2), 'bmts-export.json', 'application/json')
    } else {
      const { data } = await dataApi.exportYaml(auth.currentOrgId)
      downloadFile(data.data, 'bmts-export.yaml', 'text/yaml')
    }
    ElMessage.success('导出成功')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '导出失败')
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(fetchTree)
</script>

<style scoped>
.admin-page {
  height: 100vh;
  background: #0a1628;
  display: flex;
  flex-direction: column;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #1e3a5f;
}
.admin-header h2 {
  color: #64b5f6;
  margin: 0;
}
.admin-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.tree-panel {
  width: 360px;
  border-right: 1px solid #1e3a5f;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  color: #e0e6ed;
  border-bottom: 1px solid #1e3a5f;
}
.edit-panel {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  color: #e0e6ed;
}
.edit-panel h3 {
  color: #64b5f6;
  margin-bottom: 16px;
}
.tree-node {
  display: flex;
  align-items: center;
  flex: 1;
  font-size: 13px;
}
.tree-actions {
  margin-left: auto;
  display: none;
}
.tree-node:hover .tree-actions {
  display: inline-flex;
}
.attr-list {
  width: 100%;
}
.attr-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
</style>
