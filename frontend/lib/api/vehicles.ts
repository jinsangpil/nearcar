/**
 * 차량 마스터 조회 API 클라이언트
 * 고객 신청 플로우에서 사용
 */
import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 제조사 정보
export interface Manufacturer {
  name: string;
  origin: 'domestic' | 'imported';
}

// 모델 그룹 정보
export interface ModelGroup {
  name: string;
  manufacturer: string;
}

// 차량 모델 정보
export interface VehicleModel {
  id: string;
  manufacturer: string;
  model_group: string;
  model_detail?: string | null;
  vehicle_class: string;
  origin: 'domestic' | 'imported';
}

// 차량 모델 상세 정보
export interface VehicleModelDetail {
  id: string;
  manufacturer: string;
  model_group: string;
  model_detail?: string | null;
  vehicle_class: string;
  origin: 'domestic' | 'imported';
  start_year: number;
  end_year?: number | null;
}

// 차량번호 조회 응답
export interface VehicleLookupResponse {
  plate_number: string;
  message?: string;
  // TODO: 국토교통부 API 연동 후 실제 차량 정보 추가
}

/**
 * 제조사 목록 조회
 */
export const getManufacturers = async (origin?: 'domestic' | 'imported'): Promise<Manufacturer[]> => {
  try {
    const params = origin ? { origin } : {};
    const response = await apiClient.get<StandardResponse<Manufacturer[]>>('/vehicles/manufacturers', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '제조사 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('제조사 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('제조사 목록을 불러올 수 없습니다');
  }
};

/**
 * 모델 그룹 목록 조회
 */
export const getModelGroups = async (
  manufacturer: string,
  origin?: 'domestic' | 'imported'
): Promise<ModelGroup[]> => {
  try {
    const params: any = { manufacturer };
    if (origin) {
      params.origin = origin;
    }
    const response = await apiClient.get<StandardResponse<ModelGroup[]>>('/vehicles/model-groups', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '모델 그룹 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('모델 그룹 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('모델 그룹 목록을 불러올 수 없습니다');
  }
};

/**
 * 차량 모델 목록 조회
 */
export const getVehicleModels = async (
  manufacturer?: string,
  model_group?: string,
  origin?: 'domestic' | 'imported'
): Promise<VehicleModel[]> => {
  try {
    const params: any = {};
    if (manufacturer) params.manufacturer = manufacturer;
    if (model_group) params.model_group = model_group;
    if (origin) params.origin = origin;
    
    const response = await apiClient.get<StandardResponse<VehicleModel[]>>('/vehicles/models', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '차량 모델 목록을 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('차량 모델 목록 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('차량 모델 목록을 불러올 수 없습니다');
  }
};

/**
 * 차량 모델 상세 정보 조회
 */
export const getVehicleModelDetail = async (modelId: string): Promise<VehicleModelDetail> => {
  try {
    const response = await apiClient.get<StandardResponse<VehicleModelDetail>>(`/vehicles/models/${modelId}/details`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '차량 모델 상세 정보를 불러올 수 없습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('차량 모델 상세 정보 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('차량 모델 상세 정보를 불러올 수 없습니다');
  }
};

/**
 * 차량번호 조회
 */
export const lookupVehicleByPlate = async (plateNumber: string): Promise<VehicleLookupResponse> => {
  try {
    const response = await apiClient.get<StandardResponse<VehicleLookupResponse>>('/client/vehicle/lookup', {
      params: { plate_number: plateNumber },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '차량번호 조회에 실패했습니다');
    }
    return response.data.data;
  } catch (error: any) {
    console.error('차량번호 조회 API 호출 실패:', error);
    throw error instanceof Error ? error : new Error('차량번호 조회에 실패했습니다');
  }
};

