/**
 * 공공데이터포털 API 클라이언트
 * 백엔드를 통한 VWorld API 호출
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

export interface ProvinceItem {
  code: string;
  name: string;
}

export interface CityItem {
  code: string;
  name: string;
}

/**
 * 광역시도 목록 조회
 */
export const getProvinces = async (): Promise<ProvinceItem[]> => {
  try {
    const response = await apiClient.get<StandardResponse<ProvinceItem[]>>('/public-data/provinces');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '광역시도 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('광역시도 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('광역시도 목록을 불러올 수 없습니다');
  }
};

/**
 * 시군구 목록 조회
 * 
 * @param provinceCode 광역시도 코드 (11, 21, 22 등)
 */
export const getCitiesByProvince = async (provinceCode: string): Promise<CityItem[]> => {
  try {
    const response = await apiClient.get<StandardResponse<CityItem[]>>('/public-data/cities', {
      params: { province_code: provinceCode },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '시군구 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('시군구 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('시군구 목록을 불러올 수 없습니다');
  }
};
