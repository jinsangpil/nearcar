/**
 * 후기 조회 API 클라이언트
 * 고객용 공개 후기 조회
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

export interface Review {
  id: string;
  user_id: string;
  inspection_id: string;
  rating: number;
  content: string | null;
  photos: string[] | null;
  is_hidden: boolean;
  created_at: string;
  user_name?: string;
  vehicle_info?: string;
}

export interface ReviewListResponse {
  items: Review[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ReviewListParams {
  rating?: number;
  page?: number;
  limit?: number;
}

/**
 * 공개 후기 목록 조회
 */
export const getPublicReviews = async (params: ReviewListParams = {}): Promise<ReviewListResponse> => {
  try {
    const response = await apiClient.get<StandardResponse<ReviewListResponse>>('/client/reviews', {
      params,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '후기 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('후기 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('후기 목록을 불러올 수 없습니다');
  }
};

