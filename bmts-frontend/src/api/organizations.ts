import api from './index'

export interface OrganizationRead {
  id: string
  name: string
  slug: string
  org_type: string
  description: string | null
  invite_code: string | null
  logo_url: string | null
  base_attrs: Record<string, any>
  ext_attrs: Record<string, any>
  created_at: string
  updated_at: string
}

export interface OrgMemberInfo {
  org_id: string
  role: string
}

/** 加入组织接口返回结果 */
export interface JoinResult {
  status: 'joined' | 'pending'
  message: string
  org_id: string
  role?: string | null
  request_id?: string | null
}

/** 加入申请记录 */
export interface JoinRequestRead {
  id: string
  org_id: string
  user_id: string
  username: string
  display_name: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export const orgApi = {
  list() {
    return api.get<OrganizationRead[]>('/orgs')
  },
  myOrgs() {
    return api.get<OrganizationRead[]>('/orgs/my-orgs')
  },
  getById(orgId: string) {
    return api.get<OrganizationRead>(`/orgs/by-id/${orgId}`)
  },
  search(keyword: string) {
    return api.get<OrganizationRead[]>('/orgs/search', { params: { keyword } })
  },
  create(data: {
    name: string
    slug: string
    org_type: string
    description?: string
    invite_code?: string
    base_attrs?: Record<string, any>
    ext_attrs?: Record<string, any>
  }) {
    return api.post<OrganizationRead>('/orgs', data)
  },
  /**
   * 加入组织
   * @param inviteCode 提供则走"直接加入"路径；不提供则发起审核申请
   * @param message 申请留言（仅审核流程有效）
   */
  join(orgId: string, inviteCode?: string, message?: string) {
    const params: Record<string, string> = {}
    if (inviteCode) params.invite_code = inviteCode
    const body = message ? { message } : null
    return api.post<JoinResult>(`/orgs/${orgId}/join`, body, { params })
  },
  leave(orgId: string) {
    return api.post<{ message: string }>(`/orgs/${orgId}/leave`)
  },
  /** 当前用户的所有加入申请 */
  myJoinRequests() {
    return api.get<JoinRequestRead[]>('/orgs/my-join-requests')
  },
  /** 某组织的加入申请列表（管理员） */
  listJoinRequests(orgId: string, statusFilter?: 'pending' | 'approved' | 'rejected') {
    const params: Record<string, string> = {}
    if (statusFilter) params.status_filter = statusFilter
    return api.get<JoinRequestRead[]>(`/orgs/${orgId}/join-requests`, { params })
  },
  approveJoinRequest(orgId: string, requestId: string) {
    return api.post<JoinRequestRead>(`/orgs/${orgId}/join-requests/${requestId}/approve`)
  },
  rejectJoinRequest(orgId: string, requestId: string) {
    return api.post<JoinRequestRead>(`/orgs/${orgId}/join-requests/${requestId}/reject`)
  },
}
