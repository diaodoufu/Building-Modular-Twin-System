import api from './index'

export interface ImportResult {
  message: string
  stats: { created: number; skipped: number }
}

export const dataApi = {
  importFile(orgId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ImportResult>('/data/import', formData, {
      params: { org_id: orgId },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  exportJson(orgId: string) {
    return api.get('/data/export', { params: { org_id: orgId, format: 'json' } })
  },
  exportYaml(orgId: string) {
    return api.get('/data/export', { params: { org_id: orgId, format: 'yaml' } })
  },
}
