import apiClient from './client';
import type { StandardResponse } from '@/types/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const login = async (data: LoginRequest): Promise<TokenResponse> => {
  const response = await apiClient.post<StandardResponse<TokenResponse> | TokenResponse>('/auth/login', data);
  
  // 응답 형식 확인 (StandardResponse 또는 직접 TokenResponse)
  let tokenData: TokenResponse;
  if ('success' in response.data && response.data.success && response.data.data) {
    tokenData = response.data.data;
  } else if ('access_token' in response.data) {
    tokenData = response.data as TokenResponse;
  } else {
    throw new Error('로그인 응답 형식이 올바르지 않습니다');
  }
  
  // 토큰 저장
  if (typeof window !== 'undefined' && tokenData.access_token) {
    localStorage.setItem('access_token', tokenData.access_token);
  }
  
  return tokenData;
};

export const logout = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }
};

export const getCurrentUser = async (): Promise<UserInfo> => {
  const response = await apiClient.get<StandardResponse<UserInfo> | UserInfo>('/users/me');
  
  // 응답 형식 확인
  if ('success' in response.data && response.data.success && response.data.data) {
    return response.data.data;
  } else if ('id' in response.data) {
    return response.data as UserInfo;
  } else {
    throw new Error('사용자 정보 응답 형식이 올바르지 않습니다');
  }
};

