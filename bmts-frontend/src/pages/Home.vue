<template>
  <div class="home">
    <div class="header">
      <h1>BMTS - 建筑模块化孪生系统</h1>
      <!-- 组织切换 -->
      <div class="org-bar" v-if="auth.isLoggedIn">
        <el-dropdown v-if="auth.organizations.length > 0" @command="onOrgSwitch">
          <span class="org-switch">
            {{ auth.currentOrg?.name || '选择组织' }}
            <el-icon><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="org in auth.organizations"
                :key="org.id"
                :command="org.id"
                :class="{ 'is-active': org.id === auth.currentOrgId }"
              >
                {{ org.name }}
                <span class="org-type-tag">{{ org.org_type }}</span>
                <span v-if="auth.memberships.find(m => m.org_id === org.id)?.role === 'owner'" class="role-badge owner">owner</span>
                <span v-else-if="auth.memberships.find(m => m.org_id === org.id)?.role === 'admin'" class="role-badge admin">admin</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-else type="primary" size="small" @click="showJoinOrg = true">加入组织</el-button>
        <el-button type="info" text size="small" @click="showJoinOrg = true">组织+</el-button>
      </div>
      <p class="subtitle" v-if="campus">{{ campus.name }}</p>
      <div class="user-bar">
        <span v-if="auth.user" class="user-name">{{ auth.user.display_name }}</span>
        <span v-if="auth.isAdmin" class="role-tag">管理员</span>
        <span v-else-if="auth.isMember" class="role-tag member">用户</span>
        <span v-else-if="auth.isLoggedIn" class="role-tag guest">游客</span>
        <el-button v-if="auth.isAdmin" type="primary" text size="small" @click="router.push('/admin')">
          数据管理
        </el-button>
        <el-button v-if="auth.isAdmin" type="warning" text size="small" @click="router.push('/review')">
          审核管理
        </el-button>
        <el-button type="info" text size="small" @click="router.push('/schema')">
          Schema规范
        </el-button>
        <el-button type="success" text size="small" @click="router.push('/stats')">
          数据统计
        </el-button>
        <el-button v-if="auth.isLoggedIn" type="danger" text size="small" @click="auth.logout(); router.push('/login')">
          退出
        </el-button>
        <el-button v-else type="primary" text size="small" @click="router.push('/login')">
          登录
        </el-button>
      </div>
    </div>

    <!-- 校园信息卡片 -->
    <div class="campus-section" v-if="campus">
      <div class="campus-card">
        <div class="campus-header">
          <h2>{{ campus.name }}</h2>
          <el-button v-if="auth.isAdmin" type="primary" size="small" @click="editCampus">编辑</el-button>
        </div>
        <div class="campus-attrs">
          <div class="attr-item" v-if="campus.base_attrs?.address">
            <span class="attr-label">地址</span>
            <span class="attr-value">{{ campus.base_attrs.address }}</span>
          </div>
          <div class="attr-item" v-if="campus.base_attrs?.area_sqm">
            <span class="attr-label">面积</span>
            <span class="attr-value">{{ campus.base_attrs.area_sqm }} m²</span>
          </div>
          <div class="attr-item" v-if="campus.base_attrs?.description">
            <span class="attr-label">描述</span>
            <span class="attr-value">{{ campus.base_attrs.description }}</span>
          </div>
          <div class="attr-item">
            <span class="attr-label">建筑数量</span>
            <span class="attr-value">{{ campus.children?.length || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 个人视图 -->
    <div class="personal-section" v-if="auth.isMember && campus">
      <div class="personal-grid">
        <!-- 快捷统计 -->
        <div class="stat-cards">
          <div class="stat-card" @click="showMyReservations = true">
            <span class="stat-number">{{ myPendingCount }}</span>
            <span class="stat-label">待审核</span>
          </div>
          <div class="stat-card" @click="showMyReservations = true">
            <span class="stat-number">{{ myApprovedCount }}</span>
            <span class="stat-label">已通过</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">{{ campus.children?.length || 0 }}</span>
            <span class="stat-label">建筑</span>
          </div>
        </div>
        <!-- 近期预约 -->
        <div class="recent-reservations" v-if="myReservations.length > 0">
          <h4>我的近期预约</h4>
          <div v-for="r in myReservations.slice(0, 5)" :key="r.id" class="reservation-item" @click="goToRoom(r.room_id)">
            <span class="res-status" :class="r.status">{{ statusLabel(r.status) }}</span>
            <span class="res-room">{{ getRoomName(r.room_id) }}</span>
            <span class="res-time">{{ formatTime(r.start_time) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的预约抽屉 -->
    <el-drawer v-model="showMyReservations" title="我的预约" direction="rtl" size="380px">
      <div v-if="myReservations.length === 0" style="color:#5a7a9a;text-align:center;padding:40px">暂无预约</div>
      <div v-for="r in myReservations" :key="r.id" class="reservation-drawer-item" @click="goToRoom(r.room_id)">
        <div class="res-main">
          <span class="res-status" :class="r.status">{{ statusLabel(r.status) }}</span>
          <span class="res-room">{{ getRoomName(r.room_id) }}</span>
        </div>
        <div class="res-detail">
          {{ formatTime(r.start_time) }} - {{ formatTimeShort(r.end_time) }}
          <span v-if="r.title" class="res-title">{{ r.title }}</span>
        </div>
      </div>
    </el-drawer>

    <!-- 搜索栏 -->
    <div class="search-bar" v-if="campus?.children?.length">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索建筑、房间..."
        prefix-icon="Search"
        clearable
        style="max-width: 400px"
      />
    </div>

    <!-- 搜索结果 -->
    <div class="search-results" v-if="searchKeyword && searchResults.length > 0">
      <div v-for="item in searchResults" :key="item.id" class="search-item" @click="onSearchItemClick(item)">
        <span class="search-type">{{ typeLabel(item.type) }}</span>
        <span class="search-name">{{ item.name }}</span>
        <span class="search-path">{{ item.path }}</span>
      </div>
    </div>
    <div class="search-results" v-else-if="searchKeyword && searchResults.length === 0">
      <div class="no-result">未找到匹配结果</div>
    </div>

    <!-- 建筑列表 -->
    <div class="section-title" v-if="campus?.children?.length">
      建筑列表
      <div style="display:flex;gap:8px;margin-left:auto">
        <el-button v-if="auth.isAdmin" type="success" size="small" @click="showAddBuilding = true">新建建筑</el-button>
        <el-button type="primary" size="small" @click="router.push('/campus')">3D全景</el-button>
      </div>
    </div>
    <div class="section-title" v-else-if="campus" style="display:flex;justify-content:space-between">
      <span>暂无建筑</span>
      <el-button v-if="auth.isAdmin" type="success" size="small" @click="showAddBuilding = true">新建建筑</el-button>
    </div>
    <div class="buildings" v-if="campus?.children?.length">
      <div
        v-for="building in campus.children"
        :key="building.id"
        class="building-card"
        @click="goToBuilding(building.id)"
      >
        <div class="building-icon">{{ buildingIcon(building.name) }}</div>
        <div class="building-info">
          <h3>{{ building.name }}</h3>
          <p>{{ building.base_attrs?.area_sqm || '-' }} m²</p>
          <p>{{ building.base_attrs?.total_floors || '-' }} 层</p>
          <p v-if="building.base_attrs?.built_year">{{ building.base_attrs.built_year }} 年建成</p>
        </div>
        <el-button v-if="auth.isAdmin" class="edit-btn" type="primary" text size="small" @click.stop="editBuilding(building)">编辑</el-button>
      </div>
    </div>
    <div v-else-if="campus" class="empty">
      <el-empty description="暂无建筑数据，请前往数据管理添加" />
    </div>
    <div v-else class="loading">
      <el-button type="primary" @click="loadData" :loading="store.loading">加载数据</el-button>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" :title="editDialogTitle" width="560px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="固有属性">
          <div class="attr-list">
            <div v-for="(item, idx) in editForm.baseAttrs" :key="idx" class="attr-row">
              <el-input v-model="item.key" placeholder="属性名" size="small" style="width: 140px" />
              <el-input v-model="item.value" placeholder="数值" size="small" style="flex: 1" />
              <el-button type="danger" text size="small" @click="editForm.baseAttrs.splice(idx, 1)">删除</el-button>
            </div>
            <el-button type="primary" text size="small" @click="editForm.baseAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
          </div>
        </el-form-item>
        <el-form-item label="扩展属性">
          <div class="attr-list">
            <div v-for="(item, idx) in editForm.extAttrs" :key="idx" class="attr-row">
              <el-input v-model="item.key" placeholder="属性名" size="small" style="width: 140px" />
              <el-input v-model="item.value" placeholder="数值" size="small" style="flex: 1" />
              <el-button type="danger" text size="small" @click="editForm.extAttrs.splice(idx, 1)">删除</el-button>
            </div>
            <el-button type="primary" text size="small" @click="editForm.extAttrs.push({ key: '', value: '' })">+ 新增属性</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditSubmit" :loading="editLoading">保存</el-button>
      </template>
    </el-dialog>

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
      </el-form>
      <template #footer>
        <el-button @click="showAddBuilding = false">取消</el-button>
        <el-button type="primary" @click="handleAddBuilding" :loading="addLoading">创建</el-button>
      </template>
    </el-dialog>

    <!-- 组织管理对话框 -->
    <el-dialog v-model="showJoinOrg" title="组织管理" width="560px">
      <el-tabs v-model="orgTab">
        <!-- 搜索加入 -->
        <el-tab-pane label="搜索加入" name="search">
          <el-input v-model="orgSearchKeyword" placeholder="搜索组织名称..." @input="handleOrgSearch" clearable style="margin-bottom:12px" />
          <div v-for="org in orgSearchResults" :key="org.id" class="org-item">
            <div class="org-info">
              <span class="org-name">{{ org.name }}</span>
              <span class="org-type-tag">{{ org.org_type }}</span>
              <span class="org-slug">{{ org.slug }}</span>
            </div>
            <el-button
              v-if="!auth.organizations.some(o => o.id === org.id)"
              type="primary" size="small"
              @click="handleJoinOrg(org)"
            >加入</el-button>
            <span v-else class="joined-tag">已加入</span>
          </div>
          <div v-if="orgSearchKeyword && orgSearchResults.length === 0" style="color:#5a7a9a;text-align:center;padding:20px">未找到组织</div>
        </el-tab-pane>

        <!-- 邀请码加入 -->
        <el-tab-pane label="邀请码加入" name="invite">
          <el-form label-width="80px">
            <el-form-item label="组织ID">
              <el-input v-model="inviteForm.orgId" placeholder="组织ID" />
            </el-form-item>
            <el-form-item label="邀请码">
              <el-input v-model="inviteForm.inviteCode" placeholder="邀请码" />
            </el-form-item>
            <el-button type="primary" @click="handleJoinByCode" :loading="joinLoading">加入</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 创建组织 -->
        <el-tab-pane label="创建组织" name="create">
          <el-form label-width="80px">
            <el-form-item label="名称">
              <el-input v-model="createOrgForm.name" placeholder="如：北京大学" />
            </el-form-item>
            <el-form-item label="Slug">
              <el-input v-model="createOrgForm.slug" placeholder="如：pku（英文标识，唯一）" />
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="createOrgForm.org_type" style="width:100%">
                <el-option label="校园" value="campus" />
                <el-option label="医院" value="hospital" />
                <el-option label="政府" value="government" />
                <el-option label="企业" value="enterprise" />
              </el-select>
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="createOrgForm.description" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="邀请码">
              <el-input v-model="createOrgForm.invite_code" placeholder="可选，设置后加入需要邀请码" />
            </el-form-item>
            <el-button type="primary" @click="handleCreateOrg" :loading="createOrgLoading">创建</el-button>
          </el-form>
        </el-tab-pane>

        <!-- 我的组织 -->
        <el-tab-pane label="我的组织" name="mine">
          <div v-for="org in auth.organizations" :key="org.id" class="org-item">
            <div class="org-info">
              <span class="org-name">{{ org.name }}</span>
              <span class="org-type-tag">{{ org.org_type }}</span>
              <span class="role-badge" :class="auth.memberships.find(m => m.org_id === org.id)?.role">
                {{ auth.memberships.find(m => m.org_id === org.id)?.role }}
              </span>
            </div>
            <div class="org-actions">
              <el-button
                v-if="org.id !== auth.currentOrgId"
                type="primary" text size="small"
                @click="onOrgSwitch(org.id)"
              >切换</el-button>
              <span v-else class="current-tag">当前</span>
              <el-button
                v-if="auth.memberships.find(m => m.org_id === org.id)?.role !== 'owner'"
                type="danger" text size="small"
                @click="handleLeaveOrg(org.id)"
              >退出</el-button>
            </div>
          </div>
          <div v-if="auth.organizations.length === 0" style="color:#5a7a9a;text-align:center;padding:20px">暂未加入任何组织</div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useContainerStore } from '../stores/container'
import { useAuthStore } from '../stores/auth'
import { containerApi, type ContainerTreeNode } from '../api/containers'
import { orgApi, type OrganizationRead } from '../api/organizations'
import { reservationApi, type ReservationRead } from '../api/reservations'

const router = useRouter()
const store = useContainerStore()
const auth = useAuthStore()

const campus = computed(() => store.tree[0] || null)

// 个人视图
const myReservations = ref<ReservationRead[]>([])
const showMyReservations = ref(false)
const myPendingCount = computed(() => myReservations.value.filter(r => r.status === 'pending').length)
const myApprovedCount = computed(() => myReservations.value.filter(r => r.status === 'approved').length)

async function fetchMyReservations() {
  if (!auth.isMember) return
  try {
    const { data } = await reservationApi.my()
    myReservations.value = data
  } catch (e) { console.warn('获取预约数据失败', e) }
}

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', cancelled: '已取消' }
  return map[status] || status
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatTimeShort(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getRoomName(roomId: string): string {
  for (const bld of campus.value?.children || []) {
    for (const floor of bld.children || []) {
      for (const room of floor.children || []) {
        if (room.id === roomId) return `${bld.name} ${room.name}`
      }
    }
  }
  return roomId.slice(0, 8)
}

function goToRoom(roomId: string) {
  // 找到房间所属建筑
  for (const bld of campus.value?.children || []) {
    for (const floor of bld.children || []) {
      for (const room of floor.children || []) {
        if (room.id === roomId) {
          router.push({ name: 'building', params: { id: bld.id } })
          return
        }
      }
    }
  }
}

// 编辑功能
interface AttrItem { key: string; value: string }
const editDialogVisible = ref(false)
const editDialogTitle = ref('')
const editLoading = ref(false)
const editForm = ref({
  id: '',
  name: '',
  baseAttrs: [] as AttrItem[],
  extAttrs: [] as AttrItem[],
})

// 搜索功能
const searchKeyword = ref('')

interface SearchItem {
  id: string
  name: string
  type: string
  path: string
  buildingId?: string
}

const searchResults = computed(() => {
  if (!searchKeyword.value || !campus.value) return []
  const kw = searchKeyword.value.toLowerCase()
  const results: SearchItem[] = []
  const campusName = campus.value.name

  for (const bld of campus.value.children || []) {
    if (bld.name.toLowerCase().includes(kw)) {
      results.push({ id: bld.id, name: bld.name, type: bld.type, path: campusName, buildingId: bld.id })
    }
    for (const floor of bld.children || []) {
      if (floor.name.toLowerCase().includes(kw)) {
        results.push({ id: floor.id, name: floor.name, type: floor.type, path: `${campusName} / ${bld.name}`, buildingId: bld.id })
      }
      for (const room of floor.children || []) {
        if (room.name.toLowerCase().includes(kw) || (room.base_attrs?.room_number || '').toLowerCase().includes(kw)) {
          results.push({ id: room.id, name: room.name, type: room.type, path: `${campusName} / ${bld.name} / ${floor.name}`, buildingId: bld.id })
        }
      }
    }
  }
  return results.slice(0, 20)
})

function typeLabel(type: string) {
  const map: Record<string, string> = { campus: '校园', building: '建筑', floor: '楼层', room: '房间', resource: '设备' }
  return map[type] || type
}

function onSearchItemClick(item: SearchItem) {
  if (item.type === 'building') {
    router.push({ name: 'building', params: { id: item.id } })
  } else if (item.buildingId) {
    router.push({ name: 'building', params: { id: item.buildingId } })
  }
}

// 新建建筑
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

async function handleAddBuilding() {
  if (!addForm.value.name || !campus.value) return
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
      parent_id: campus.value.id,
      base_attrs: baseAttrs,
      position: { x: addForm.value.position.x, y: 0, z: addForm.value.position.z },
      dimensions: { width: addForm.value.dimensions.width, height: addForm.value.dimensions.height, depth: addForm.value.dimensions.depth },
    })
    showAddBuilding.value = false
    addForm.value.name = ''
    await store.fetchTree()
  } finally {
    addLoading.value = false
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
    // 尝试解析数值
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

function buildingIcon(name: string) {
  if (name.includes('图书') || name.includes('Library')) return '📚'
  if (name.includes('行政') || name.includes('Admin')) return '🏛'
  return '🏢'
}

function goToBuilding(id: string) {
  router.push({ name: 'building', params: { id } })
}

function editCampus() {
  if (!campus.value) return
  openEditDialog(campus.value)
}

function editBuilding(building: ContainerTreeNode) {
  openEditDialog(building)
}

function openEditDialog(node: ContainerTreeNode) {
  editDialogTitle.value = `编辑${node.type === 'campus' ? '校园' : '建筑'} - ${node.name}`
  editForm.value = {
    id: node.id,
    name: node.name,
    baseAttrs: objToAttrs(node.base_attrs),
    extAttrs: objToAttrs(node.ext_attrs),
  }
  editDialogVisible.value = true
}

async function handleEditSubmit() {
  editLoading.value = true
  try {
    await containerApi.update(editForm.value.id, {
      name: editForm.value.name,
      base_attrs: attrsToObj(editForm.value.baseAttrs),
      ext_attrs: attrsToObj(editForm.value.extAttrs),
    })
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    await store.fetchTree()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '更新失败')
  } finally {
    editLoading.value = false
  }
}

async function loadData() {
  await store.fetchTree()
}

// 组织管理
const showJoinOrg = ref(false)
const orgTab = ref('search')
const orgSearchKeyword = ref('')
const orgSearchResults = ref<OrganizationRead[]>([])
const joinLoading = ref(false)
const inviteForm = ref({ orgId: '', inviteCode: '' })
const createOrgLoading = ref(false)
const createOrgForm = ref({
  name: '',
  slug: '',
  org_type: 'campus',
  description: '',
  invite_code: '',
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
function handleOrgSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  if (!orgSearchKeyword.value) {
    orgSearchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await orgApi.search(orgSearchKeyword.value)
      orgSearchResults.value = data
    } catch {
      orgSearchResults.value = []
    }
  }, 300)
}

async function handleJoinOrg(org: OrganizationRead) {
  joinLoading.value = true
  try {
    await auth.joinOrganization(org.id)
    ElMessage.success(`已加入组织：${org.name}`)
    await store.fetchTree()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '加入失败')
  } finally {
    joinLoading.value = false
  }
}

async function handleJoinByCode() {
  if (!inviteForm.value.orgId || !inviteForm.value.inviteCode) {
    ElMessage.warning('请填写组织ID和邀请码')
    return
  }
  joinLoading.value = true
  try {
    await auth.joinOrganization(inviteForm.value.orgId, inviteForm.value.inviteCode)
    ElMessage.success('加入成功')
    inviteForm.value = { orgId: '', inviteCode: '' }
    await store.fetchTree()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '加入失败')
  } finally {
    joinLoading.value = false
  }
}

async function handleCreateOrg() {
  if (!createOrgForm.value.name || !createOrgForm.value.slug) {
    ElMessage.warning('请填写组织名称和Slug')
    return
  }
  createOrgLoading.value = true
  try {
    await orgApi.create({
      name: createOrgForm.value.name,
      slug: createOrgForm.value.slug,
      org_type: createOrgForm.value.org_type,
      description: createOrgForm.value.description || undefined,
      invite_code: createOrgForm.value.invite_code || undefined,
    })
    ElMessage.success('组织创建成功，你已成为owner')
    createOrgForm.value = { name: '', slug: '', org_type: 'campus', description: '', invite_code: '' }
    await auth.fetchMe()
    await store.fetchTree()
    orgTab.value = 'mine'
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '创建失败')
  } finally {
    createOrgLoading.value = false
  }
}

async function handleLeaveOrg(orgId: string) {
  try {
    await auth.leaveOrganization(orgId)
    ElMessage.success('已退出组织')
    await store.fetchTree()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '退出失败')
  }
}

async function onOrgSwitch(orgId: string) {
  auth.switchOrganization(orgId)
  await store.fetchTree()
}

onMounted(() => {
  if (auth.token && !auth.user) {
    auth.fetchMe()
  }
  if (store.tree.length === 0) {
    loadData()
  }
  fetchMyReservations()
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #0a1628;
  padding: 40px;
}
@media (max-width: 768px) {
  .home { padding: 16px; }
  h1 { font-size: 24px !important; }
  .personal-grid { grid-template-columns: 1fr; }
  .stat-cards { flex-direction: row; }
  .stat-card { flex: 1; flex-direction: column; align-items: center; text-align: center; }
  .buildings { grid-template-columns: 1fr; }
  .campus-attrs { flex-direction: column; gap: 8px; }
  .user-bar { flex-wrap: wrap; }
  .org-bar { flex-wrap: wrap; }
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
h1 {
  font-size: 36px;
  background: linear-gradient(135deg, #64b5f6, #42a5f5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}
.subtitle {
  color: #5a7a9a;
  font-size: 16px;
}
.user-bar {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.user-name {
  color: #64b5f6;
  font-size: 14px;
}
.role-tag {
  background: #e6a23c;
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}
.role-tag.member {
  background: #67c23a;
}
.role-tag.guest {
  background: #909399;
}
.campus-section {
  max-width: 1000px;
  margin: 0 auto 24px;
}
.campus-card {
  background: #0f2744;
  border: 1px solid #1e3a5f;
  border-radius: 12px;
  padding: 20px 24px;
}
.campus-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.campus-header h2 {
  color: #64b5f6;
  margin: 0;
  font-size: 22px;
}
.campus-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
}
.personal-section {
  max-width: 1000px;
  margin: 0 auto 24px;
}
.personal-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}
.stat-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stat-card {
  background: #0f2744;
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color 0.2s;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.stat-card:hover {
  border-color: #42a5f5;
}
.stat-number {
  color: #64b5f6;
  font-size: 28px;
  font-weight: 600;
}
.stat-label {
  color: #5a7a9a;
  font-size: 13px;
}
.recent-reservations {
  background: #0f2744;
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  padding: 16px;
}
.recent-reservations h4 {
  color: #64b5f6;
  margin: 0 0 10px 0;
  font-size: 14px;
}
.reservation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid #1e3a5f;
  cursor: pointer;
  transition: background 0.2s;
}
.reservation-item:last-child {
  border-bottom: none;
}
.reservation-item:hover {
  background: rgba(66, 165, 245, 0.05);
}
.res-status {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.res-status.pending { background: #e6a23c; color: #fff; }
.res-status.approved { background: #67c23a; color: #fff; }
.res-status.rejected { background: #f56c6c; color: #fff; }
.res-status.cancelled { background: #909399; color: #fff; }
.res-room {
  color: #e0e6ed;
  font-size: 13px;
  flex: 1;
}
.res-time {
  color: #5a7a9a;
  font-size: 12px;
  flex-shrink: 0;
}
.reservation-drawer-item {
  padding: 10px 0;
  border-bottom: 1px solid #1e3a5f;
  cursor: pointer;
}
.reservation-drawer-item:hover {
  background: rgba(66, 165, 245, 0.05);
}
.reservation-drawer-item .res-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.reservation-drawer-item .res-detail {
  color: #5a7a9a;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.res-title {
  color: #8ab4f8;
}
.attr-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.attr-label {
  color: #5a7a9a;
  font-size: 13px;
}
.attr-value {
  color: #e0e6ed;
  font-size: 14px;
}
.section-title {
  color: #5a7a9a;
  font-size: 14px;
  max-width: 1000px;
  margin: 0 auto 12px;
}
.buildings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  max-width: 1000px;
  margin: 0 auto;
}
.building-card {
  background: #0f2744;
  border: 1px solid #1e3a5f;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  gap: 16px;
  align-items: center;
  position: relative;
}
.building-card:hover {
  border-color: #42a5f5;
  background: #132e52;
  transform: translateY(-2px);
}
.building-icon {
  font-size: 40px;
}
.building-info h3 {
  color: #e0e6ed;
  margin-bottom: 4px;
}
.building-info p {
  color: #5a7a9a;
  font-size: 14px;
}
.edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
}
.empty {
  text-align: center;
  margin-top: 60px;
}
.loading {
  text-align: center;
  margin-top: 60px;
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
.search-bar {
  max-width: 1200px;
  margin: 0 auto 12px;
}
.search-results {
  max-width: 1200px;
  margin: 0 auto 16px;
  background: #0f2744;
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  overflow: hidden;
}
.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #1e3a5f;
  transition: background 0.2s;
}
.search-item:last-child {
  border-bottom: none;
}
.search-item:hover {
  background: #163050;
}
.search-type {
  background: #42a5f5;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  flex-shrink: 0;
}
.search-name {
  color: #e0e6ed;
  font-size: 14px;
}
.search-path {
  color: #5a7a9a;
  font-size: 12px;
  margin-left: auto;
}
.no-result {
  color: #5a7a9a;
  padding: 20px;
  text-align: center;
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
.org-bar {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.org-switch {
  color: #64b5f6;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.org-switch:hover {
  color: #42a5f5;
}
.org-type-tag {
  background: #1e3a5f;
  color: #8ab4f8;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  margin-left: 6px;
}
.role-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
}
.role-badge.owner {
  background: #e6a23c;
  color: #fff;
}
.role-badge.admin {
  background: #409eff;
  color: #fff;
}
.role-badge.member {
  background: #67c23a;
  color: #fff;
}
.org-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #1e3a5f;
}
.org-item:last-child {
  border-bottom: none;
}
.org-info {
  display: flex;
  align-items: center;
  gap: 4px;
}
.org-name {
  color: #e0e6ed;
  font-size: 14px;
}
.org-slug {
  color: #5a7a9a;
  font-size: 12px;
  margin-left: 6px;
}
.org-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.joined-tag {
  color: #67c23a;
  font-size: 12px;
}
.current-tag {
  color: #409eff;
  font-size: 12px;
}
</style>
