/**
 * 진단 신청 API 클라이언트
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 진단 신청 생성 요청
export interface InspectionCreateRequest {
  vehicle_master_id: string;
  plate_number?: string;
  year: number;
  fuel_type?: string;
  location_address: string;
  region_id: string;
  preferred_schedule: string; // ISO 8601 형식 (YYYY-MM-DDTHH:mm:ss)
  package_id: string;
  total_amount: number;
  mileage?: number;
}

// 진단 신청 생성 응답
export interface InspectionCreateResponse {
  inspection_id: string;
  status: string;
}

/**
 * 진단 신청 생성
 */
export const createInspection = async (
  request: InspectionCreateRequest
): Promise<InspectionCreateResponse> => {
  try {
    const response = await apiClient.post<StandardResponse<InspectionCreateResponse>>(
      '/client/inspections',
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '진단 신청 생성에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('진단 신청 생성 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('진단 신청 생성에 실패했습니다');
  }
};

