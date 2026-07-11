<template>
  <div class="campus-page">
    <div class="toolbar">
      <el-button type="info" text @click="router.push('/')">返回首页</el-button>
      <span class="toolbar-title">校园全景</span>
      <el-button v-if="auth.isAdmin" type="success" size="small" @click="showAddBuilding = true">新建建筑</el-button>
    </div>
    <div class="canvas-wrapper" ref="canvasContainer"></div>

    <!-- 建筑信息悬浮卡片 -->
    <div v-if="hoveredBuilding" class="hover-card" :style="{ left: hoverX + 'px', top: hoverY + 'px' }">
      <h4>{{ hoveredBuilding.name }}</h4>
      <p>{{ hoveredBuilding.base_attrs?.total_floors || '-' }} 层</p>
      <p>{{ hoveredBuilding.base_attrs?.area_sqm || '-' }} m²</p>
      <p class="click-hint">点击进入</p>
    </div>

    <!-- 新建建筑对话框 -->
    <el-dialog v-model="showAddBuilding" title="新建建筑" width="520px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="addForm.name" placeholder="如：教学楼B" />
        </el-form-item>
        <el-divider content-position="left">固有属性</el-divider>
        <div v-for="(attr, idx) in addForm.baseAttrs" :key="'b'+idx" class="kv-row">
          <el-input v-model="attr.key" placeholder="属性名" size="small" style="width:140px" />
          <el-input v-model="attr.value" placeholder="数值" size="small" style="width:140px" />
          <el-button type="danger" text size="small" @click="addForm.baseAttrs.splice(idx, 1)">删除</el-button>
        </div>
        <el-button type="primary" text size="small" @click="addForm.baseAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
        <el-divider content-position="left">3D位置与尺寸</el-divider>
        <div class="kv-row">
          <span class="pos-label">X</span><el-input-number v-model="addForm.position.x" size="small" :step="5" />
          <span class="pos-label">Z</span><el-input-number v-model="addForm.position.z" size="small" :step="5" />
        </div>
        <div class="kv-row" style="margin-top:8px">
          <span class="pos-label">宽</span><el-input-number v-model="addForm.dimensions.width" size="small" :min="5" :step="5" />
          <span class="pos-label">高</span><el-input-number v-model="addForm.dimensions.height" size="small" :min="5" :step="3" />
          <span class="pos-label">深</span><el-input-number v-model="addForm.dimensions.depth" size="small" :min="5" :step="5" />
        </div>
        <div style="margin-top:8px;color:#5a7a9a;font-size:12px">提示：也可在3D视图中点击地面选取位置</div>
      </el-form>
      <template #footer>
        <el-button @click="showAddBuilding = false">取消</el-button>
        <el-button type="primary" @click="handleAddBuilding" :loading="addLoading">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useContainerStore } from '../stores/container'
import { useAuthStore } from '../stores/auth'
import { containerApi, type ContainerTreeNode } from '../api/containers'

const router = useRouter()
const store = useContainerStore()
const auth = useAuthStore()
const canvasContainer = ref<HTMLElement>()

const hoveredBuilding = ref<ContainerTreeNode | null>(null)
const hoverX = ref(0)
const hoverY = ref(0)

// 新建建筑
interface AttrItem { key: string; value: string }
const showAddBuilding = ref(false)
const addLoading = ref(false)
const addForm = ref({
  name: '',
  baseAttrs: [
    { key: 'built_year', value: '2026' },
    { key: 'total_floors', value: '5' },
    { key: 'area_sqm', value: '' },
  ] as AttrItem[],
  position: { x: 0, z: 0 },
  dimensions: { width: 25, height: 20, depth: 18 },
})

function parseValue(v: string) {
  if (v === '' || v === undefined) return ''
  const n = Number(v)
  if (!isNaN(n)) return n
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

async function handleAddBuilding() {
  if (!addForm.value.name || !campusData) return
  addLoading.value = true
  try {
    const baseAttrs: Record<string, any> = {}
    for (const attr of addForm.value.baseAttrs) {
      if (attr.key) baseAttrs[attr.key] = parseValue(attr.value)
    }
    await containerApi.create({
      org_id: store.orgId,
      type: 'building',
      name: addForm.value.name,
      parent_id: campusData.id,
      base_attrs: baseAttrs,
      position: { x: addForm.value.position.x, y: 0, z: addForm.value.position.z },
      dimensions: { width: addForm.value.dimensions.width, height: addForm.value.dimensions.height, depth: addForm.value.dimensions.depth },
    })
    showAddBuilding.value = false
    addForm.value.name = ''
    await store.fetchTree()
    // 重新渲染3D
    const updated = store.tree[0]
    if (updated?.children?.length) {
      buildCampus(updated.children)
    }
  } finally {
    addLoading.value = false
  }
}

let campusData: ContainerTreeNode | null = null

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let animationId: number
let ground: THREE.Mesh | null = null
const buildingMeshes: Map<string, THREE.Mesh> = new Map()
const buildingData: Map<string, ContainerTreeNode> = new Map()

function init() {
  if (!canvasContainer.value) return

  const el = canvasContainer.value

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a1628)
  scene.fog = new THREE.Fog(0x0a1628, 200, 500)

  camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 1000)
  camera.position.set(0, 80, 120)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2.5
  controls.minDistance = 30
  controls.maxDistance = 300

  // 光照
  scene.add(new THREE.AmbientLight(0x404060, 2))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
  dirLight.position.set(50, 80, 50)
  dirLight.castShadow = true
  scene.add(dirLight)

  // 地面
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x0d1f3c, roughness: 0.9 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.userData = { isGround: true }
  scene.add(ground)

  // 网格
  scene.add(new THREE.GridHelper(400, 40, 0x1a3355, 0x112244))

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  renderer.domElement.addEventListener('click', onClick)
  renderer.domElement.addEventListener('mousemove', onMouseMove)
  window.addEventListener('resize', onResize)

  animate()
}

function dispose() {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  renderer?.domElement.removeEventListener('click', onClick)
  renderer?.domElement.removeEventListener('mousemove', onMouseMove)
  renderer?.dispose()
  if (canvasContainer.value && renderer) {
    canvasContainer.value.removeChild(renderer.domElement)
  }
  buildingMeshes.clear()
  buildingData.clear()
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene, camera)
}

function onResize() {
  if (!canvasContainer.value) return
  const w = canvasContainer.value.clientWidth
  const h = canvasContainer.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function getBuildingColor(name: string): number {
  if (name.includes('图书') || name.includes('Library')) return 0x4fc3f7
  if (name.includes('行政') || name.includes('Admin')) return 0xffb74d
  if (name.includes('实验') || name.includes('Lab')) return 0x81c784
  return 0x64b5f6
}

function buildCampus(buildings: ContainerTreeNode[]) {
  // 清除旧建筑
  buildingMeshes.forEach(mesh => scene.remove(mesh))
  buildingMeshes.clear()
  buildingData.clear()

  const spacing = 35
  const rowSize = Math.ceil(Math.sqrt(buildings.length))

  buildings.forEach((bld, idx) => {
    const row = Math.floor(idx / rowSize)
    const col = idx % rowSize

    const w = bld.dimensions?.width || 20
    const h = bld.dimensions?.height || 18
    const d = bld.dimensions?.depth || 15

    const geometry = new THREE.BoxGeometry(w, h, d)
    const color = getBuildingColor(bld.name)
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
      metalness: 0.2,
    })

    const mesh = new THREE.Mesh(geometry, material)
    const px = (col - rowSize / 2 + 0.5) * spacing
    const pz = (row - Math.ceil(buildings.length / rowSize) / 2 + 0.5) * spacing
    mesh.position.set(px, h / 2, pz)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = { buildingId: bld.id }

    // 边框
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8ab4f8, transparent: true, opacity: 0.8 })
    mesh.add(new THREE.LineSegments(edges, lineMat))

    // 建筑名称标签（使用sprite）
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(10,22,40,0.7)'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = '#e0e6ed'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(bld.name, 128, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.set(0, h / 2 + 3, 0)
    sprite.scale.set(12, 3, 1)
    mesh.add(sprite)

    scene.add(mesh)
    buildingMeshes.set(bld.id, mesh)
    buildingData.set(bld.id, bld)
  })

  // 调整相机
  camera.position.set(0, 80, 120)
  controls.target.set(0, 0, 0)
  controls.update()
}

function onClick(event: MouseEvent) {
  if (!canvasContainer.value) return
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshArray = Array.from(buildingMeshes.values())
  const allObjects = ground ? [...meshArray, ground] : meshArray
  const intersects = raycaster.intersectObjects(allObjects, true)

  if (intersects.length > 0) {
    const hit = intersects[0]
    const obj = hit.object as THREE.Mesh

    // 点击地面 → 管理员打开新建建筑对话框并填入坐标
    if (obj.userData?.isGround && hit.point) {
      if (auth.isAdmin) {
        addForm.value.position.x = Math.round(hit.point.x)
        addForm.value.position.z = Math.round(hit.point.z)
        showAddBuilding.value = true
      }
      return
    }

    // 点击建筑 → 向上查找 buildingId
    let target: THREE.Mesh | null = obj
    while (target && !target.userData?.buildingId) {
      target = target.parent as THREE.Mesh
    }
    if (target?.userData?.buildingId) {
      router.push({ name: 'building', params: { id: target.userData.buildingId } })
    }
  }
}

function onMouseMove(event: MouseEvent) {
  if (!canvasContainer.value) return
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  hoverX.value = event.clientX - rect.left + 15
  hoverY.value = event.clientY - rect.top - 10

  raycaster.setFromCamera(mouse, camera)
  const meshArray = Array.from(buildingMeshes.values())
  const intersects = raycaster.intersectObjects(meshArray, true)

  // 重置所有建筑颜色
  buildingMeshes.forEach(mesh => {
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0
  })

  if (intersects.length > 0) {
    let obj = intersects[0].object as THREE.Mesh
    while (obj && !obj.userData?.buildingId) {
      obj = obj.parent as THREE.Mesh
    }
    if (obj?.userData?.buildingId) {
      const mat = obj.material as THREE.MeshStandardMaterial
      mat.emissive = new THREE.Color(0x42a5f5)
      mat.emissiveIntensity = 0.3
      hoveredBuilding.value = buildingData.get(obj.userData.buildingId) || null
    }
  } else {
    hoveredBuilding.value = null
  }
}

onMounted(async () => {
  if (store.tree.length === 0) {
    await store.fetchTree()
  }
  const campus = store.tree[0]
  if (campus) {
    campusData = campus
    if (campus.children?.length) {
      init()
      buildCampus(campus.children)
    } else {
      init()
    }
  }
})

onUnmounted(dispose)
</script>

<style scoped>
.campus-page {
  min-height: 100vh;
  background: #0a1628;
  position: relative;
}
.toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
}
.toolbar-title {
  color: #8ab4f8;
  font-size: 18px;
  font-weight: 500;
}
.canvas-wrapper {
  width: 100vw;
  height: 100vh;
}
.hover-card {
  position: absolute;
  z-index: 20;
  background: rgba(15, 39, 68, 0.95);
  border: 1px solid #42a5f5;
  border-radius: 8px;
  padding: 12px 16px;
  pointer-events: none;
}
.hover-card h4 {
  color: #64b5f6;
  margin: 0 0 6px 0;
  font-size: 15px;
}
.hover-card p {
  color: #e0e6ed;
  margin: 2px 0;
  font-size: 13px;
}
.click-hint {
  color: #5a7a9a;
  font-size: 11px;
  margin-top: 4px !important;
}
.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.pos-label {
  color: #8ab4f8;
  font-size: 13px;
  min-width: 24px;
  text-align: right;
}
</style>
