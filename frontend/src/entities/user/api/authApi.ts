import { http } from '@shared/api'

import type {
  AuthTokens,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from './authApi.typings'

export async function register(payload: RegisterRequest): Promise<AuthTokens> {
  const { data } = await http.post<AuthTokens>('/api/auth/register/', payload)
  return data
}

export async function login(payload: LoginRequest): Promise<AuthTokens> {
  const { data } = await http.post<AuthTokens>('/api/auth/login/', payload)
  return data
}

export async function logout(refresh: string): Promise<void> {
  await http.post('/api/auth/logout/', { refresh })
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>('/api/auth/me/')
  return data
}
