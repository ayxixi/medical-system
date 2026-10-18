import { apiClient } from './client';

export interface AuthAccount {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  account: AuthAccount;
  defaultUserId?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function fetchCurrentAccount(): Promise<AuthAccount> {
  const { data } = await apiClient.get<AuthAccount>('/auth/me');
  return data;
}
