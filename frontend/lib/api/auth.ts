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
  try {
    const response = await apiClient.get<StandardResponse<UserInfo>>('/users/me', {
      timeout: 5000, // 5초 타임아웃
    });
    
    // 응답 형식 확인
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || '사용자 정보를 가져올 수 없습니다');
    }
  } catch (error: any) {
    console.error('getCurrentUser 오류:', error);
    
    // 네트워크 오류
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('서버 응답 시간이 초과되었습니다');
    }
    
    // 401 에러인 경우 이미 인터셉터에서 처리됨
    if (error.response?.status === 401) {
      throw new Error('인증이 필요합니다');
    }
    
    // 403 에러
    if (error.response?.status === 403) {
      throw new Error('권한이 없습니다');
    }
    
    throw error instanceof Error ? error : new Error('사용자 정보를 가져올 수 없습니다');
  }
};

