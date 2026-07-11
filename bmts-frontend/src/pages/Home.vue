<template>
  <div class="home">
    <div class="header">
      <h1>BMTS - 建筑模块化孪生系统</h1>
      <p class="subtitle">北京信息科技大学 · 昌平校区</p>
    </div>
    <div class="buildings" v-if="campus">
      <div
        v-for="building in campus.children"
        :key="building.id"
        class="building-card"
        @click="goToBuilding(building.id)"
      >
        <div class="building-icon">{{ buildingIcon(building.type) }}</div>
        <div class="building-info">
          <h3>{{ building.name }}</h3>
          <p>{{ building.base_attrs?.area_sqm || '-' }} m²</p>
          <p>{{ building.base_attrs?.total_floors || '-' }} 层</p>
        </div>
      </div>
    </div>
    <div v-else class="loading">
      <el-button type="primary" @click="loadData" :loading="store.loading">加载数据</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useContainerStore } from '../stores/container'

const router = useRouter()
const store = useContainerStore()

const campus = computed(() => store.tree[0] || null)

function buildingIcon(type: string) {
  const icons: Record<string, string> = {
    building: '🏛',
    library: '📚',
  }
  return icons[type] || '🏢'
}

function goToBuilding(id: string) {
  router.push({ name: 'building', params: { id } })
}

async function loadData() {
  await store.fetchTree()
}

onMounted(() => {
  if (store.tree.length === 0) {
    loadData()
  }
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #0a1628;
  padding: 40px;
}
.header {
  text-align: center;
  margin-bottom: 40px;
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
.loading {
  text-align: center;
  margin-top: 60px;
}
</style>
