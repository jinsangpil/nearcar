/**
 * 본인인증 API 클라이언트
 * KCP 본인인증 연동
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 본인인증 요청
export interface VerificationRequestRequest {
  phone: string;
  name?: string; // 선택적 (KCP 본인인증에서 확인)
}

// 본인인증 요청 응답
export interface VerificationRequestResponse {
  verification_id: string;
  redirect_url?: string; // KCP 본인인증 팝업 URL (있는 경우)
  message: string;
}

// 본인인증 확인 요청
export interface VerificationConfirmRequest {
  verification_id: string;
  auth_code?: string; // SMS 인증번호 (SMS 방식인 경우)
  kcp_result?: string; // KCP 본인인증 결과 (KCP 방식인 경우)
}

// 본인인증 확인 응답
export interface VerificationConfirmResponse {
  verified: boolean;
  phone: string;
  name?: string;
  ci?: string; // 연계정보 (CI)
  di?: string; // 중복가입확인정보 (DI)
  birth_date?: string; // 생년월일
}

/**
 * 본인인증 요청 (KCP 본인인증 시작)
 */
export const requestVerification = async (
  request: VerificationRequestRequest
): Promise<VerificationRequestResponse> => {
  try {
    const response = await apiClient.post<StandardResponse<VerificationRequestResponse>>(
      '/client/verification/request',
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '본인인증 요청에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('본인인증 요청 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('본인인증 요청에 실패했습니다');
  }
};

/**
 * 본인인증 확인 (KCP 본인인증 결과 확인)
 */
export const confirmVerification = async (
  request: VerificationConfirmRequest
): Promise<VerificationConfirmResponse> => {
  try {
    const response = await apiClient.post<StandardResponse<VerificationConfirmResponse>>(
      '/client/verification/confirm',
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '본인인증 확인에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('본인인증 확인 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('본인인증 확인에 실패했습니다');
  }
};

/**
 * SMS 인증번호 발송 (대체 방식)
 */
export const sendVerificationCode = async (phone: string): Promise<{ message: string }> => {
  try {
    const response = await apiClient.post<StandardResponse<{ message: string }>>(
      '/client/verification/send-code',
      { phone }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '인증번호 발송에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('인증번호 발송 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('인증번호 발송에 실패했습니다');
  }
};

