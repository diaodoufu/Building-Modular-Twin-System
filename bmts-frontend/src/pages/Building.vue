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
        <el-button v-if="auth.isAdmin" type="success" size="small" @click="openContainerCreate('floor', store.selectedBuilding?.id || null)" style="margin: 2px">
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
      <el-button v-if="auth.isAdmin && selectedFloorId" type="success" size="small" @click="openContainerCreate('room', selectedFloorId)">
        新建房间
      </el-button>
      <el-button
        v-if="auth.isAdmin && selectedFloorId"
        :type="isEditMode ? 'warning' : 'primary'"
        size="small"
        @click="toggleEditMode"
      >
        {{ isEditMode ? '退出编辑' : '编辑位置' }}
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

    <!-- 新建容器组件 -->
    <ContainerCreate
      :visible="showContainerCreate"
      :org-id="store.orgId"
      :type="containerCreateType"
      :parent-id="containerCreateParentId"
      :position="containerCreatePosition"
      :lock-parent-id="true"
      :lock-type="true"
      @update:visible="showContainerCreate = false"
      @created="onContainerCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useContainerStore } from '../stores/container'
import { useAuthStore } from '../stores/auth'
import { containerApi, type ContainerRead } from '../api/containers'
import { reservationApi } from '../api/reservations'
import { useThreeScene } from '../composables/useThreeScene'
import RoomInfoPanel from '../components/RoomInfoPanel.vue'
import ReservationDialog from '../components/ReservationDialog.vue'
import MyReservations from '../components/MyReservations.vue'
import ContainerCreate from '../components/ContainerCreate.vue'

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
const isEditMode = ref(false)

function toggleEditMode() {
  isEditMode.value = !isEditMode.value
  setEditMode(isEditMode.value)
}

// 新建容器
const showContainerCreate = ref(false)
const containerCreateType = ref<'building' | 'floor' | 'room' | 'resource'>('floor')
const containerCreateParentId = ref<string | null>(null)
const containerCreatePosition = ref<{ x: number; z: number } | undefined>(undefined)

function openContainerCreate(type: 'building' | 'floor' | 'room' | 'resource', parentId: string | null, position?: { x: number; z: number }) {
  containerCreateType.value = type
  containerCreateParentId.value = parentId
  containerCreatePosition.value = position
  showContainerCreate.value = true
}

async function onContainerCreated() {
  await store.fetchTree()
  const bld = store.tree[0]?.children?.find(b => b.id === store.selectedBuilding?.id)
  if (bld) {
    store.selectBuilding(bld)
    if (selectedFloorId.value) {
      const floor = bld?.children?.find(f => f.id === selectedFloorId.value)
      if (floor) await loadFloorRooms(floor)
    }
  }
}

const { init, dispose, buildFloorRooms, highlightRoom, onRoomClick, onGroundClick, onRoomMove, setEditMode } = useThreeScene(canvasContainer)

// 点击3D地面 → 打开新建房间并填入位置
onGroundClick.value = (x: number, z: number) => {
  if (!auth.isAdmin || !selectedFloorId.value) return
  openContainerCreate('room', selectedFloorId.value, { x, z })
}

// 编辑模式下移动房间
onRoomMove.value = (roomId: string, x: number, z: number) => {
  if (!auth.isAdmin) return
  containerApi.update(roomId, {
    position: { x, y: 0, z },
  }).catch(e => console.warn('更新房间位置失败', e))
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
  background: #fafbfc;
  position: relative;
}
@media (max-width: 768px) {
  .building-page { flex-direction: column; }
  .sidebar { width: 100%; max-height: 35vh; border-right: none; border-bottom: 1px solid #e2e8f0; }
  .main { min-height: 50vh; }
}
.breadcrumb-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 16px;
}
.sidebar {
  width: 260px;
  padding: 16px;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}
.sidebar h3 {
  color: #2d3748;
  margin-bottom: 12px;
  font-size: 16px;
}
.floor-selector {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
}
.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}
.main {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.login-hint {
  color: #718096;
  font-size: 13px;
}
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
</style>
