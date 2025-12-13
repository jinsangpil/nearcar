/**
 * 공개 통계 조회 API 클라이언트
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

export interface PublicStats {
  total_inspections: number;
  total_reviews: number;
  average_rating: number;
}

/**
 * 공개 통계 조회
 */
export const getPublicStats = async (): Promise<PublicStats> => {
  try {
    const response = await apiClient.get<StandardResponse<PublicStats>>('/client/stats');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '통계를 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('통계 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('통계를 불러올 수 없습니다');
  }
};

