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
  join(orgId: string, inviteCode?: string) {
    const params: Record<string, string> = {}
    if (inviteCode) params.invite_code = inviteCode
    return api.post<{ message: string; org_id: string; role: string }>(`/orgs/${orgId}/join`, null, { params })
  },
  leave(orgId: string) {
    return api.post<{ message: string }>(`/orgs/${orgId}/leave`)
  },
}
