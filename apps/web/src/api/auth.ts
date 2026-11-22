import { apiClient } from './client';

export interface AuthAccount {
  id: string;
  email: string;
  username: string | null;
}

export interface AuthResponse {
  accessToken: string;
  account: AuthAccount;
  defaultUserId?: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  identifier: string;
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

export async function setUsername(username: string): Promise<AuthAccount> {
  const { data } = await apiClient.put<AuthAccount>('/auth/username', { username });
  return data;
}

export async function fetchCurrentAccount(): Promise<AuthAccount> {
  const { data } = await apiClient.get<AuthAccount>('/auth/me');
  return data;
}
