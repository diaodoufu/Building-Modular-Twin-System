<template>
  <div class="login-page">
    <div class="login-card">
      <h2 class="title">BMTS</h2>
      <p class="subtitle">建筑模块化孪生系统</p>

      <el-tabs v-model="mode" class="tabs">
        <el-tab-pane label="登录" name="login" />
        <el-tab-pane label="注册" name="register" />
      </el-tabs>

      <el-form :model="form" @submit.prevent="handleSubmit" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item v-if="mode === 'register'" label="显示名称">
          <el-input v-model="form.display_name" placeholder="如：张三" />
        </el-form-item>
        <el-button type="primary" style="width: 100%" @click="handleSubmit" :loading="loading">
          {{ mode === 'login' ? '登录' : '注册' }}
        </el-button>
      </el-form>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const error = ref('')
const form = ref({
  username: '',
  password: '',
  display_name: '',
})

async function handleSubmit() {
  error.value = ''
  if (!form.value.username || !form.value.password) {
    error.value = '请填写用户名和密码'
    return
  }
  loading.value = true
  try {
    if (mode.value === 'register') {
      if (!form.value.display_name) {
        error.value = '请填写显示名称'
        loading.value = false
        return
      }
      const { authApi } = await import('../api/auth')
      await authApi.register(form.value.username, form.value.password, form.value.display_name)
      ElMessage.success('注册成功，请登录')
      mode.value = 'login'
    } else {
      await auth.login(form.value.username, form.value.password)
      ElMessage.success('登录成功')
      router.push('/')
    }
  } catch (e: any) {
    error.value = e.response?.data?.detail || (mode.value === 'login' ? '登录失败' : '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafbfc;
  padding: 20px;
}
.login-card {
  width: 380px;
  padding: 40px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
@media (max-width: 480px) {
  .login-card { width: 100%; padding: 24px; border-radius: 0; border: none; }
}
.title {
  color: #2d3748;
  text-align: center;
  font-size: 28px;
  margin-bottom: 4px;
  font-weight: 600;
}
.subtitle {
  color: #718096;
  text-align: center;
  margin-bottom: 24px;
  font-size: 14px;
}
.tabs {
  margin-bottom: 16px;
}
.error {
  color: #dc2626;
  text-align: center;
  margin-top: 12px;
  font-size: 13px;
}
</style>
