<template>
  <el-dialog :visible="visible" :title="dialogTitle" width="560px" :close-on-click-modal="false" @close="handleClose">
    <el-form label-width="90px">
      <el-form-item label="容器类型">
        <el-select v-model="form.type" style="width:100%" @change="onTypeChange" :disabled="lockType">
          <el-option label="建筑" value="building" />
          <el-option label="楼层" value="floor" />
          <el-option label="房间" value="room" />
          <el-option label="物品" value="resource" />
        </el-select>
      </el-form-item>
      <el-form-item label="父容器">
        <el-select v-model="form.parentId" style="width:100%" :disabled="lockParentId">
          <el-option label="无（顶层）" :value="null" />
          <el-option
            v-for="container in parentOptions"
            :key="container.id"
            :label="container.name"
            :value="container.id"
          />
        </el-select>
        <span v-if="lockParentId" class="lock-hint">已锁定为当前场景</span>
      </el-form-item>
      <el-form-item label="名称">
        <el-input v-model="form.name" :placeholder="namePlaceholder" />
      </el-form-item>
      <el-divider content-position="left">固有属性</el-divider>
      <div v-for="(attr, idx) in form.baseAttrs" :key="'b'+idx" class="kv-row">
        <el-input v-model="attr.key" placeholder="属性名" size="small" style="width:150px" />
        <el-input v-model="attr.value" placeholder="数值" size="small" style="flex:1" />
        <el-button type="danger" text size="small" @click="form.baseAttrs.splice(idx, 1)">删除</el-button>
      </div>
      <el-button type="primary" text size="small" @click="form.baseAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
      <el-divider content-position="left">扩展属性</el-divider>
      <div v-for="(attr, idx) in form.extAttrs" :key="'e'+idx" class="kv-row">
        <el-input v-model="attr.key" placeholder="属性名" size="small" style="width:150px" />
        <el-input v-model="attr.value" placeholder="数值" size="small" style="flex:1" />
        <el-button type="danger" text size="small" @click="form.extAttrs.splice(idx, 1)">删除</el-button>
      </div>
      <el-button type="primary" text size="small" @click="form.extAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
      <el-divider content-position="left" v-if="showPosition">3D位置与尺寸</el-divider>
      <div v-if="showPosition" class="kv-row">
        <span class="pos-label">X</span><el-input-number v-model="form.position.x" size="small" :step="posStep" />
        <span class="pos-label">Z</span><el-input-number v-model="form.position.z" size="small" :step="posStep" />
      </div>
      <div v-if="showPosition" class="kv-row" style="margin-top:8px">
        <span class="pos-label">宽</span><el-input-number v-model="form.dimensions.width" size="small" :min="dimMin" :step="dimStep" />
        <span class="pos-label">高</span><el-input-number v-model="form.dimensions.height" size="small" :min="dimMin" :step="dimStep" />
        <span class="pos-label">深</span><el-input-number v-model="form.dimensions.depth" size="small" :min="dimMin" :step="dimStep" />
      </div>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { containerApi } from '../api/containers'
import { useContainerStore } from '../stores/container'
import { ElMessage } from 'element-plus'

interface AttrItem { key: string; value: string }

const props = defineProps<{
  visible: boolean
  orgId: string
  parentId?: string | null
  type?: 'building' | 'floor' | 'room' | 'resource'
  position?: { x: number; z: number }
  lockParentId?: boolean
  lockType?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const store = useContainerStore()
const loading = ref(false)

const form = ref({
  type: 'building' as 'building' | 'floor' | 'room' | 'resource',
  parentId: props.parentId || null,
  name: '',
  baseAttrs: [] as AttrItem[],
  extAttrs: [] as AttrItem[],
  position: { x: 0, z: 0 },
  dimensions: { width: 10, height: 5, depth: 8 },
})

watch(() => props.type, (newType) => {
  if (newType) form.value.type = newType
})

watch(() => props.parentId, (newParentId) => {
  if (newParentId !== undefined) form.value.parentId = newParentId
})

watch(() => props.position, (newPos) => {
  if (newPos) {
    form.value.position.x = newPos.x
    form.value.position.z = newPos.z
  }
})

watch(() => props.visible, (val) => {
  if (val) {
    resetForm()
  }
})

const typeLabels: Record<string, string> = {
  building: '建筑',
  floor: '楼层',
  room: '房间',
  resource: '物品',
}

const dialogTitle = computed(() => `新建${typeLabels[form.value.type]}`)

const namePlaceholder = computed(() => {
  const placeholders: Record<string, string> = {
    building: '如：教学楼B',
    floor: '如：6F',
    room: '如：601教室',
    resource: '如：投影仪',
  }
  return placeholders[form.value.type]
})

const showPosition = computed(() => {
  return form.value.type === 'building' || form.value.type === 'room' || form.value.type === 'resource'
})

const posStep = computed(() => {
  return form.value.type === 'room' ? 2 : 5
})

const dimMin = computed(() => {
  return form.value.type === 'room' ? 3 : 5
})

const dimStep = computed(() => {
  return form.value.type === 'room' ? 0.5 : 1
})

const lockParentId = computed(() => props.lockParentId || false)
const lockType = computed(() => props.lockType || false)

const parentOptions = computed(() => {
  const options: { id: string; name: string }[] = []
  const collectContainers = (node: any, prefix = '') => {
    if (node.id && node.name) {
      options.push({ id: node.id, name: `${prefix}${node.name}` })
    }
    if (node.children) {
      for (const child of node.children) {
        collectContainers(child, prefix + '　')
      }
    }
  }
  if (store.tree.length > 0) {
    collectContainers(store.tree[0])
  }
  return options
})

function getDefaultAttrs(type: string): AttrItem[] {
  const defaults: Record<string, AttrItem[]> = {
    building: [
      { key: 'area_sqm', value: '' },
      { key: 'total_floors', value: '' },
      { key: 'built_year', value: '' },
    ],
    floor: [
      { key: 'level', value: '' },
      { key: 'height_m', value: '4' },
      { key: 'area_sqm', value: '' },
    ],
    room: [
      { key: 'room_number', value: '' },
      { key: 'area_sqm', value: '' },
      { key: 'capacity', value: '' },
      { key: 'room_type', value: 'classroom' },
    ],
    resource: [
      { key: 'asset_code', value: '' },
      { key: 'manufacturer', value: '' },
      { key: 'purchase_date', value: '' },
    ],
  }
  return defaults[type] || []
}

function onTypeChange() {
  form.value.baseAttrs = getDefaultAttrs(form.value.type)
  if (form.value.type === 'building') {
    form.value.dimensions = { width: 20, height: 15, depth: 15 }
  } else if (form.value.type === 'room') {
    form.value.dimensions = { width: 8, height: 3.5, depth: 7 }
  } else if (form.value.type === 'resource') {
    form.value.dimensions = { width: 1, height: 1.5, depth: 0.5 }
  }
}

function resetForm() {
  form.value.name = ''
  form.value.baseAttrs = getDefaultAttrs(form.value.type)
  form.value.extAttrs = []
  if (!props.position) {
    form.value.position = { x: 0, z: 0 }
  }
}

function parseValue(v: string) {
  if (v === '' || v === undefined) return ''
  const n = Number(v)
  if (!isNaN(n)) return n
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

async function handleSubmit() {
  if (!form.value.name) {
    ElMessage.warning('请输入名称')
    return
  }
  loading.value = true
  try {
    const baseAttrs: Record<string, any> = {}
    for (const attr of form.value.baseAttrs) {
      if (attr.key) baseAttrs[attr.key] = parseValue(attr.value)
    }
    const extAttrs: Record<string, any> = {}
    for (const attr of form.value.extAttrs) {
      if (attr.key) extAttrs[attr.key] = parseValue(attr.value)
    }
    const payload: any = {
      org_id: props.orgId,
      type: form.value.type,
      name: form.value.name,
      parent_id: form.value.parentId || undefined,
      base_attrs: Object.keys(baseAttrs).length ? baseAttrs : undefined,
      ext_attrs: Object.keys(extAttrs).length ? extAttrs : undefined,
    }
    if (showPosition.value) {
      payload.position = { x: form.value.position.x, y: 0, z: form.value.position.z }
      payload.dimensions = form.value.dimensions
    }
    await containerApi.create(payload)
    ElMessage.success(`${typeLabels[form.value.type]}创建成功`)
    emit('created')
    handleClose()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '创建失败')
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.pos-label {
  color: #718096;
  font-size: 13px;
  min-width: 20px;
}
.lock-hint {
  display: block;
  color: #a0aec0;
  font-size: 12px;
  margin-top: 4px;
}
</style>
