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
        <el-dropdown v-if="auth.isLoggedIn" @command="handleUserAction">
          <span class="user-menu">
            <el-icon><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              <el-dropdown-item command="delete-account" divided>注销账户</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
        <el-button v-if="auth.isAdmin" type="success" size="small" @click="showAddContainer = true">新建容器</el-button>
        <el-button type="primary" size="small" @click="router.push('/campus')">3D全景</el-button>
      </div>
    </div>
    <div class="section-title" v-else-if="campus" style="display:flex;justify-content:space-between">
      <span>暂无建筑</span>
      <el-button v-if="auth.isAdmin" type="success" size="small" @click="showAddContainer = true">新建容器</el-button>
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
      <div class="empty-content">
        <div class="empty-icon">🏢</div>
        <h3>暂无建筑</h3>
        <p>该组织下还没有建筑数据</p>
        <el-button type="primary" @click="showAddContainer = true">新建容器</el-button>
        <span class="empty-hint">在自己的组织下建立自己的工作空间</span>
      </div>
    </div>
    <div v-else class="welcome">
      <div class="welcome-content">
        <div class="welcome-icon">👋</div>
        <h2>欢迎使用 BMTS</h2>
        <p>建筑模块化孪生系统</p>
        <div class="welcome-actions">
          <el-button type="primary" size="large" @click="showJoinOrg = true">加入组织</el-button>
          <span class="welcome-hint">加入一个组织</span>
          <el-button size="large" @click="loadData" :loading="store.loading">查看已有数据</el-button>
        </div>
      </div>
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

    <!-- 新建容器组件 -->
    <ContainerCreate
      :visible="showAddContainer"
      :org-id="store.orgId"
      :type="'building'"
      :parent-id="campus?.id"
      :lock-parent-id="true"
      :lock-type="true"
      @update:visible="showAddContainer = false"
      @created="onContainerCreated"
    />

    <!-- 组织管理对话框 -->
    <el-dialog v-model="showJoinOrg" title="组织管理" width="560px" @open="onJoinDialogOpen">
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
            <div class="org-actions">
              <span v-if="isOrgJoined(org.id)" class="joined-tag">已加入</span>
              <span v-else-if="isOrgPending(org.id)" class="pending-tag">申请中</span>
              <el-button
                v-else
                type="primary" size="small"
                :loading="joinLoading === org.id"
                @click="handleJoinOrg(org)"
              >申请加入</el-button>
            </div>
          </div>
          <div v-if="orgSearchKeyword && orgSearchResults.length === 0" style="color:#5a7a9a;text-align:center;padding:20px">未找到组织</div>
          <div class="dialog-tip">提示：搜索加入需组织管理员审核通过后方可加入。</div>
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
            <el-button type="primary" @click="handleJoinByCode" :loading="joinLoading === 'invite'">直接加入</el-button>
          </el-form>
          <div class="dialog-tip">提示：邀请码正确即可直接加入组织（使用者身份），无需审核。</div>
        </el-tab-pane>

        <!-- 我的组织 -->
        <el-tab-pane :label="`我的组织(${auth.organizations.length})`" name="mine">
          <div v-for="org in auth.organizations" :key="org.id" class="org-item">
            <div class="org-info">
              <span class="org-name">{{ org.name }}</span>
              <span class="org-type-tag">{{ org.org_type }}</span>
              <span class="role-badge" :class="auth.memberships.find(m => m.org_id === org.id)?.role">
                {{ auth.memberships.find(m => m.org_id === org.id)?.role }}
              </span>
              <span v-if="org.invite_code" class="invite-code">邀请码: {{ org.invite_code }}</span>
            </div>
            <div class="org-actions">
              <el-button
                v-if="org.id !== auth.currentOrgId"
                type="primary" text size="small"
                @click="onOrgSwitch(org.id)"
              >切换</el-button>
              <span v-else class="current-tag">当前</span>
              <template v-if="isOrgAdmin(org.id)">
                <el-button type="info" text size="small" @click="handleRegenInviteCode(org.id)">重新生成邀请码</el-button>
                <el-button v-if="org.invite_code" type="warning" text size="small" @click="handleClearInviteCode(org.id)">清除邀请码</el-button>
              </template>
              <el-button
                v-if="auth.memberships.find(m => m.org_id === org.id)?.role !== 'owner'"
                type="danger" text size="small"
                @click="handleLeaveOrg(org.id)"
              >退出</el-button>
            </div>
          </div>
          <div v-if="auth.organizations.length === 0" style="color:#5a7a9a;text-align:center;padding:20px">暂未加入任何组织</div>
        </el-tab-pane>

        <!-- 我的申请 -->
        <el-tab-pane :label="`我的申请(${myJoinRequests.length})`" name="requests">
          <div v-for="req in myJoinRequests" :key="req.id" class="org-item">
            <div class="org-info">
              <span class="org-name">{{ orgNameMap[req.org_id] || req.org_id.slice(0, 8) }}</span>
              <span class="status-tag" :class="req.status">{{ joinStatusText(req.status) }}</span>
              <span class="org-slug">{{ formatRequestTime(req.created_at) }}</span>
            </div>
            <span v-if="req.message" class="req-message" :title="req.message">「{{ req.message }}」</span>
          </div>
          <div v-if="myJoinRequests.length === 0" style="color:#5a7a9a;text-align:center;padding:20px">暂无申请记录</div>
          <div class="dialog-tip">提示：被拒绝后可重新申请加入该组织。</div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useContainerStore } from '../stores/container'
import { useAuthStore } from '../stores/auth'
import { containerApi, type ContainerTreeNode } from '../api/containers'
import { orgApi, type OrganizationRead, type JoinRequestRead } from '../api/organizations'
import { reservationApi, type ReservationRead } from '../api/reservations'
import { authApi } from '../api/auth'
import ContainerCreate from '../components/ContainerCreate.vue'

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

// 新建容器
const showAddContainer = ref(false)

async function onContainerCreated() {
  await store.fetchTree()
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
// joinLoading 同时承担多个按钮的 loading 状态：'invite' 表示邀请码表单，org.id 表示对应组织
const joinLoading = ref<string | null>(null)
const inviteForm = ref({ orgId: '', inviteCode: '' })
const myJoinRequests = ref<JoinRequestRead[]>([])

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

/** 我已加入的组织ID集合 */
function isOrgJoined(orgId: string): boolean {
  return auth.organizations.some(o => o.id === orgId)
}
/** 该组织是否存在 pending 申请 */
function isOrgPending(orgId: string): boolean {
  return myJoinRequests.value.some(r => r.org_id === orgId && r.status === 'pending')
}

/** 是否为该组织的管理员（owner/admin） */
function isOrgAdmin(orgId: string): boolean {
  const role = auth.memberships.find(m => m.org_id === orgId)?.role
  return role === 'owner' || role === 'admin'
}

/** 申请状态中文 */
function joinStatusText(status: string): string {
  const map: Record<string, string> = { pending: '申请中', approved: '已通过', rejected: '已拒绝' }
  return map[status] || status
}

function formatRequestTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 申请列表里的组织名称映射：优先用已加入组织的名称，其次用搜索结果缓存 */
const orgNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const org of auth.organizations) map[org.id] = org.name
  for (const org of orgSearchResults.value) map[org.id] = org.name
  return map
})

async function fetchMyJoinRequests() {
  try {
    const { data } = await orgApi.myJoinRequests()
    myJoinRequests.value = data
  } catch {
    myJoinRequests.value = []
  }
}

function onJoinDialogOpen() {
  // 打开对话框时拉取最新申请列表
  fetchMyJoinRequests()
}

async function handleJoinOrg(org: OrganizationRead) {
  joinLoading.value = org.id
  try {
    const result = await auth.joinOrganization(org.id)
    if (result.status === 'joined') {
      ElMessage.success(`已加入组织：${org.name}`)
      await store.fetchTree()
    } else {
      ElMessage.success('申请已发送，等待组织管理员审核')
    }
    await fetchMyJoinRequests()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '加入失败')
  } finally {
    joinLoading.value = null
  }
}

async function handleJoinByCode() {
  if (!inviteForm.value.orgId || !inviteForm.value.inviteCode) {
    ElMessage.warning('请填写组织ID和邀请码')
    return
  }
  joinLoading.value = 'invite'
  try {
    const result = await auth.joinOrganization(inviteForm.value.orgId, inviteForm.value.inviteCode)
    if (result.status === 'joined') {
      ElMessage.success('加入成功')
      inviteForm.value = { orgId: '', inviteCode: '' }
      await store.fetchTree()
      await fetchMyJoinRequests()
    } else {
      // 走到这里的可能性：组织未设置 invite_code 时后端会返回 400，不会进入此分支
      ElMessage.info(result.message || '申请已发送')
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '加入失败')
  } finally {
    joinLoading.value = null
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

async function handleRegenInviteCode(orgId: string) {
  try {
    const { data } = await orgApi.updateInviteCode(orgId)
    const org = auth.organizations.find(o => o.id === orgId)
    if (org) org.invite_code = data.invite_code
    ElMessage.success(`邀请码已更新：${data.invite_code}`)
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '更新失败')
  }
}

async function handleClearInviteCode(orgId: string) {
  try {
    await orgApi.clearInviteCode(orgId)
    const org = auth.organizations.find(o => o.id === orgId)
    if (org) org.invite_code = null
    ElMessage.success('邀请码已清除')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '清除失败')
  }
}

async function onOrgSwitch(orgId: string) {
  auth.switchOrganization(orgId)
  await store.fetchTree()
}

async function handleUserAction(command: string) {
  if (command === 'logout') {
    auth.logout()
    router.push('/login')
  } else if (command === 'delete-account') {
    const confirm = await ElMessageBox.confirm(
      '确定要注销账户吗？此操作不可撤销，所有数据将被删除。',
      '确认注销',
      {
        type: 'warning',
        confirmButtonText: '确定注销',
        cancelButtonText: '取消',
      }
    )
    if (confirm) {
      try {
        await authApi.deleteAccount()
        auth.logout()
        ElMessage.success('账户已注销')
        router.push('/login')
      } catch (e: any) {
        ElMessage.error(e.response?.data?.detail || '注销失败')
      }
    }
  }
}

onMounted(async () => {
  if (auth.token && !auth.user) {
    await auth.fetchMe()
  }
  if (auth.isLoggedIn && auth.organizations.length > 0 && store.tree.length === 0) {
    await loadData()
  }
  fetchMyReservations()
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #fafbfc;
  padding: 40px;
}
@media (max-width: 768px) {
  .home { padding: 20px 16px; }
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
  margin-bottom: 32px;
}
h1 {
  font-size: 32px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}
.subtitle {
  color: #718096;
  font-size: 15px;
}
.user-bar {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.user-name {
  color: #4a90d9;
  font-size: 14px;
}
.role-tag {
  background: #fef3c7;
  color: #d97706;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.role-tag.member {
  background: #dcfce7;
  color: #16a34a;
}
.role-tag.guest {
  background: #f3f4f6;
  color: #6b7280;
}
.campus-section {
  max-width: 1000px;
  margin: 0 auto 28px;
}
.campus-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 24px;
}
.campus-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.campus-header h2 {
  color: #2d3748;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.campus-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
}
.personal-section {
  max-width: 1000px;
  margin: 0 auto 28px;
}
.personal-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}
.stat-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.stat-card:hover {
  background: #f7fafc;
}
.stat-number {
  color: #4a90d9;
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.stat-label {
  color: #718096;
  font-size: 13px;
}
.recent-reservations {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
}
.recent-reservations h4 {
  color: #2d3748;
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
}
.reservation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s;
}
.reservation-item:last-child {
  border-bottom: none;
}
.reservation-item:hover {
  background: #f7fafc;
}
.res-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
  font-weight: 500;
}
.res-status.pending { background: #fef3c7; color: #d97706; }
.res-status.approved { background: #dcfce7; color: #16a34a; }
.res-status.rejected { background: #fee2e2; color: #dc2626; }
.res-status.cancelled { background: #f3f4f6; color: #6b7280; }
.res-room {
  color: #2d3748;
  font-size: 14px;
  flex: 1;
}
.res-time {
  color: #a0aec0;
  font-size: 12px;
  flex-shrink: 0;
}
.reservation-drawer-item {
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
}
.reservation-drawer-item:hover {
  background: #f7fafc;
}
.reservation-drawer-item .res-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.reservation-drawer-item .res-detail {
  color: #a0aec0;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.res-title {
  color: #4a90d9;
}
.attr-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.attr-label {
  color: #a0aec0;
  font-size: 13px;
}
.attr-value {
  color: #2d3748;
  font-size: 14px;
}
.section-title {
  color: #718096;
  font-size: 14px;
  max-width: 1000px;
  margin: 0 auto 12px;
}
.buildings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  max-width: 1000px;
  margin: 0 auto;
}
.building-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 24px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  gap: 16px;
  align-items: center;
  position: relative;
}
.building-card:hover {
  background: #f7fafc;
}
.building-icon {
  font-size: 36px;
}
.building-info h3 {
  color: #2d3748;
  margin-bottom: 4px;
  font-size: 16px;
}
.building-info p {
  color: #718096;
  font-size: 13px;
  margin: 2px 0;
}
.edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
}
.empty {
  text-align: center;
  margin-top: 80px;
}
.empty-content {
  padding: 40px;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.empty-content h3 {
  color: #2d3748;
  font-size: 20px;
  margin-bottom: 8px;
}
.empty-content p {
  color: #718096;
  font-size: 14px;
  margin-bottom: 24px;
}
.empty-hint {
  display: block;
  color: #a0aec0;
  font-size: 12px;
  margin-top: 12px;
}
.welcome {
  text-align: center;
  padding: 80px 40px;
}
.welcome-content {
  max-width: 500px;
  margin: 0 auto;
}
.welcome-icon {
  font-size: 64px;
  margin-bottom: 24px;
}
.welcome-content h2 {
  color: #2d3748;
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}
.welcome-content p {
  color: #718096;
  font-size: 16px;
  margin-bottom: 32px;
}
.welcome-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
}
.welcome-hint {
  color: #a0aec0;
  font-size: 12px;
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
  margin: 0 auto 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
}
.search-item:last-child {
  border-bottom: none;
}
.search-item:hover {
  background: #f7fafc;
}
.search-type {
  background: #e8f0fe;
  color: #4a90d9;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  flex-shrink: 0;
}
.search-name {
  color: #2d3748;
  font-size: 14px;
}
.search-path {
  color: #a0aec0;
  font-size: 12px;
  margin-left: auto;
}
.no-result {
  color: #a0aec0;
  padding: 24px;
  text-align: center;
}
.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.pos-label {
  color: #a0aec0;
  font-size: 13px;
  min-width: 20px;
}
.org-bar {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.org-switch {
  color: #4a90d9;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.org-switch:hover {
  color: #357abd;
}
.org-type-tag {
  background: #f1f5f9;
  color: #64748b;
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
  font-weight: 500;
}
.role-badge.owner {
  background: #fef3c7;
  color: #d97706;
}
.role-badge.admin {
  background: #e8f0fe;
  color: #4a90d9;
}
.role-badge.member {
  background: #dcfce7;
  color: #16a34a;
}
.org-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.org-item:last-child {
  border-bottom: none;
}
.org-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.org-name {
  color: #2d3748;
  font-size: 14px;
}
.org-slug {
  color: #a0aec0;
  font-size: 12px;
  margin-left: 6px;
}
.org-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.joined-tag {
  color: #16a34a;
  font-size: 12px;
}
.pending-tag {
  color: #d97706;
  font-size: 12px;
}
.status-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  margin-left: 4px;
}
.status-tag.pending {
  background: #fef3c7;
  color: #d97706;
}
.status-tag.approved {
  background: #dcfce7;
  color: #16a34a;
}
.status-tag.rejected {
  background: #fee2e2;
  color: #dc2626;
}
.req-message {
  color: #a0aec0;
  font-size: 12px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dialog-tip {
  margin-top: 16px;
  color: #a0aec0;
  font-size: 12px;
  text-align: center;
}
.current-tag {
  color: #4a90d9;
  font-size: 12px;
}
.invite-code {
  color: #4a90d9;
  font-size: 12px;
  margin-left: 8px;
  font-family: monospace;
}
.user-menu {
  cursor: pointer;
  color: #718096;
  font-size: 16px;
  padding: 4px;
}
.user-menu:hover {
  color: #4a90d9;
}
</style>
