import api from './index'

export interface ContainerRead {
  id: string
  org_id: string
  type: string
  name: string
  parent_id: string | null
  sort_order: number
  base_attrs: Record<string, any>
  ext_attrs: Record<string, any>
  position: { x: number; y: number; z: number } | null
  dimensions: { width: number; height: number; depth: number } | null
  created_at: string
  updated_at: string
}

export interface ContainerTreeNode extends ContainerRead {
  children: ContainerTreeNode[]
}

export const containerApi = {
  list(orgId: string, parentId?: string | null, type?: string | null) {
    const params: any = { org_id: orgId }
    if (parentId !== undefined) params.parent_id = parentId
    if (type) params.type = type
    return api.get<ContainerRead[]>('/containers', { params })
  },
  tree(orgId: string) {
    return api.get<ContainerTreeNode[]>('/containers/tree', { params: { org_id: orgId } })
  },
  get(id: string) {
    return api.get<ContainerRead>(`/containers/${id}`)
  },
  children(id: string) {
    return api.get<ContainerRead[]>(`/containers/${id}/children`)
  },
  create(data: any) {
    return api.post<ContainerRead>('/containers', data)
  },
  update(id: string, data: any) {
    return api.put<ContainerRead>(`/containers/${id}`, data)
  },
  delete(id: string) {
    return api.delete(`/containers/${id}`)
  },
}
