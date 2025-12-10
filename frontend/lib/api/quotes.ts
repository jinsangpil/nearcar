/**
 * 견적 및 패키지, 지역 조회 API 클라이언트
 * 고객 신청 플로우에서 사용
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 패키지 정보
export interface Package {
  id: string;
  name: string;
  base_price: number;
  included_items: Record<string, any>;
  is_active: boolean;
}

// 지역 정보
export interface Region {
  id: string;
  province: string;
  city: string;
  extra_fee: number;
  is_active: boolean;
}

// 계층형 지역 정보
export interface RegionHierarchy {
  province: string;
  cities: Array<{
    id: string;
    city: string;
    extra_fee: number;
  }>;
}

// 견적 계산 요청
export interface QuoteCalculateRequest {
  vehicle_master_id: string;
  package_id: string;
  region_id: string;
}

// 견적 계산 응답
export interface QuoteCalculateResponse {
  base_price: number;
  class_surcharge: number;
  region_fee: number;
  total_amount: number;
  vehicle_class: string;
  origin: string;
}

/**
 * 패키지 목록 조회
 */
export const getPackages = async (): Promise<Package[]> => {
  try {
    const response = await apiClient.get<StandardResponse<Package[]>>('/packages');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '패키지 목록을 불러올 수 없습니다');
    }
    // 활성화된 패키지만 필터링
    return response.data.data.filter(pkg => pkg.is_active);
  } catch (error: any) {
    console.error('패키지 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('패키지 목록을 불러올 수 없습니다');
  }
};

/**
 * 서비스 지역 목록 조회 (계층형)
 */
export const getRegions = async (): Promise<RegionHierarchy[]> => {
  try {
    const response = await apiClient.get<StandardResponse<RegionHierarchy[]>>('/regions');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '서비스 지역 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('서비스 지역 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('서비스 지역 목록을 불러올 수 없습니다');
  }
};

/**
 * 견적 계산
 */
export const calculateQuote = async (
  request: QuoteCalculateRequest
): Promise<QuoteCalculateResponse> => {
  try {
    const response = await apiClient.post<StandardResponse<QuoteCalculateResponse>>(
      '/quotes/calculate',
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '견적 계산에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('견적 계산 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('견적 계산에 실패했습니다');
  }
};

