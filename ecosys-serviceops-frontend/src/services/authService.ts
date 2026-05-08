import { api } from '../lib/api'
import type { LoginResponse, SignupResponse } from '../types/api'

export type LoginInput = {
  email: string
  password: string
}

export type SignupInput = {
  fullName: string
  email: string
  password: string
  companyName: string
  industry?: string
  country: string
}

export const authService = {
  async login(input: LoginInput) {
    return api.post<LoginResponse>('/api/auth/login', {
      email: input.email.trim(),
      password: input.password,
    })
  },

  async signup(input: SignupInput) {
    return api.post<SignupResponse>('/api/auth/signup', {
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      password: input.password,
      companyName: input.companyName.trim(),
      industry: input.industry?.trim() || null,
      country: input.country.trim(),
    })
  },

  getCurrentUser(signal?: AbortSignal) {
    return api.get<unknown>('/api/auth/me', { signal })
  },

  async logout() {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Ignore logout network errors so we can always clear the local session.
    }
  },
}
