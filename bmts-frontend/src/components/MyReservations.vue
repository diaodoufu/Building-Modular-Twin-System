<template>
  <div class="my-reservations">
    <h3>我的预约</h3>
    <el-table :data="reservations" style="width: 100%" empty-text="暂无预约">
      <el-table-column prop="title" label="标题" width="140">
        <template #default="{ row }">{{ row.title || '未命名' }}</template>
      </el-table-column>
      <el-table-column label="日期" width="120">
        <template #default="{ row }">{{ formatDate(row.start_time) }}</template>
      </el-table-column>
      <el-table-column label="时间" width="120">
        <template #default="{ row }">{{ formatTime(row.start_time) }}-{{ formatTime(row.end_time) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'pending' || row.status === 'approved'"
            type="danger"
            text
            size="small"
            @click="handleCancel(row.id)"
          >
            取消
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reservationApi, type ReservationRead } from '../api/reservations'

const reservations = ref<ReservationRead[]>([])

async function fetchMyReservations() {
  try {
    const { data } = await reservationApi.my()
    reservations.value = data
  } catch {
    reservations.value = []
  }
}

async function handleCancel(id: string) {
  try {
    await ElMessageBox.confirm('确认取消此预约？', '提示', { type: 'warning' })
    await reservationApi.cancel(id)
    ElMessage.success('已取消')
    await fetchMyReservations()
  } catch { /* cancelled */ }
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', cancelled: '已取消' }
  return map[s] || s
}

function statusType(s: string) {
  const map: Record<string, string> = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'info' }
  return (map[s] || 'info') as any
}

onMounted(fetchMyReservations)

defineExpose({ fetchMyReservations })
</script>

<style scoped>
.my-reservations h3 {
  color: #2d3748;
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 500;
}
</style>
