<template>
  <div class="stats-page">
    <div class="header">
      <h1>数据统计</h1>
      <el-button type="info" text @click="router.push('/')">返回首页</el-button>
    </div>

    <!-- 总览卡片 -->
    <div class="overview" v-if="usageData">
      <div class="stat-card main">
        <span class="stat-value">{{ usageData.summary.total }}</span>
        <span class="stat-label">总房间数</span>
      </div>
      <div class="stat-card reserved">
        <span class="stat-value">{{ usageData.summary.reserved }}</span>
        <span class="stat-label">今日已预约</span>
      </div>
      <div class="stat-card rate">
        <span class="stat-value">{{ usageData.summary.rate }}%</span>
        <span class="stat-label">空间利用率</span>
      </div>
    </div>

    <div class="charts-row">
      <!-- 建筑利用率柱状图 -->
      <div class="chart-card">
        <h3>建筑空间利用率</h3>
        <div ref="buildingChartRef" class="chart-container"></div>
      </div>

      <!-- 房间类型饼图 -->
      <div class="chart-card">
        <h3>房间类型分布</h3>
        <div ref="typeChartRef" class="chart-container"></div>
      </div>
    </div>

    <div class="charts-row">
      <!-- 预约趋势折线图 -->
      <div class="chart-card wide">
        <div class="chart-header">
          <h3>预约趋势</h3>
          <el-radio-group v-model="trendDays" size="small" @change="fetchTrends">
            <el-radio-button :value="7">近7天</el-radio-button>
            <el-radio-button :value="14">近14天</el-radio-button>
            <el-radio-button :value="30">近30天</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendChartRef" class="chart-container" style="height: 300px"></div>
      </div>
    </div>

    <!-- 建筑详情表格 -->
    <div class="chart-card" v-if="usageData?.buildings?.length">
      <h3>建筑利用率详情</h3>
      <el-table :data="usageData.buildings" style="width: 100%" :header-cell-style="{ background: '#0f2744', color: '#8ab4f8' }" :cell-style="{ background: '#0a1628', color: '#e0e6ed' }">
        <el-table-column prop="building_name" label="建筑名称" />
        <el-table-column prop="total_rooms" label="总房间数" width="100" />
        <el-table-column prop="reserved_rooms" label="已预约" width="80" />
        <el-table-column label="利用率" width="180">
          <template #default="{ row }">
            <div class="progress-row">
              <el-progress :percentage="row.rate" :color="getProgressColor(row.rate)" :stroke-width="12" />
              <span class="progress-text">{{ row.rate }}%</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 智能推荐 -->
    <div class="charts-row">
      <div class="chart-card wide">
        <div class="chart-header">
          <h3>智能推荐房间</h3>
          <div class="recommend-controls">
            <el-date-picker v-model="recommendDate" type="date" placeholder="选择日期" size="small"
              value-format="YYYY-MM-DD" style="width: 140px" />
            <el-select v-model="recommendDuration" size="small" style="width: 120px">
              <el-option label="30分钟" :value="30" />
              <el-option label="1小时" :value="60" />
              <el-option label="2小时" :value="120" />
              <el-option label="3小时" :value="180" />
            </el-select>
            <el-button type="primary" size="small" @click="fetchRecommend" :loading="recommendLoading">推荐</el-button>
          </div>
        </div>
        <div v-if="recommendData?.recommendations?.length" class="recommend-list">
          <div v-for="(r, idx) in recommendData.recommendations.slice(0, 5)" :key="r.room_id" class="recommend-item">
            <span class="recommend-rank">{{ idx + 1 }}</span>
            <div class="recommend-info">
              <span class="recommend-name">{{ r.room_name }}</span>
              <span class="recommend-meta">{{ typeLabel(r.room_type) }} | 容量{{ r.capacity }}人 | 推荐 {{ r.best_time.start }}-{{ r.best_time.end }} | {{ r.free_slots_count }}个空闲时段</span>
            </div>
            <el-button type="primary" size="small" @click="goToRoom(r.room_id)">预约</el-button>
          </div>
        </div>
        <div v-else-if="recommendData" class="empty-hint">该日期没有可用房间</div>
      </div>
    </div>

    <!-- 异常检测 -->
    <div class="chart-card" v-if="anomalyData && anomalyData.total > 0">
      <h3>异常占用检测</h3>
      <el-table :data="anomalyData.anomalies" style="width: 100%" :header-cell-style="{ background: '#0f2744', color: '#8ab4f8' }" :cell-style="{ background: '#0a1628', color: '#e0e6ed' }">
        <el-table-column label="类型" width="140">
          <template #default="{ row }">
            <el-tag :type="anomalyTagType(row.type)" size="small">{{ anomalyLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { statsApi, type SpaceUsage, type ReservationTrends, type RecommendResult, type AnomalyResult } from '../api/stats'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const orgId = computed(() => auth.currentOrgId || '')
const usageData = ref<SpaceUsage | null>(null)
const trendDays = ref(7)
const recommendDate = ref(new Date().toISOString().slice(0, 10))
const recommendDuration = ref(60)
const recommendLoading = ref(false)
const recommendData = ref<RecommendResult | null>(null)
const anomalyData = ref<AnomalyResult | null>(null)

const buildingChartRef = ref<HTMLElement>()
const typeChartRef = ref<HTMLElement>()
const trendChartRef = ref<HTMLElement>()

let buildingChart: echarts.ECharts | null = null
let typeChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null

function getProgressColor(rate: number) {
  if (rate >= 80) return '#f56c6c'
  if (rate >= 50) return '#e6a23c'
  return '#67c23a'
}

function renderBuildingChart() {
  if (!buildingChartRef.value || !usageData.value) return
  buildingChart = echarts.init(buildingChartRef.value)
  const data = usageData.value.buildings
  buildingChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 30, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map(b => b.building_name),
      axisLabel: { color: '#5a7a9a', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e3a5f' } },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#5a7a9a', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1e3a5f' } },
    },
    series: [{
      type: 'bar',
      data: data.map(b => ({
        value: b.rate,
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: b.rate >= 80 ? '#f56c6c' : b.rate >= 50 ? '#e6a23c' : '#64b5f6' },
          { offset: 1, color: b.rate >= 80 ? '#c45656' : b.rate >= 50 ? '#c68a30' : '#3a7bd5' },
        ]) },
      })),
      barWidth: '40%',
      label: { show: true, position: 'top', formatter: '{c}%', color: '#e0e6ed', fontSize: 12 },
    }],
  })
}

function renderTypeChart() {
  if (!typeChartRef.value || !usageData.value) return
  typeChart = echarts.init(typeChartRef.value)
  const typeMap: Record<string, string> = {
    classroom: '教室', office: '办公室', lab: '实验室',
    dormitory: '宿舍', meeting: '会议室', utility: '功能室',
    other: '其他',
  }
  const colors = ['#64b5f6', '#e6a23c', '#67c23a', '#f56c6c', '#909399', '#b37feb', '#36cfc9']
  typeChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      data: usageData.value.room_types.map((t, i) => ({
        name: typeMap[t.type] || t.type,
        value: t.total,
        itemStyle: { color: colors[i % colors.length] },
      })),
      label: { color: '#e0e6ed', fontSize: 12 },
      labelLine: { lineStyle: { color: '#5a7a9a' } },
    }],
  })
}

function renderTrendChart(data: ReservationTrends) {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }
  trendChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['总预约', '已通过', '待审核', '已拒绝'], textStyle: { color: '#5a7a9a' }, top: 0 },
    grid: { left: 50, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.trends.map(t => t.date.slice(5)),
      axisLabel: { color: '#5a7a9a', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e3a5f' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#5a7a9a' },
      splitLine: { lineStyle: { color: '#1e3a5f' } },
    },
    series: [
      { name: '总预约', type: 'line', data: data.trends.map(t => t.total), smooth: true, lineStyle: { color: '#64b5f6', width: 2 }, itemStyle: { color: '#64b5f6' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(100,181,246,0.3)' }, { offset: 1, color: 'rgba(100,181,246,0)' }]) } },
      { name: '已通过', type: 'line', data: data.trends.map(t => t.approved), smooth: true, lineStyle: { color: '#67c23a' }, itemStyle: { color: '#67c23a' } },
      { name: '待审核', type: 'line', data: data.trends.map(t => t.pending), smooth: true, lineStyle: { color: '#e6a23c' }, itemStyle: { color: '#e6a23c' } },
      { name: '已拒绝', type: 'line', data: data.trends.map(t => t.rejected), smooth: true, lineStyle: { color: '#f56c6c' }, itemStyle: { color: '#f56c6c' } },
    ],
  })
}

async function fetchUsage() {
  if (!orgId.value) return
  try {
    const { data } = await statsApi.usage(orgId.value)
    usageData.value = data
    await nextTick()
    renderBuildingChart()
    renderTypeChart()
  } catch (e) {
    console.error('获取统计数据失败', e)
  }
}

async function fetchTrends() {
  if (!orgId.value) return
  try {
    const { data } = await statsApi.trends(orgId.value, trendDays.value)
    await nextTick()
    renderTrendChart(data)
  } catch (e) {
    console.error('获取趋势数据失败', e)
  }
}

async function fetchRecommend() {
  if (!orgId.value) return
  recommendLoading.value = true
  try {
    const { data } = await statsApi.recommend(orgId.value, recommendDate.value, recommendDuration.value)
    recommendData.value = data
  } catch (e) {
    console.error('获取推荐失败', e)
  } finally {
    recommendLoading.value = false
  }
}

async function fetchAnomalies() {
  if (!orgId.value) return
  try {
    const { data } = await statsApi.anomalies(orgId.value)
    anomalyData.value = data
  } catch (e) {
    console.error('获取异常数据失败', e)
  }
}

function typeLabel(type: string) {
  const map: Record<string, string> = { classroom: '教室', office: '办公室', lab: '实验室', dormitory: '宿舍', meeting: '会议室', utility: '功能室' }
  return map[type] || type
}

function anomalyLabel(type: string) {
  const map: Record<string, string> = { stale_pending: '过期未审', high_frequency: '高频预约', potential_no_show: '可能未到场' }
  return map[type] || type
}

function anomalyTagType(type: string) {
  const map: Record<string, string> = { stale_pending: 'warning', high_frequency: 'danger', potential_no_show: 'info' }
  return map[type] || 'info'
}

function goToRoom(roomId: string) {
  // 找到房间所属建筑并跳转
  router.push({ name: 'building', params: { id: roomId } })
}

function handleResize() {
  buildingChart?.resize()
  typeChart?.resize()
  trendChart?.resize()
}

onMounted(async () => {
  await fetchUsage()
  await fetchTrends()
  await fetchAnomalies()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  buildingChart?.dispose()
  typeChart?.dispose()
  trendChart?.dispose()
})
</script>

<style scoped>
.stats-page {
  min-height: 100vh;
  background: #fafbfc;
  padding: 40px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto 24px;
}
h1 {
  font-size: 24px;
  color: #2d3748;
  font-weight: 600;
}
h3 {
  color: #2d3748;
  font-size: 15px;
  margin: 0;
  font-weight: 500;
}
.overview {
  display: flex;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto 24px;
}
.stat-card {
  flex: 1;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-card.main .stat-value { color: #4a90d9; }
.stat-card.reserved .stat-value { color: #d97706; }
.stat-card.rate .stat-value { color: #16a34a; }
.stat-value {
  font-size: 32px;
  font-weight: 600;
}
.stat-label {
  color: #718096;
  font-size: 14px;
  margin-top: 4px;
}
.charts-row {
  display: flex;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto 24px;
}
.chart-card {
  flex: 1;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
}
.chart-card.wide {
  flex: 2;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chart-container {
  height: 250px;
  width: 100%;
}
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-text {
  color: #2d3748;
  font-size: 13px;
  min-width: 40px;
}
.recommend-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}
.recommend-list {
  margin-top: 12px;
}
.recommend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}
.recommend-item:last-child {
  border-bottom: none;
}
.recommend-rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e8f0fe;
  color: #4a90d9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.recommend-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.recommend-name {
  color: #2d3748;
  font-size: 15px;
  font-weight: 500;
}
.recommend-meta {
  color: #718096;
  font-size: 12px;
}
.empty-hint {
  color: #a0aec0;
  text-align: center;
  padding: 24px;
}
</style>
