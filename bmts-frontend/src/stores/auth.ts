import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi, type UserRead } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserRead | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  async function login(username: string, password: string) {
    const { data } = await authApi.login(username, password)
    token.value = data.access_token
    localStorage.setItem('token', data.access_token)
    await fetchMe()
  }

  async function fetchMe() {
    try {
      const { data } = await authApi.me()
      user.value = data
    } catch {
      user.value = null
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  return { user, token, login, fetchMe, logout }
})
