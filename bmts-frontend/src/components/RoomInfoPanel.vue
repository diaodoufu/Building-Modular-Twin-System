<template>
  <transition name="slide">
    <div v-if="room" class="info-panel">
      <div class="panel-header">
        <h3>{{ room.name }}</h3>
        <el-button text @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div class="panel-body">
        <div class="info-row">
          <span class="label">类型</span>
          <el-tag :type="tagType" size="small">{{ roomTypeLabel }}</el-tag>
        </div>
        <div class="info-row">
          <span class="label">面积</span>
          <span>{{ room.base_attrs?.area_sqm || '-' }} m²</span>
        </div>
        <div class="info-row">
          <span class="label">容量</span>
          <span>{{ room.base_attrs?.capacity || '-' }} 人</span>
        </div>
        <div class="info-row">
          <span class="label">投影仪</span>
          <span>{{ room.ext_attrs?.has_projector ? '有' : '无' }}</span>
        </div>
        <div class="info-row">
          <span class="label">白板</span>
          <span>{{ room.ext_attrs?.has_whiteboard ? '有' : '无' }}</span>
        </div>
        <div class="panel-actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { ContainerRead } from '../api/containers'

const props = defineProps<{
  room: ContainerRead | null
}>()

defineEmits<{
  close: []
}>()

const roomTypeLabel = computed(() => {
  const map: Record<string, string> = {
    classroom: '教室',
    lab: '实验室',
    office: '办公室',
    meeting: '会议室',
  }
  return map[props.room?.base_attrs?.room_type || ''] || props.room?.base_attrs?.room_type || '-'
})

const tagType = computed(() => {
  const map: Record<string, string> = {
    classroom: '',
    lab: 'success',
    office: 'warning',
    meeting: 'danger',
  }
  return (map[props.room?.base_attrs?.room_type || ''] || 'info') as any
})
</script>

<style scoped>
.info-panel {
  position: absolute;
  right: 20px;
  top: 20px;
  width: 300px;
  background: rgba(15, 39, 68, 0.95);
  border: 1px solid #1e3a5f;
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(10px);
  z-index: 100;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.panel-header h3 {
  color: #64b5f6;
  font-size: 18px;
}
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #c0cad8;
  font-size: 14px;
}
.panel-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
.label {
  color: #5a7a9a;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
