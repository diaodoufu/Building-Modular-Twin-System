<template>
  <div class="review-page">
    <div class="header">
      <h1>审核管理</h1>
      <el-button type="primary" text @click="router.push('/')">返回首页</el-button>
    </div>

    <div class="section">
      <h2>预约审核</h2>
      <div class="review-list" v-if="pendingList.length > 0">
        <div v-for="r in pendingList" :key="r.id" class="review-card">
          <div class="review-main">
            <div class="review-title">{{ r.title || '未命名预约' }}</div>
            <div class="review-meta">
              <span class="meta-item">房间: {{ r.room_id.slice(0, 8) }}...</span>
              <span class="meta-item">{{ formatTime(r.start_time) }} ~ {{ formatTime(r.end_time) }}</span>
              <span class="status-tag pending">待审核</span>
            </div>
          </div>
          <div class="review-actions">
            <el-button type="success" size="small" @click="handleApprove(r.id)" :loading="r._loading">通过</el-button>
            <el-button type="danger" size="small" @click="handleReject(r.id)" :loading="r._loading">拒绝</el-button>
          </div>
        </div>
      </div>
      <div v-else-if="!reservationLoading" class="empty">暂无待审核预约</div>
    </div>

    <div class="section">
      <h2>组织加入申请</h2>
      <div class="filter-bar">
        <el-select v-model="currentOrgId" placeholder="选择组织" @change="fetchJoinRequests" filterable style="width: 240px">
          <el-option v-for="org in adminOrgs" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
        <el-radio-group v-model="joinStatusFilter" @change="fetchJoinRequests" size="small">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="pending">待审核</el-radio-button>
          <el-radio-button label="approved">已通过</el-radio-button>
          <el-radio-button label="rejected">已拒绝</el-radio-button>
        </el-radio-group>
      </div>
      <div class="review-list" v-if="joinRequests.length > 0">
        <div v-for="req in joinRequests" :key="req.id" class="review-card">
          <div class="review-main">
            <div class="review-title">{{ req.display_name }} <span class="meta-username">@{{ req.username }}</span></div>
            <div class="review-meta">
              <span class="meta-item">{{ formatTime(req.created_at) }}</span>
              <span v-if="req.message" class="meta-item">{{ req.message }}</span>
              <span class="status-tag" :class="req.status">{{ joinStatusText(req.status) }}</span>
            </div>
          </div>
          <div class="review-actions" v-if="req.status === 'pending'">
            <el-button type="success" size="small" @click="handleApproveJoin(req)" :loading="req._loading">通过</el-button>
            <el-button type="danger" size="small" @click="handleRejectJoin(req)" :loading="req._loading">拒绝</el-button>
          </div>
        </div>
      </div>
      <div v-else-if="!joinLoading" class="empty">{{ currentOrgId ? '该组织暂无申请' : '请选择组织查看' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { reservationApi, type ReservationRead } from '../api/reservations'
import { orgApi, type JoinRequestRead } from '../api/organizations'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const pendingList = ref<(ReservationRead & { _loading?: boolean })[]>([])
const reservationLoading = ref(true)

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function fetchPending() {
  reservationLoading.value = true
  try {
    const { data } = await reservationApi.pending()
    pendingList.value = data.map(r => ({ ...r, _loading: false }))
  } catch (e: any) {
    if (e.response?.status === 403) {
      ElMessage.error('需要管理员权限')
      router.push('/')
    }
  } finally {
    reservationLoading.value = false
  }
}

async function handleApprove(id: string) {
  const item = pendingList.value.find(r => r.id === id)
  if (item) item._loading = true
  try {
    await reservationApi.approve(id)
    ElMessage.success('已通过')
    pendingList.value = pendingList.value.filter(r => r.id !== id)
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '操作失败')
  } finally {
    if (item) item._loading = false
  }
}

async function handleReject(id: string) {
  const item = pendingList.value.find(r => r.id === id)
  if (item) item._loading = true
  try {
    await reservationApi.reject(id)
    ElMessage.success('已拒绝')
    pendingList.value = pendingList.value.filter(r => r.id !== id)
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '操作失败')
  } finally {
    if (item) item._loading = false
  }
}

const currentOrgId = ref<string>('')
const joinStatusFilter = ref<'' | 'pending' | 'approved' | 'rejected'>('')
const joinRequests = ref<(JoinRequestRead & { _loading?: boolean })[]>([])
const joinLoading = ref(true)

const adminOrgs = computed(() => {
  return auth.organizations.filter(org => {
    const role = auth.memberships.find(m => m.org_id === org.id)?.role
    return role === 'owner' || role === 'admin'
  })
})

function joinStatusText(s: string) {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return map[s] || s
}

async function fetchJoinRequests() {
  if (!currentOrgId.value) {
    joinRequests.value = []
    joinLoading.value = false
    return
  }
  joinLoading.value = true
  try {
    const filter = joinStatusFilter.value === '' ? undefined : joinStatusFilter.value
    const { data } = await orgApi.listJoinRequests(currentOrgId.value, filter)
    joinRequests.value = data.map(r => ({ ...r, _loading: false }))
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '加载失败')
  } finally {
    joinLoading.value = false
  }
}

async function handleApproveJoin(req: JoinRequestRead & { _loading?: boolean }) {
  req._loading = true
  try {
    await orgApi.approveJoinRequest(req.org_id, req.id)
    ElMessage.success(`已通过 ${req.display_name} 的申请`)
    await fetchJoinRequests()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '操作失败')
  } finally {
    req._loading = false
  }
}

async function handleRejectJoin(req: JoinRequestRead & { _loading?: boolean }) {
  req._loading = true
  try {
    await orgApi.rejectJoinRequest(req.org_id, req.id)
    ElMessage.success(`已拒绝 ${req.display_name} 的申请`)
    await fetchJoinRequests()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '操作失败')
  } finally {
    req._loading = false
  }
}

onMounted(async () => {
  await fetchPending()
  if (adminOrgs.value.length > 0) {
    currentOrgId.value = adminOrgs.value[0].id
  }
  await fetchJoinRequests()
})
</script>

<style scoped>
.review-page {
  min-height: 100vh;
  background: #fafbfc;
  padding: 40px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}
h1 {
  font-size: 24px;
  color: #2d3748;
  font-weight: 600;
  margin: 0;
}
.section {
  max-width: 900px;
  margin: 0 auto 32px;
}
h2 {
  font-size: 16px;
  color: #718096;
  font-weight: 500;
  margin: 0 0 16px 0;
}
.review-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.review-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.review-title {
  color: #2d3748;
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
}
.meta-username {
  color: #a0aec0;
  font-size: 12px;
  font-weight: normal;
}
.review-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.meta-item {
  color: #718096;
  font-size: 13px;
}
.status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.status-tag.pending { background: #fef3c7; color: #d97706; }
.status-tag.approved { background: #dcfce7; color: #16a34a; }
.status-tag.rejected { background: #fee2e2; color: #dc2626; }
.review-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.empty {
  text-align: center;
  color: #a0aec0;
  padding: 32px;
  font-size: 14px;
}
</style>
