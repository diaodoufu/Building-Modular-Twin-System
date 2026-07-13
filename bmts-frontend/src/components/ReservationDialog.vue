<template>
  <el-dialog v-model="visible" title="预约房间" width="480px" @close="resetForm">
    <div class="room-info" v-if="room">
      <el-tag type="info" size="small">{{ roomTypeLabel }}</el-tag>
      <span class="room-name">{{ room.name }}</span>
      <span class="room-capacity">{{ room.base_attrs?.capacity || '-' }}人</span>
    </div>

    <el-form :model="form" label-width="80px" style="margin-top: 16px">
      <el-form-item label="日期">
        <el-date-picker
          v-model="form.date"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DD"
          :disabled-date="disablePastDate"
          @change="loadAvailability"
        />
      </el-form-item>
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="如：高等数学课" />
      </el-form-item>
      <el-form-item label="时间段">
        <div class="time-range">
          <el-select v-model="form.startTime" placeholder="开始时间" style="width: 45%">
            <el-option
              v-for="s in startOptions"
              :key="s.value"
              :label="s.label"
              :value="s.value"
              :disabled="s.disabled"
            />
          </el-select>
          <span style="margin: 0 8px; color: #5a7a9a">至</span>
          <el-select v-model="form.endTime" placeholder="结束时间" style="width: 45%">
            <el-option
              v-for="s in endOptions"
              :key="s.value"
              :label="s.label"
              :value="s.value"
              :disabled="s.disabled || s.value <= form.startTime"
            />
          </el-select>
        </div>
      </el-form-item>
    </el-form>

    <!-- 可视化时间轴 -->
    <div class="timeline" v-if="availability">
      <div class="timeline-label">08:00</div>
      <div class="timeline-bar">
        <div
          v-for="slot in availability.slots"
          :key="slot.start"
          class="timeline-slot"
          :class="{
            occupied: slot.status === 'occupied',
            selected: isSelectedSlot(slot),
            available: slot.status === 'available' && !isSelectedSlot(slot),
          }"
          :title="`${slot.start}-${slot.end} ${slot.status === 'occupied' ? '已占用' : '可用'}`"
        />
      </div>
      <div class="timeline-label">22:00</div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit" :loading="submitting" :disabled="!canSubmit">
        确认预约
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { reservationApi, type RoomAvailability } from '../api/reservations'
import type { ContainerRead } from '../api/containers'

const props = defineProps<{
  room: ContainerRead | null
}>()

const emit = defineEmits<{
  created: []
}>()

const visible = defineModel<boolean>({ default: false })
const availability = ref<RoomAvailability | null>(null)
const submitting = ref(false)

const form = ref({
  date: '',
  startTime: '',
  endTime: '',
  title: '',
})

const roomTypeLabel = computed(() => {
  const map: Record<string, string> = { classroom: '教室', lab: '实验室', office: '办公室', meeting: '会议室' }
  return map[props.room?.base_attrs?.room_type || ''] || '-'
})

function disablePastDate(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

async function loadAvailability() {
  if (!props.room || !form.value.date) return
  try {
    const { data } = await reservationApi.availability(props.room.id, form.value.date)
    availability.value = data
  } catch {
    availability.value = null
  }
}

const startOptions = computed(() => {
  if (!availability.value) return generateTimeOptions()
  return generateTimeOptions().map(opt => ({
    ...opt,
    disabled: isSlotOccupied(opt.value),
  }))
})

const endOptions = computed(() => {
  if (!availability.value) return generateTimeOptions()
  return generateTimeOptions().map(opt => ({
    ...opt,
    disabled: isSlotOccupied(opt.value),
  }))
})

function generateTimeOptions() {
  const options: { value: string; label: string; disabled?: boolean }[] = []
  for (let h = 8; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      options.push({ value, label: value })
    }
  }
  return options
}

function isSlotOccupied(time: string): boolean {
  if (!availability.value) return false
  return availability.value.slots.some(s => s.start === time && s.status === 'occupied')
}

function isSelectedSlot(slot: { start: string; end: string }): boolean {
  if (!form.value.startTime || !form.value.endTime) return false
  return slot.start >= form.value.startTime && slot.end <= form.value.endTime
}

const canSubmit = computed(() => {
  return form.value.date && form.value.startTime && form.value.endTime && form.value.startTime < form.value.endTime
})

function resetForm() {
  form.value = { date: '', startTime: '', endTime: '', title: '' }
  availability.value = null
}

async function submit() {
  if (!props.room || !canSubmit.value) return
  submitting.value = true
  try {
    const startDateTime = `${form.value.date}T${form.value.startTime}:00`
    const endDateTime = `${form.value.date}T${form.value.endTime}:00`
    await reservationApi.create({
      room_id: props.room.id,
      title: form.value.title || undefined,
      start_time: startDateTime,
      end_time: endDateTime,
    })
    ElMessage.success('预约成功！')
    visible.value = false
    emit('created')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.detail || '预约失败')
  } finally {
    submitting.value = false
  }
}

// 当对话框打开且有房间时，默认选明天
watch(visible, (v) => {
  if (v && props.room) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    form.value.date = tomorrow.toISOString().split('T')[0]
    loadAvailability()
  }
})
</script>

<style scoped>
.room-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #0f2744;
  border-radius: 8px;
}
.room-name {
  color: #e0e6ed;
  font-weight: 500;
}
.room-capacity {
  color: #5a7a9a;
  font-size: 13px;
}
.time-range {
  display: flex;
  align-items: center;
  width: 100%;
}
.timeline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 0;
}
.timeline-label {
  color: #5a7a9a;
  font-size: 11px;
  flex-shrink: 0;
}
.timeline-bar {
  flex: 1;
  display: flex;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
}
.timeline-slot {
  flex: 1;
  min-width: 3px;
  transition: all 0.15s;
}
.timeline-slot.available {
  background: #1b5e20;
}
.timeline-slot.occupied {
  background: #b71c1c;
}
.timeline-slot.selected {
  background: #42a5f5;
}
</style>
