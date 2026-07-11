<template>
  <div class="building-page">
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
      </div>
      <el-tree
        :data="floorTree"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        highlight-current
        :default-expand-all="true"
        @node-click="onNodeClick"
      />
      <div class="sidebar-footer">
        <el-button type="primary" size="small" @click="showMyReservations = true">
          我的预约
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
          <el-button type="primary" size="small" @click="showReserveDialog = true">
            预约此房间
          </el-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useContainerStore } from '../stores/container'
import { containerApi, type ContainerRead } from '../api/containers'
import { useThreeScene, type RoomData } from '../composables/useThreeScene'
import RoomInfoPanel from '../components/RoomInfoPanel.vue'
import ReservationDialog from '../components/ReservationDialog.vue'
import MyReservations from '../components/MyReservations.vue'

const props = defineProps<{ id: string }>()
const store = useContainerStore()
const canvasContainer = ref<HTMLElement>()
const selectedRoom = ref<ContainerRead | null>(null)
const selectedFloorId = ref<string | null>(null)
const showReserveDialog = ref(false)
const showMyReservations = ref(false)
const myReservationsRef = ref()

const { init, dispose, buildFloorRooms, highlightRoom, onRoomClick } = useThreeScene(canvasContainer)

const buildingName = computed(() => store.selectedBuilding?.name || '建筑')
const floors = computed(() => store.selectedBuilding?.children || [])
const floorTree = computed(() => store.selectedBuilding?.children || [])

function onNodeClick(node: ContainerRead) {
  if (node.type === 'floor') {
    loadFloorRooms(node)
  } else if (node.type === 'room') {
    selectedRoom.value = node
    highlightRoom(node.id)
  }
}

async function selectFloor(floor: ContainerRead) {
  selectedFloorId.value = floor.id
  store.selectFloor(floor)
  await loadFloorRooms(floor)
}

async function loadFloorRooms(floor: ContainerRead) {
  const { data: rooms } = await containerApi.children(floor.id)
  const floorLevel = floor.base_attrs?.level || 1
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
    floor.base_attrs?.height_m || 4
  )
}

onRoomClick.value = (roomId: string) => {
  if (store.selectedFloor) {
    containerApi.children(store.selectedFloor.id).then(({ data }) => {
      const room = data.find(r => r.id === roomId)
      if (room) {
        selectedRoom.value = room
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
</script>

<style scoped>
.building-page {
  display: flex;
  height: 100vh;
  background: #0a1628;
  position: relative;
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
</style>
