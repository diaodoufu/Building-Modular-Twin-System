import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/index'
import { authApi, type UserRead } from '../api/auth'
import { orgApi, type OrganizationRead, type OrgMemberInfo, type JoinResult } from '../api/organizations'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserRead | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const organizations = ref<OrganizationRead[]>([])
  const memberships = ref<OrgMemberInfo[]>([])
  const currentOrgId = ref<string | null>(localStorage.getItem('currentOrgId'))

  const isLoggedIn = computed(() => !!token.value)
  const currentRole = computed(() => {
    const m = memberships.value.find(m => m.org_id === currentOrgId.value)
    return m?.role || null
  })
  const isAdmin = computed(() => currentRole.value === 'owner' || currentRole.value === 'admin')
  const isMember = computed(() => !!currentRole.value)
  const currentOrg = computed(() => organizations.value.find(o => o.id === currentOrgId.value) || null)

  async function login(username: string, password: string) {
    const { data } = await authApi.login(username, password)
    token.value = data.access_token
    refreshToken.value = data.refresh_token
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('refreshToken', data.refresh_token)
    await fetchMe()
  }

  async function tryRefreshToken(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const { data } = await authApi.refresh(refreshToken.value)
      token.value = data.access_token
      refreshToken.value = data.refresh_token
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('refreshToken', data.refresh_token)
      return true
    } catch {
      return false
    }
  }

  async function fetchMe() {
    try {
      const { data } = await authApi.me()
      user.value = data
      // 获取组织信息
      try {
      const { data: roleData } = await api.get('/auth/my-role')
        memberships.value = roleData.organizations || []

        // 获取组织详情
        if (memberships.value.length > 0) {
          const { data: orgs } = await orgApi.myOrgs()
          organizations.value = orgs

          // 设置当前组织：优先使用localStorage保存的，否则取第一个
          if (currentOrgId.value && memberships.value.some(m => m.org_id === currentOrgId.value)) {
            // 已保存的组织仍然有效
          } else if (roleData.current_org_id) {
            currentOrgId.value = roleData.current_org_id
          } else if (memberships.value.length > 0) {
            currentOrgId.value = memberships.value[0].org_id
          }
          if (currentOrgId.value) {
            localStorage.setItem('currentOrgId', currentOrgId.value)
          }
        } else {
          organizations.value = []
          currentOrgId.value = null
          localStorage.removeItem('currentOrgId')
        }
      } catch {
        memberships.value = []
        organizations.value = []
        currentOrgId.value = null
        localStorage.removeItem('currentOrgId')
      }
    } catch {
      user.value = null
      memberships.value = []
      organizations.value = []
      currentOrgId.value = null
      localStorage.removeItem('currentOrgId')
    }
  }

  function switchOrganization(orgId: string) {
    const m = memberships.value.find(m => m.org_id === orgId)
    if (!m) return
    currentOrgId.value = orgId
    localStorage.setItem('currentOrgId', orgId)
  }

  async function joinOrganization(orgId: string, inviteCode?: string, message?: string): Promise<JoinResult> {
    const { data } = await orgApi.join(orgId, inviteCode, message)
    // 仅当真正加入后才刷新组织列表；申请中不需要刷新
    if (data.status === 'joined') {
      await fetchMe()
    }
    return data
  }

  async function leaveOrganization(orgId: string) {
    await orgApi.leave(orgId)
    if (currentOrgId.value === orgId) {
      // 切换到另一个组织
      const remaining = memberships.value.filter(m => m.org_id !== orgId)
      currentOrgId.value = remaining.length > 0 ? remaining[0].org_id : null
      if (currentOrgId.value) {
        localStorage.setItem('currentOrgId', currentOrgId.value)
      } else {
        localStorage.removeItem('currentOrgId')
      }
    }
    await fetchMe()
  }

  function logout() {
    token.value = null
    refreshToken.value = null
    user.value = null
    memberships.value = []
    organizations.value = []
    currentOrgId.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('currentOrgId')
  }

  return {
    user, token, refreshToken, organizations, memberships, currentOrgId,
    isLoggedIn, isAdmin, isMember, currentRole, currentOrg,
    login, fetchMe, switchOrganization, joinOrganization, leaveOrganization, tryRefreshToken, logout,
  }
})
