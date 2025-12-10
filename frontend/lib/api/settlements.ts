/**
 * 정산 API 클라이언트
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 정산 내역
export interface SettlementItem {
  id: string;
  inspector_id: string;
  inspector_name?: string;
  inspection_id: string;
  total_sales: number;
  fee_rate: number;
  settle_amount: number;
  status: 'pending' | 'completed';
  settle_date: string;
  created_at: string;
}

// 정산 목록 응답
export interface SettlementListResponse {
  settlements: SettlementItem[];
  total: number;
  page: number;
  page_size: number;
}

// 정산 상세 응답
export interface SettlementDetailResponse {
  settlement: SettlementItem;
  inspection_detail?: {
    id: string;
    plate_number?: string;
    production_year?: number;
    location_address?: string;
    preferred_schedule?: string;
    status: string;
    total_amount: number;
  };
  inspector_detail?: {
    id: string;
    name: string;
    phone?: string;
    commission_rate?: number;
  };
}

// 정산 요약 응답
export interface SettlementSummaryResponse {
  total_pending_amount: number;
  total_completed_amount: number;
  pending_count: number;
  completed_count: number;
  inspector_summary: Array<{
    inspector_id: string;
    inspector_name: string;
    inspection_count: number;
    total_sales: number;
    total_settle_amount: number;
    pending_amount: number;
    completed_amount: number;
  }>;
  daily_summary: Array<{
    date: string;
    total_amount: number;
    count: number;
  }>;
  weekly_summary: Array<{
    week_start: string;
    total_amount: number;
    count: number;
  }>;
  monthly_summary: Array<{
    month_start: string;
    total_amount: number;
    count: number;
  }>;
}

// 정산 목록 조회 파라미터
export interface SettlementListParams {
  inspector_id?: string;
  status?: 'pending' | 'completed';
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'settle_date' | 'settle_amount' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * 정산 내역 목록 조회
 */
export const getSettlements = async (
  params?: SettlementListParams
): Promise<SettlementListResponse> => {
  const response = await apiClient.get<StandardResponse<SettlementListResponse>>(
    '/admin/settlements',
    { params }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '정산 내역 조회에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 정산 상세 내역 조회
 */
export const getSettlementDetail = async (
  settlementId: string
): Promise<SettlementDetailResponse> => {
  const response = await apiClient.get<StandardResponse<SettlementDetailResponse>>(
    `/admin/settlements/${settlementId}`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '정산 상세 조회에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 기사별 정산 내역 조회
 */
export const getInspectorSettlements = async (
  inspectorId: string,
  params?: Omit<SettlementListParams, 'inspector_id'>
): Promise<SettlementListResponse> => {
  const response = await apiClient.get<StandardResponse<SettlementListResponse>>(
    `/admin/settlements/inspector/${inspectorId}`,
    { params }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '기사별 정산 내역 조회에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 정산 요약 정보 조회
 */
export const getSettlementSummary = async (
  startDate?: string,
  endDate?: string
): Promise<SettlementSummaryResponse> => {
  const response = await apiClient.get<StandardResponse<SettlementSummaryResponse>>(
    '/admin/settlements/summary',
    { params: { start_date: startDate, end_date: endDate } }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '정산 요약 조회에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 정산 집계 실행
 */
export const calculateSettlements = async (
  targetDate: string
): Promise<{ target_date: string; settlements_created: number; total_inspections: number }> => {
  const response = await apiClient.post<StandardResponse<any>>(
    '/admin/settlements/calculate',
    { target_date: targetDate }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '정산 집계에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 정산 상태 변경
 */
export const updateSettlementStatus = async (
  settlementId: string,
  status: 'pending' | 'completed'
): Promise<{ id: string; status: string; settle_amount: number }> => {
  const response = await apiClient.patch<StandardResponse<any>>(
    `/admin/settlements/${settlementId}/status`,
    { status }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '정산 상태 변경에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 정산 일괄 상태 변경
 */
export const bulkUpdateSettlementStatus = async (
  settlementIds: string[],
  status: 'pending' | 'completed'
): Promise<{ updated_count: number; total_requested: number; status: string }> => {
  const response = await apiClient.post<StandardResponse<any>>(
    '/admin/settlements/bulk-update',
    { settlement_ids: settlementIds, status }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || '정산 일괄 상태 변경에 실패했습니다');
  }
  return response.data.data;
};

/**
 * 정산 내역 엑셀 다운로드
 */
export const exportSettlements = async (
  params?: SettlementListParams
): Promise<Blob> => {
  const response = await apiClient.get('/admin/settlements/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

