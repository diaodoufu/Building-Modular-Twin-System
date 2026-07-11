import api from './index'

export interface UserRead {
  id: string
  username: string
  display_name: string
  avatar: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  register(username: string, password: string, display_name: string) {
    return api.post<UserRead>('/auth/register', { username, password, display_name })
  },
  login(username: string, password: string) {
    return api.post<TokenResponse>('/auth/login', { username, password })
  },
  me() {
    return api.get<UserRead>('/auth/me')
  },
}
