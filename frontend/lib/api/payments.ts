/**
 * 결제 API 클라이언트
 * KCP 표준결제 서비스 연동
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 결제 요청
export interface PaymentRequestRequest {
  inspection_id: string;
  amount: number;
  customer_info: {
    name?: string;
    phone: string;
    email?: string;
  };
}

// KCP 거래등록 응답
export interface KcpTradeRegisterResponse {
  approval_key: string;
  PayUrl: string;
  order_id: string;
  message?: string;
}

// 결제 요청 응답 (KCP)
export interface PaymentRequestResponse {
  order_id: string;
  approval_key: string;
  pay_url: string; // KCP 결제창 URL
  amount: number;
  // KCP 결제창 호출에 필요한 추가 정보
  site_cd?: string;
  pay_method?: string;
  currency?: string;
  shop_name?: string;
  ret_url?: string;
  good_name?: string;
  good_cd?: string;
  buyr_name?: string;
}

// 결제 확인 요청 (KCP 콜백 처리)
export interface PaymentConfirmRequest {
  order_id: string;
  approval_key?: string;
  kcp_result?: string; // KCP 본인인증/결제 결과
  // KCP 결제창에서 전달되는 파라미터들
  res_cd?: string;
  res_msg?: string;
  tno?: string;
  amount?: string;
}

// 결제 확인 응답
export interface PaymentConfirmResponse {
  payment_id: string;
  transaction_id: string;
  status: string;
  amount: number;
  paid_at?: string;
}

/**
 * 결제 요청 (KCP 거래등록 및 결제창 정보 조회)
 */
export const requestPayment = async (
  request: PaymentRequestRequest
): Promise<PaymentRequestResponse> => {
  try {
    const response = await apiClient.post<StandardResponse<PaymentRequestResponse>>(
      '/client/payments/request',
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '결제 요청에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('결제 요청 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('결제 요청에 실패했습니다');
  }
};

/**
 * 결제 확인 (KCP 결제창 콜백 처리)
 */
export const confirmPayment = async (
  request: PaymentConfirmRequest
): Promise<PaymentConfirmResponse> => {
  try {
    const response = await apiClient.post<StandardResponse<PaymentConfirmResponse>>(
      '/client/payments/confirm',
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '결제 확인에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('결제 확인 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('결제 확인에 실패했습니다');
  }
};

/**
 * 결제 상태 조회
 */
export const getPaymentStatus = async (paymentId: string): Promise<any> => {
  try {
    const response = await apiClient.get<StandardResponse<any>>(`/payments/${paymentId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '결제 상태 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('결제 상태 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('결제 상태 조회에 실패했습니다');
  }
};

