/**
 * 기사 API 클라이언트
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 배정 대기 목록 응답
export interface Assignment {
  id: string;
  location: string;
  vehicle: string;
  plate_number?: string;
  year?: number;
  schedule_date?: string | null;
  schedule_time?: string | null;
  fee: number;
  total_amount?: number;
  customer_name?: string;
  status?: string;
  created_at?: string | null;
}

// 진행 중인 작업 응답
export interface MyInspection {
  id: string;
  status: string;
  location: string;
  vehicle: string;
  plate_number: string;
  schedule_date: string | null;
  schedule_time: string | null;
  customer_name: string;
  total_amount: number;
  created_at: string | null;
}

// 대시보드 통계 응답
export interface InspectorDashboardStats {
  today_count: number;
  new_assignments_count: number;
  in_progress_count: number;
  weekly_schedule: Record<string, number>;
}

// 배정 수락 요청
export interface AssignmentAcceptRequest {
  // 현재는 빈 객체 (추후 확장 가능)
}

// 배정 거절 요청
export interface AssignmentRejectRequest {
  reason: string;
}

/**
 * 배정 대기 목록 조회
 */
export const getAssignments = async (): Promise<Assignment[]> => {
  try {
    const response = await apiClient.get<StandardResponse<Assignment[]>>(
      '/inspector/assignments'
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '배정 목록 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('배정 목록 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('배정 목록 조회에 실패했습니다');
  }
};

/**
 * 진행 중인 작업 목록 조회
 */
export const getMyInspections = async (
  status?: string
): Promise<MyInspection[]> => {
  try {
    const params = status ? { status } : {};
    const response = await apiClient.get<StandardResponse<MyInspection[]>>(
      '/inspector/my-inspections',
      { params }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '작업 목록 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('작업 목록 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('작업 목록 조회에 실패했습니다');
  }
};

/**
 * 대시보드 통계 조회
 */
export const getDashboardStats = async (): Promise<InspectorDashboardStats> => {
  try {
    const response = await apiClient.get<StandardResponse<InspectorDashboardStats>>(
      '/inspector/dashboard/stats'
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '대시보드 통계 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('대시보드 통계 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('대시보드 통계 조회에 실패했습니다');
  }
};

/**
 * 배정 수락
 */
export const acceptAssignment = async (
  inspectionId: string,
  request: AssignmentAcceptRequest = {}
): Promise<any> => {
  try {
    const response = await apiClient.post<StandardResponse<any>>(
      `/inspector/assignments/${inspectionId}/accept`,
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '배정 수락에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('배정 수락 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('배정 수락에 실패했습니다');
  }
};

/**
 * 배정 거절
 */
export const rejectAssignment = async (
  inspectionId: string,
  request: AssignmentRejectRequest
): Promise<any> => {
  try {
    const response = await apiClient.post<StandardResponse<any>>(
      `/inspector/assignments/${inspectionId}/reject`,
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '배정 거절에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('배정 거절 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('배정 거절에 실패했습니다');
  }
};

/**
 * 작업 상태 변경
 */
export const updateInspectionStatus = async (
  inspectionId: string,
  newStatus: 'scheduled' | 'in_progress' | 'report_submitted'
): Promise<any> => {
  try {
    const response = await apiClient.patch<StandardResponse<any>>(
      `/inspector/inspections/${inspectionId}/status`,
      { new_status: newStatus }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '상태 변경에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('상태 변경 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('상태 변경에 실패했습니다');
  }
};

/**
 * 작업 상세 정보 조회
 */
export const getInspectionDetail = async (inspectionId: string): Promise<any> => {
  try {
    const response = await apiClient.get<StandardResponse<any>>(
      `/inspector/inspections/${inspectionId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '작업 상세 정보 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('작업 상세 정보 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('작업 상세 정보 조회에 실패했습니다');
  }
};

// 정산 내역 인터페이스
export interface Settlement {
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

export interface SettlementListResponse {
  settlements: Settlement[];
  total: number;
  page: number;
  page_size: number;
}

export interface MonthlySettlementSummary {
  month: number;
  year: number;
  total_amount: number;
  count: number;
}

export interface MonthlySettlementResponse {
  year: number;
  monthly_summary: MonthlySettlementSummary[];
}

/**
 * 기사 본인의 정산 내역 조회
 */
export const getMySettlements = async (
  params?: {
    status?: 'pending' | 'completed';
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }
): Promise<SettlementListResponse> => {
  try {
    const response = await apiClient.get<StandardResponse<SettlementListResponse>>(
      '/inspector/settlements',
      { params }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '정산 내역 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('정산 내역 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('정산 내역 조회에 실패했습니다');
  }
};

/**
 * 정산 상세 내역 조회
 */
export const getSettlementDetail = async (settlementId: string): Promise<any> => {
  try {
    const response = await apiClient.get<StandardResponse<any>>(
      `/inspector/settlements/${settlementId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '정산 상세 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('정산 상세 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('정산 상세 조회에 실패했습니다');
  }
};

/**
 * 월별 정산 요약 조회
 */
export const getMonthlySettlementSummary = async (
  year?: number
): Promise<MonthlySettlementResponse> => {
  try {
    const params = year ? { year } : {};
    const response = await apiClient.get<StandardResponse<MonthlySettlementResponse>>(
      '/inspector/settlements/summary/monthly',
      { params }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '월별 정산 요약 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('월별 정산 요약 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('월별 정산 요약 조회에 실패했습니다');
  }
};

