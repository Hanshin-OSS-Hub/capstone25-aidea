import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config
    if (error.response?.status === 401 && !orig._retry) {
      orig._retry = true
      const rt = localStorage.getItem('unimate_refresh_token')
      if (rt) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refresh_token: rt })
          const newAccess = data.data.access_token
          useAuthStore.getState().setTokens(newAccess)
          localStorage.setItem('unimate_refresh_token', data.data.refresh_token)
          orig.headers.Authorization = `Bearer ${newAccess}`
          return apiClient(orig)
        } catch {
          localStorage.removeItem('unimate_refresh_token')
        }
      }
      useAuthStore.getState().clearUser()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
