<template>
  <div class="building-page">
    <!-- 面包屑导航 -->
    <div class="breadcrumb-bar">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item @click="router.push('/campus')">校园全景</el-breadcrumb-item>
        <el-breadcrumb-item v-if="campusName" @click="router.push('/')">{{ campusName }}</el-breadcrumb-item>
        <el-breadcrumb-item>{{ buildingName }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <div class="sidebar">
      <h3>{{ buildingName }}</h3>
      <div class="floor-selector">
        <el-button
          v-for="floor in floors"
          :key="floor.id"
          :type="selectedFloorId === floor.id ? 'primary' : 'default'"
          size="small"
          @click="selectFloor(floor)"
          style="margin: 2px"
        >
          {{ floor.name }}
        </el-button>
        <el-button v-if="auth.isAdmin" type="success" size="small" @click="showAddFloor = true" style="margin: 2px">
          +楼层
        </el-button>
      </div>
      <el-tree
        ref="treeRef"
        :data="floorTree"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        highlight-current
        :default-expand-all="true"
        @node-click="onNodeClick"
      />
      <div class="sidebar-footer">
        <el-button v-if="auth.isAdmin && selectedFloorId" type="success" size="small" @click="showAddRoom = true">
          新建房间
        </el-button>
        <el-button v-if="auth.isMember" type="primary" size="small" @click="showMyReservations = true">
          我的预约
        </el-button>
        <el-button v-if="auth.isAdmin" type="warning" size="small" @click="router.push('/review')">
          审核管理
        </el-button>
        <el-button type="info" size="small" @click="router.push('/')">
          返回首页
        </el-button>
      </div>
    </div>
    <div class="main" ref="canvasContainer">
      <RoomInfoPanel
        v-if="selectedRoom"
        :room="selectedRoom"
        @close="selectedRoom = null"
      >
        <template #actions>
          <el-button v-if="auth.isMember" type="primary" size="small" @click="showReserveDialog = true">
            预约此房间
          </el-button>
          <span v-else-if="auth.isLoggedIn" class="login-hint">需加入组织后才能预约</span>
          <span v-else class="login-hint">登录后可预约</span>
        </template>
      </RoomInfoPanel>
    </div>

    <!-- 预约对话框 -->
    <ReservationDialog
      v-model="showReserveDialog"
      :room="selectedRoom"
      @created="onReservationCreated"
    />

    <!-- 我的预约抽屉 -->
    <el-drawer v-model="showMyReservations" title="我的预约" direction="rtl" size="360px">
      <MyReservations ref="myReservationsRef" />
    </el-drawer>

    <!-- 新建楼层对话框 -->
    <el-dialog v-model="showAddFloor" title="新建楼层" width="460px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="楼层名称">
          <el-input v-model="addFloorForm.name" placeholder="如：6F" />
        </el-form-item>
        <el-divider content-position="left">固有属性</el-divider>
        <div v-for="(attr, idx) in addFloorForm.baseAttrs" :key="'f'+idx" class="kv-row">
          <el-input v-model="attr.key" placeholder="属性名" size="small" style="width:130px" />
          <el-input v-model="attr.value" placeholder="数值" size="small" style="width:130px" />
          <el-button type="danger" text size="small" @click="addFloorForm.baseAttrs.splice(idx, 1)">删除</el-button>
        </div>
        <el-button type="primary" text size="small" @click="addFloorForm.baseAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
      </el-form>
      <template #footer>
        <el-button @click="showAddFloor = false">取消</el-button>
        <el-button type="primary" @click="handleAddFloor" :loading="addFloorLoading">创建</el-button>
      </template>
    </el-dialog>

    <!-- 新建房间对话框 -->
    <el-dialog v-model="showAddRoom" title="新建房间" width="520px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="房间名称">
          <el-input v-model="addRoomForm.name" placeholder="如：601教室" />
        </el-form-item>
        <el-divider content-position="left">固有属性</el-divider>
        <div v-for="(attr, idx) in addRoomForm.baseAttrs" :key="'rb'+idx" class="kv-row">
          <el-input v-model="attr.key" placeholder="属性名" size="small" style="width:130px" />
          <el-input v-model="attr.value" placeholder="数值" size="small" style="width:130px" />
          <el-button type="danger" text size="small" @click="addRoomForm.baseAttrs.splice(idx, 1)">删除</el-button>
        </div>
        <el-button type="primary" text size="small" @click="addRoomForm.baseAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
        <el-divider content-position="left">3D位置与尺寸</el-divider>
        <div class="kv-row">
          <span class="pos-label">X</span><el-input-number v-model="addRoomForm.position.x" size="small" :step="2" />
          <span class="pos-label">Z</span><el-input-number v-model="addRoomForm.position.z" size="small" :step="2" />
        </div>
        <div class="kv-row" style="margin-top:8px">
          <span class="pos-label">宽</span><el-input-number v-model="addRoomForm.dimensions.width" size="small" :min="3" :step="2" />
          <span class="pos-label">高</span><el-input-number v-model="addRoomForm.dimensions.height" size="small" :min="2" :step="0.5" />
          <span class="pos-label">深</span><el-input-number v-model="addRoomForm.dimensions.depth" size="small" :min="3" :step="2" />
        </div>
        <div style="margin-top:8px;color:#5a7a9a;font-size:12px">提示：也可在3D视图中点击地面选取位置</div>
      </el-form>
      <template #footer>
        <el-button @click="showAddRoom = false">取消</el-button>
        <el-button type="primary" @click="handleAddRoom" :loading="addRoomLoading">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useContainerStore } from '../stores/container'
import { useAuthStore } from '../stores/auth'
import { containerApi, type ContainerRead } from '../api/containers'
import { reservationApi } from '../api/reservations'
import { useThreeScene, type RoomData } from '../composables/useThreeScene'
import RoomInfoPanel from '../components/RoomInfoPanel.vue'
import ReservationDialog from '../components/ReservationDialog.vue'
import MyReservations from '../components/MyReservations.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const store = useContainerStore()
const auth = useAuthStore()
const canvasContainer = ref<HTMLElement>()
const selectedRoom = ref<ContainerRead | null>(null)
const selectedFloorId = ref<string | null>(null)
const showReserveDialog = ref(false)
const showMyReservations = ref(false)
const myReservationsRef = ref()
const treeRef = ref()

// 新建楼层
interface AttrItem { key: string; value: string }
const showAddFloor = ref(false)
const addFloorLoading = ref(false)
const addFloorForm = ref({
  name: '',
  baseAttrs: [
    { key: 'level', value: '' },
    { key: 'height_m', value: '4' },
    { key: 'area_sqm', value: '' },
  ] as AttrItem[],
})

// 新建房间
const showAddRoom = ref(false)
const addRoomLoading = ref(false)
const addRoomForm = ref({
  name: '',
  baseAttrs: [
    { key: 'room_number', value: '' },
    { key: 'area_sqm', value: '' },
    { key: 'capacity', value: '' },
    { key: 'room_type', value: 'classroom' },
  ] as AttrItem[],
  position: { x: 0, z: 0 },
  dimensions: { width: 8, height: 3.5, depth: 7 },
})

function parseValue(v: string) {
  if (v === '' || v === undefined) return ''
  const n = Number(v)
  if (!isNaN(n)) return n
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

async function handleAddFloor() {
  if (!addFloorForm.value.name || !store.selectedBuilding) return
  addFloorLoading.value = true
  try {
    const baseAttrs: Record<string, any> = {}
    for (const attr of addFloorForm.value.baseAttrs) {
      if (attr.key) baseAttrs[attr.key] = parseValue(attr.value)
    }
    await containerApi.create({
      org_id: store.orgId,
      type: 'floor',
      name: addFloorForm.value.name,
      parent_id: store.selectedBuilding.id,
      base_attrs: baseAttrs,
    })
    showAddFloor.value = false
    addFloorForm.value.name = ''
    await store.fetchTree()
    // 重新选择当前建筑
    const bld = store.tree[0]?.children?.find(b => b.id === store.selectedBuilding?.id)
    if (bld) store.selectBuilding(bld)
  } finally {
    addFloorLoading.value = false
  }
}

async function handleAddRoom() {
  if (!addRoomForm.value.name || !selectedFloorId.value) return
  addRoomLoading.value = true
  try {
    const baseAttrs: Record<string, any> = {}
    for (const attr of addRoomForm.value.baseAttrs) {
      if (attr.key) baseAttrs[attr.key] = parseValue(attr.value)
    }
    await containerApi.create({
      org_id: store.orgId,
      type: 'room',
      name: addRoomForm.value.name,
      parent_id: selectedFloorId.value,
      base_attrs: baseAttrs,
      position: { x: addRoomForm.value.position.x, y: 0, z: addRoomForm.value.position.z },
      dimensions: { width: addRoomForm.value.dimensions.width, height: addRoomForm.value.dimensions.height, depth: addRoomForm.value.dimensions.depth },
    })
    showAddRoom.value = false
    addRoomForm.value.name = ''
    await store.fetchTree()
    const bld = store.tree[0]?.children?.find(b => b.id === store.selectedBuilding?.id)
    if (bld) store.selectBuilding(bld)
    // 如果当前正在看这个楼层，重新加载房间
    if (selectedFloorId.value) {
      const floor = bld?.children?.find(f => f.id === selectedFloorId.value)
      if (floor) await loadFloorRooms(floor)
    }
  } finally {
    addRoomLoading.value = false
  }
}

const { init, dispose, buildFloorRooms, highlightRoom, onRoomClick, onGroundClick } = useThreeScene(canvasContainer)

// 点击3D地面 → 打开新建房间并填入位置
onGroundClick.value = (x: number, z: number) => {
  if (!auth.isAdmin || !selectedFloorId.value) return
  addRoomForm.value.position.x = x
  addRoomForm.value.position.z = z
  showAddRoom.value = true
}

const buildingName = computed(() => store.selectedBuilding?.name || '建筑')
const campusName = computed(() => store.tree[0]?.name || '')
const floors = computed(() => store.selectedBuilding?.children || [])
const floorTree = computed(() => store.selectedBuilding?.children || [])

function onNodeClick(node: ContainerRead) {
  if (node.type === 'floor') {
    selectFloor(node)
  } else if (node.type === 'room') {
    // 如果房间不在当前楼层，先切换楼层
    const roomParentId = node.parent_id
    if (roomParentId && roomParentId !== selectedFloorId.value) {
      // 找到对应楼层
      const floor = floors.value.find(f => f.id === roomParentId)
      if (floor) {
        selectFloor(floor)
        // 等楼层加载完再高亮房间
        setTimeout(() => {
          selectedRoom.value = node
          highlightRoom(node.id)
        }, 200)
        return
      }
    }
    selectedRoom.value = node
    highlightRoom(node.id)
  }
}

async function selectFloor(floor: ContainerRead) {
  selectedFloorId.value = floor.id
  store.selectFloor(floor)
  // 同步树节点高亮
  treeRef.value?.setCurrentKey(floor.id)
  await loadFloorRooms(floor)
}

async function loadFloorRooms(floor: ContainerRead) {
  const { data: rooms } = await containerApi.children(floor.id)
  const floorLevel = floor.base_attrs?.level || 1

  // 批量查询当天预约状态
  const occupiedRoomIds = new Set<string>()
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
    const { data: reservations } = await reservationApi.list()
    const roomIds = new Set(rooms.map(r => r.id))
    reservations.forEach(r => {
      // 过滤：当前楼层房间 + 有效状态 + 当天时间范围
      const isToday = r.start_time < endOfDay && r.end_time > startOfDay
      if (roomIds.has(r.room_id) && (r.status === 'pending' || r.status === 'approved') && isToday) {
        occupiedRoomIds.add(r.room_id)
      }
    })
  } catch (e) { console.warn('获取预约状态失败', e) }

  buildFloorRooms(
    rooms.map(r => ({
      id: r.id,
      name: r.name,
      type: r.base_attrs?.room_type || 'default',
      position: r.position || { x: 0, y: 0, z: 0 },
      dimensions: r.dimensions || { width: 8, height: 3.5, depth: 7 },
      base_attrs: r.base_attrs,
      ext_attrs: r.ext_attrs,
    })),
    floorLevel,
    floor.base_attrs?.height_m || 4,
    occupiedRoomIds,
  )
}

onRoomClick.value = (roomId: string) => {
  if (store.selectedFloor) {
    containerApi.children(store.selectedFloor.id).then(({ data }) => {
      const room = data.find(r => r.id === roomId)
      if (room) {
        selectedRoom.value = room
        // 同步树节点高亮
        treeRef.value?.setCurrentKey(roomId)
      }
    })
  }
}

function onReservationCreated() {
  myReservationsRef.value?.fetchMyReservations()
}

onMounted(async () => {
  if (store.tree.length === 0) {
    await store.fetchTree()
  }
  const campus = store.tree[0]
  if (campus) {
    const building = campus.children?.find(b => b.id === props.id)
    if (building) {
      store.selectBuilding(building)
      setTimeout(() => {
        init()
        if (building.children?.length > 0) {
          selectFloor(building.children[0])
        }
      }, 100)
    }
  }
})

onUnmounted(() => {
  dispose()
})

// 组织切换时刷新数据
watch(() => store.orgId, async (newOrgId, oldOrgId) => {
  if (newOrgId && newOrgId !== oldOrgId) {
    await store.fetchTree()
    const campus = store.tree[0]
    if (campus) {
      const building = campus.children?.find(b => b.id === props.id)
      if (building) {
        store.selectBuilding(building)
        if (building.children?.length > 0) {
          selectFloor(building.children[0])
        }
      }
    }
  }
})
</script>

<style scoped>
.building-page {
  display: flex;
  height: 100vh;
  background: #0a1628;
  position: relative;
}
@media (max-width: 768px) {
  .building-page { flex-direction: column; }
  .sidebar { width: 100%; max-height: 35vh; border-right: none; border-bottom: 1px solid #1e3a5f; }
  .main { min-height: 50vh; }
}
.breadcrumb-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(10, 22, 40, 0.85);
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  padding: 6px 16px;
}
.sidebar {
  width: 260px;
  padding: 16px;
  border-right: 1px solid #1e3a5f;
  overflow-y: auto;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.sidebar h3 {
  color: #64b5f6;
  margin-bottom: 12px;
}
.floor-selector {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
}
.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #1e3a5f;
}
.main {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.login-hint {
  color: #5a7a9a;
  font-size: 13px;
}
.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.pos-label {
  color: #5a7a9a;
  font-size: 13px;
  min-width: 20px;
}
</style>
