<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
onMounted(() => {
  if (auth.token && !auth.user) {
    auth.fetchMe()
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  background: #fafbfc;
  color: #2d3748;
  line-height: 1.6;
}

:root {
  --primary-color: #4a90d9;
  --primary-light: #e8f0fe;
  --primary-dark: #357abd;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --danger-color: #ff4d4f;
  --text-primary: #2d3748;
  --text-secondary: #718096;
  --text-muted: #a0aec0;
  --border-color: #e2e8f0;
  --bg-card: #ffffff;
  --bg-hover: #f7fafc;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
}
</style>
