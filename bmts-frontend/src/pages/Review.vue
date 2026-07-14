<template>
  <div class="review-page">
    <div class="header">
      <h1>审核管理</h1>
      <div class="header-actions">
        <el-button type="primary" text @click="router.push('/')">返回首页</el-button>
      </div>
    </div>

    <div class="stats" v-if="pendingList.length > 0">
      <div class="stat-card">
        <span class="stat-num">{{ pendingList.length }}</span>
        <span class="stat-label">待审核预约</span>
      </div>
    </div>

    <div class="review-list" v-if="pendingList.length > 0">
      <div v-for="r in pendingList" :key="r.id" class="review-card">
        <div class="review-main">
          <div class="review-title">{{ r.title || '未命名预约' }}</div>
          <div class="review-meta">
            <span class="meta-item">房间ID: {{ r.room_id.slice(0, 8) }}...</span>
            <span class="meta-item">
              {{ formatTime(r.start_time) }} ~ {{ formatTime(r.end_time) }}
            </span>
            <span class="meta-item status-pending">{{ statusText(r.status) }}</span>
          </div>
        </div>
        <div class="review-actions">
          <el-button type="success" size="small" @click="handleApprove(r.id)" :loading="r._loading">
            通过
          </el-button>
          <el-button type="danger" size="small" @click="handleReject(r.id)" :loading="r._loading">
            拒绝
          </el-button>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="empty">
      <el-empty description="暂无待审核预约" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { reservationApi, type ReservationRead } from '../api/reservations'

const router = useRouter()
const pendingList = ref<(ReservationRead & { _loading?: boolean })[]>([])
const loading = ref(true)

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusText(s: string) {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    cancelled: '已取消',
  }
  return map[s] || s
}

async function fetchPending() {
  loading.value = true
  try {
    const { data } = await reservationApi.pending()
    pendingList.value = data.map(r => ({ ...r, _loading: false }))
  } catch (e: any) {
    if (e.response?.status === 403) {
      ElMessage.error('需要管理员权限')
      router.push('/')
    } else {
      ElMessage.error('加载失败')
    }
  } finally {
    loading.value = false
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

onMounted(fetchPending)
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
  margin-bottom: 24px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}
h1 {
  font-size: 24px;
  color: #2d3748;
  font-weight: 600;
}
.stats {
  display: flex;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto 24px;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-num {
  font-size: 32px;
  color: #d97706;
  font-weight: 600;
}
.stat-label {
  font-size: 13px;
  color: #718096;
}
.review-list {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.review-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.review-title {
  color: #2d3748;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 6px;
}
.review-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.meta-item {
  color: #718096;
  font-size: 13px;
}
.status-pending {
  color: #d97706;
}
.review-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.empty {
  text-align: center;
  margin-top: 80px;
}
</style>
