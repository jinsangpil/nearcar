/**
 * FAQ 조회 API 클라이언트
 * 고객용 공개 FAQ 조회
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FAQListResponse {
  items: FAQ[];
  total: number;
}

/**
 * 공개 FAQ 목록 조회
 */
export const getPublicFAQs = async (category?: string): Promise<FAQListResponse> => {
  try {
    const response = await apiClient.get<StandardResponse<FAQListResponse>>('/client/faqs', {
      params: category ? { category } : {},
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'FAQ 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('FAQ 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('FAQ 목록을 불러올 수 없습니다');
  }
};

