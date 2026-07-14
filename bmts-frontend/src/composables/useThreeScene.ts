import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ref, type Ref } from 'vue'

export interface RoomData {
  id: string
  name: string
  type: string
  position: { x: number; y: number; z: number }
  dimensions: { width: number; height: number; depth: number }
  base_attrs: Record<string, any>
  ext_attrs: Record<string, any>
}

export function useThreeScene(container: Ref<HTMLElement | undefined>) {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let controls: OrbitControls
  let raycaster: THREE.Raycaster
  let mouse: THREE.Vector2
  let animationId: number
  const roomMeshes: Map<string, THREE.Mesh> = new Map()
  const highlightedRoom = ref<string | null>(null)
  const onRoomClick = ref<((roomId: string) => void) | null>(null)
  const onGroundClick = ref<((x: number, z: number) => void) | null>(null)
  const onRoomMove = ref<((roomId: string, x: number, z: number) => void) | null>(null)
  let ground: THREE.Mesh | null = null
  let isEditMode = false
  let draggingMesh: THREE.Mesh | null = null
  let dragPlane: THREE.Plane | null = null
  let dragOffset = new THREE.Vector3()

  function init() {
    if (!container.value) return

    // 场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f4f8)
    scene.fog = new THREE.Fog(0xf0f4f8, 100, 300)

    // 相机
    const width = container.value.clientWidth
    const height = container.value.clientHeight
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 40, 60)

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    container.value.appendChild(renderer.domElement)

    // 控制器
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2.2

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(30, 50, 30)
    dirLight.castShadow = true
    scene.add(dirLight)

    // 地面
    const groundGeo = new THREE.PlaneGeometry(200, 200)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe8ecef,
      roughness: 0.9
    })
    ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.userData = { isGround: true }
    scene.add(ground)

    // 网格辅助线
    const grid = new THREE.GridHelper(200, 40, 0x4a90d9, 0xd1d9e0)
    scene.add(grid)

    // 射线
    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

    // 事件
    renderer.domElement.addEventListener('click', onMouseClick)
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    renderer.domElement.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('mouseup', onMouseUp)
    renderer.domElement.addEventListener('mouseleave', onMouseUp)
    window.addEventListener('resize', onResize)

    animate()
  }

  function dispose() {
    if (animationId) cancelAnimationFrame(animationId)
    window.removeEventListener('resize', onResize)
    renderer?.domElement.removeEventListener('click', onMouseClick)
    renderer?.domElement.removeEventListener('mousedown', onMouseDown)
    renderer?.domElement.removeEventListener('mousemove', onMouseMove)
    renderer?.domElement.removeEventListener('mouseup', onMouseUp)
    renderer?.domElement.removeEventListener('mouseleave', onMouseUp)
    renderer?.dispose()
    if (container.value && renderer) {
      container.value.removeChild(renderer.domElement)
    }
    roomMeshes.clear()
  }

  function animate() {
    animationId = requestAnimationFrame(animate)
    controls?.update()
    renderer?.render(scene, camera)
  }

  function onResize() {
    if (!container.value) return
    const w = container.value.clientWidth
    const h = container.value.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  function onMouseClick(event: MouseEvent) {
    if (isEditMode || draggingMesh) return
    if (!container.value) return
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const meshArray = Array.from(roomMeshes.values())
    const allObjects = ground ? [...meshArray, ground] : meshArray
    const intersects = raycaster.intersectObjects(allObjects)

    if (intersects.length > 0) {
      const hit = intersects[0]
      const mesh = hit.object as THREE.Mesh

      if (mesh.userData?.isGround && hit.point) {
        // 点击了地面
        onGroundClick.value?.(Math.round(hit.point.x * 2) / 2, Math.round(hit.point.z * 2) / 2)
      } else if (mesh.userData?.roomId) {
        // 点击了房间
        if (highlightedRoom.value && highlightedRoom.value !== mesh.userData.roomId) {
          resetRoomColor(highlightedRoom.value)
        }
        highlightRoom(mesh.userData.roomId)
        onRoomClick.value?.(mesh.userData.roomId)
      }
    }
  }

  function onMouseDown(event: MouseEvent) {
    if (!isEditMode || !container.value) return

    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const meshArray = Array.from(roomMeshes.values())
    const intersects = raycaster.intersectObjects(meshArray)

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh
      if (mesh.userData?.roomId) {
        controls.enabled = false
        draggingMesh = mesh

        dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        const intersectPoint = new THREE.Vector3()
        raycaster.ray.intersectPlane(dragPlane, intersectPoint)
        if (intersectPoint) {
          dragOffset.subVectors(draggingMesh.position, intersectPoint)
        }
      }
    }
  }

  function onMouseUp() {
    if (draggingMesh) {
      const roomId = draggingMesh.userData?.roomId
      if (roomId) {
        onRoomMove.value?.(roomId, Math.round(draggingMesh.position.x * 2) / 2, Math.round(draggingMesh.position.z * 2) / 2)
      }
      draggingMesh = null
      dragPlane = null
      controls.enabled = true
    }
  }

  function onMouseMove(event: MouseEvent) {
    if (!container.value) return

    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    if (draggingMesh && dragPlane) {
      const intersectPoint = new THREE.Vector3()
      raycaster.setFromCamera(mouse, camera)
      if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
        draggingMesh.position.copy(intersectPoint).add(dragOffset)
        draggingMesh.position.x = Math.round(draggingMesh.position.x * 2) / 2
        draggingMesh.position.z = Math.round(draggingMesh.position.z * 2) / 2
      }
    }
  }

  function setEditMode(enabled: boolean) {
    isEditMode = enabled
    if (!enabled && draggingMesh) {
      onMouseUp()
    }
  }

  function getRoomColor(type: string): number {
    const colors: Record<string, number> = {
      classroom: 0x6ab7e8,
      lab: 0x8ed09e,
      office: 0xf5c87a,
      meeting: 0xc8a6d4,
      default: 0xb8c2cc,
    }
    return colors[type] || colors.default
  }

  function buildFloorRooms(rooms: RoomData[], floorLevel: number, floorHeight: number = 4, occupiedRoomIds: Set<string> = new Set()) {
    // 清除旧的房间mesh
    roomMeshes.forEach((mesh) => scene.remove(mesh))
    roomMeshes.clear()
    highlightedRoom.value = null

    for (const room of rooms) {
      const w = room.dimensions?.width || 8
      const h = room.dimensions?.height || 3.5
      const d = room.dimensions?.depth || 7

      const px = room.position?.x || 0
      const py = (floorLevel - 1) * floorHeight + h / 2 + 0.1
      const pz = room.position?.z || 0

      const geometry = new THREE.BoxGeometry(w, h, d)
      const isOccupied = occupiedRoomIds.has(room.id)
      const color = isOccupied ? 0xef5350 : getRoomColor(room.type || room.base_attrs?.room_type || 'default')
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: isOccupied ? 0.5 : 0.85,
        roughness: 0.4,
        metalness: 0.1,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(px, py, pz)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { roomId: room.id, roomName: room.name, roomType: room.type }

      // 边框
      const edges = new THREE.EdgesGeometry(geometry)
      const lineMat = new THREE.LineBasicMaterial({ color: 0x64b5f6, transparent: true, opacity: 0.6 })
      const line = new THREE.LineSegments(edges, lineMat)
      mesh.add(line)

      scene.add(mesh)
      roomMeshes.set(room.id, mesh)
    }

    // 调整相机
    if (rooms.length > 0) {
      camera.position.set(0, floorLevel * floorHeight + 20, 50)
      controls.target.set(0, floorLevel * floorHeight, 0)
      controls.update()
    }
  }

  function highlightRoom(roomId: string) {
    const mesh = roomMeshes.get(roomId)
    if (!mesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.emissive = new THREE.Color(0x42a5f5)
    mat.emissiveIntensity = 0.5
    mat.opacity = 1.0
    highlightedRoom.value = roomId
  }

  function resetRoomColor(roomId: string) {
    const mesh = roomMeshes.get(roomId)
    if (!mesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.emissive = new THREE.Color(0x000000)
    mat.emissiveIntensity = 0
    mat.opacity = 0.85
  }

  return {
    init,
    dispose,
    buildFloorRooms,
    highlightRoom,
    resetRoomColor,
    highlightedRoom,
    onRoomClick,
    onGroundClick,
    onRoomMove,
    setEditMode,
  }
}
