import apiClient from './client';
import type { StandardResponse } from '@/types/api';

// 대시보드 통계
export interface DashboardStats {
  new_inspections: number;
  unassigned: number;
  in_progress: number;
  completed: number;
  daily_trend: Array<{ date: string; count: number }>;
  weekly_trend: Array<{ week: string; count: number }>;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const response = await apiClient.get<StandardResponse<DashboardStats>>('/admin/dashboard/stats', {
      timeout: 10000, // 10초 타임아웃
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || '대시보드 통계 데이터를 불러올 수 없습니다');
    }

    return response.data.data;
  } catch (error: any) {
    console.error('대시보드 통계 API 호출 실패:', error);

    // 네트워크 오류
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }

    // HTTP 오류
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.data?.error;

      if (status === 401) {
        throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
      } else if (status === 403) {
        throw new Error('권한이 없습니다.');
      } else if (status === 500) {
        throw new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }

      throw new Error(detail || `API 오류: ${status}`);
    }

    // 기타 오류
    throw error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다.');
  }
};

// 신청 목록 조회
export interface InspectionListItem {
  id: string;
  user_id: string;
  customer_name: string;
  inspector_id?: string | null;
  vehicle_id: string;
  plate_number?: string | null;
  status: string;
  schedule_date: string;
  schedule_time: string;
  location_address: string;
  total_amount: number;
  created_at: string;
}

export interface InspectionListParams {
  status?: string;
  region?: string;
  date?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface InspectionListResponse {
  items: InspectionListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getInspections = async (params: InspectionListParams = {}): Promise<InspectionListResponse> => {
  const response = await apiClient.get<StandardResponse<InspectionListResponse>>('/admin/inspections', { params });
  if (!response.data.data) {
    throw new Error('신청 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 신청 상세 조회
export interface InspectionDetail {
  id?: string;
  status: string;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
  };
  vehicle?: {
    plate_number: string;
    model?: string;
    year?: number;
    mileage?: number;
  };
  vehicle_info?: string; // 백엔드에서 vehicle_info 문자열로 반환할 수도 있음
  payment?: {
    amount: number;
    status: string;
    paid_at?: string;
  };
  schedule?: {
    preferred_date: string;
    preferred_time: string;
    actual_date?: string;
    actual_time?: string;
  };
  preferred_schedule?: string; // 백엔드에서 문자열로 반환할 수도 있음
  inspector?: {
    name: string;
    phone?: string;
  };
  location_address?: string;
  created_at?: string;
  report_summary?: {
    result?: string;
    pdf_url?: string;
    web_view_url?: string;
  };
}

export const getInspectionDetail = async (id: string): Promise<InspectionDetail> => {
  const response = await apiClient.get<StandardResponse<InspectionDetail>>(`/admin/inspections/${id}`);
  if (!response.data.data) {
    throw new Error('신청 상세 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 기사 배정
export interface AssignInspectorRequest {
  inspector_id: string;
}

export const assignInspector = async (inspectionId: string, data: AssignInspectorRequest): Promise<void> => {
  await apiClient.post(`/admin/inspections/${inspectionId}/assign`, data);
};

// 기사 목록 조회
export interface Inspector {
  id: string;
  name: string;
  phone: string;
  rating?: number;
  distance?: number; // km
  active_region?: string;
}

export const getInspectors = async (): Promise<Inspector[]> => {
  const response = await apiClient.get<StandardResponse<Inspector[]>>('/users/inspector/list');
  if (!response.data.data) {
    return [];
  }
  // 백엔드 응답이 배열인 경우 StandardResponse로 감싸지 않을 수 있음
  if (Array.isArray(response.data.data)) {
    return response.data.data;
  }
  return [];
};

// 레포트 조회
export interface InspectionReport {
  id: string;
  inspection_id: string;
  checklist_data: Record<string, any>;
  images: string[];
  videos?: string[];
  inspector_comment?: string;
  repair_cost_est?: number;
  pdf_url?: string;
  status: string;
  created_at: string;
}

export const getInspectionReport = async (inspectionId: string): Promise<InspectionReport> => {
  const response = await apiClient.get<StandardResponse<InspectionReport>>(`/checklists/inspections/${inspectionId}/checklist`);
  if (!response.data.data) {
    throw new Error('레포트 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// ==================== 유저 관리 API ====================

// 유저 목록 조회
export interface UserListItem {
  id: string;
  role: string;
  name: string;
  email?: string | null;
  phone: string;
  region_id?: string | null;
  level?: number | null;
  commission_rate?: number | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
}

export interface UserListParams {
  role?: string;
  status?: string;
  level?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  items: UserListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getUsers = async (params: UserListParams = {}): Promise<UserListResponse> => {
  const response = await apiClient.get<StandardResponse<UserListResponse>>('/admin/users', { params });
  if (!response.data.data) {
    throw new Error('유저 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 유저 상세 조회
export interface UserDetail {
  id: string;
  role: string;
  name: string;
  email?: string | null;
  phone: string;
  region_id?: string | null;
  level?: number | null;
  commission_rate?: number | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
}

export const getUserDetail = async (id: string): Promise<UserDetail> => {
  const response = await apiClient.get<StandardResponse<UserDetail>>(`/admin/users/${id}`);
  if (!response.data.data) {
    throw new Error('유저 상세 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 유저 삭제
export const deleteUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/admin/users/${userId}`);
};

// 유저 생성
export interface UserCreateRequest {
  role: string;
  name: string;
  email?: string | null;
  phone: string;
  password?: string | null;
  region_id?: string | null;
  level?: number | null;
  commission_rate?: number | null;
  status?: string;
}

export const createUser = async (data: UserCreateRequest): Promise<UserDetail> => {
  const response = await apiClient.post<StandardResponse<UserDetail>>('/admin/users', data);
  if (!response.data.data) {
    throw new Error('유저 생성에 실패했습니다');
  }
  return response.data.data;
};

// 유저 수정
export interface UserUpdateRequest {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  region_id?: string | null;
  level?: number | null;
  commission_rate?: number | null;
  status?: string | null;
}

export const updateUser = async (userId: string, data: UserUpdateRequest): Promise<UserDetail> => {
  const response = await apiClient.patch<StandardResponse<UserDetail>>(`/admin/users/${userId}`, data);
  if (!response.data.data) {
    throw new Error('유저 수정에 실패했습니다');
  }
  return response.data.data;
};

// ==================== 패키지 관리 API ====================

// 패키지 목록 조회
export interface PackageListItem {
  id: string;
  name: string;
  base_price: number;
  included_items: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface PackageListParams {
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface PackageListResponse {
  items: PackageListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getPackages = async (params: PackageListParams = {}): Promise<PackageListResponse> => {
  const response = await apiClient.get<StandardResponse<PackageListResponse>>('/admin/packages', { params });
  if (!response.data.data) {
    throw new Error('패키지 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 패키지 상세 조회
export interface PackageDetail {
  id: string;
  name: string;
  base_price: number;
  included_items: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export const getPackageDetail = async (id: string): Promise<PackageDetail> => {
  const response = await apiClient.get<StandardResponse<PackageDetail>>(`/admin/packages/${id}`);
  if (!response.data.data) {
    throw new Error('패키지 상세 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 패키지 생성
export interface PackageCreateRequest {
  name: string;
  base_price: number;
  included_items: Record<string, any>;
}

export const createPackage = async (data: PackageCreateRequest): Promise<PackageDetail> => {
  const response = await apiClient.post<StandardResponse<PackageDetail>>('/admin/packages', data);
  if (!response.data.data) {
    throw new Error('패키지 생성에 실패했습니다');
  }
  return response.data.data;
};

// 패키지 수정
export interface PackageUpdateRequest {
  name?: string | null;
  base_price?: number | null;
  included_items?: Record<string, any> | null;
  is_active?: boolean | null;
}

export const updatePackage = async (packageId: string, data: PackageUpdateRequest): Promise<PackageDetail> => {
  const response = await apiClient.patch<StandardResponse<PackageDetail>>(`/admin/packages/${packageId}`, data);
  if (!response.data.data) {
    throw new Error('패키지 수정에 실패했습니다');
  }
  return response.data.data;
};

// 패키지 삭제
export const deletePackage = async (packageId: string): Promise<void> => {
  await apiClient.delete(`/admin/packages/${packageId}`);
};

// ==================== 가격 정책 관리 API ====================

// 가격 정책 목록 조회
export interface PricePolicyListItem {
  id: string;
  origin: string;
  vehicle_class: string;
  add_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PricePolicyListParams {
  origin?: string;
  vehicle_class?: string;
  page?: number;
  limit?: number;
}

export interface PricePolicyListResponse {
  items: PricePolicyListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getPricePolicies = async (params: PricePolicyListParams = {}): Promise<PricePolicyListResponse> => {
  const response = await apiClient.get<StandardResponse<PricePolicyListResponse>>('/admin/prices', { params });
  if (!response.data.data) {
    throw new Error('가격 정책 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 가격 정책 상세 조회
export interface PricePolicyDetail {
  id: string;
  origin: string;
  vehicle_class: string;
  add_amount: number;
  created_at: string;
  updated_at: string;
}

export const getPricePolicyDetail = async (id: string): Promise<PricePolicyDetail> => {
  const response = await apiClient.get<StandardResponse<PricePolicyDetail>>(`/admin/prices/${id}`);
  if (!response.data.data) {
    throw new Error('가격 정책 상세 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 가격 정책 생성
export interface PricePolicyCreateRequest {
  origin: string;
  vehicle_class: string;
  add_amount: number;
}

export const createPricePolicy = async (data: PricePolicyCreateRequest): Promise<PricePolicyDetail> => {
  const response = await apiClient.post<StandardResponse<PricePolicyDetail>>('/admin/prices', data);
  if (!response.data.data) {
    throw new Error('가격 정책 생성에 실패했습니다');
  }
  return response.data.data;
};

// 가격 정책 수정
export interface PricePolicyUpdateRequest {
  add_amount?: number;
}

export const updatePricePolicy = async (policyId: string, data: PricePolicyUpdateRequest): Promise<PricePolicyDetail> => {
  const response = await apiClient.patch<StandardResponse<PricePolicyDetail>>(`/admin/prices/${policyId}`, data);
  if (!response.data.data) {
    throw new Error('가격 정책 수정에 실패했습니다');
  }
  return response.data.data;
};

// 가격 정책 삭제
export const deletePricePolicy = async (policyId: string): Promise<void> => {
  await apiClient.delete(`/admin/prices/${policyId}`);
};

// ==================== 서비스 지역 관리 API ====================

// 서비스 지역 목록 조회
export interface ServiceRegionListItem {
  id: string;
  province: string;
  province_code?: string | null;
  city: string;
  city_code?: string | null;
  extra_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceRegionListParams {
  province?: string;
  city?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  hierarchy?: boolean;
}

export interface ServiceRegionListResponse {
  items: ServiceRegionListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ServiceRegionHierarchyItem {
  province: string;
  cities: ServiceRegionListItem[];
}

export const getServiceRegions = async (params: ServiceRegionListParams = {}): Promise<ServiceRegionListResponse | ServiceRegionHierarchyItem[]> => {
  const response = await apiClient.get<StandardResponse<ServiceRegionListResponse | ServiceRegionHierarchyItem[]>>('/admin/regions', { params });
  if (!response.data.data) {
    throw new Error('서비스 지역 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 서비스 지역 상세 조회
export interface ServiceRegionDetail {
  id: string;
  province: string;
  province_code?: string | null;
  city: string;
  city_code?: string | null;
  extra_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getServiceRegionDetail = async (id: string): Promise<ServiceRegionDetail> => {
  const response = await apiClient.get<StandardResponse<ServiceRegionDetail>>(`/admin/regions/${id}`);
  if (!response.data.data) {
    throw new Error('서비스 지역 상세 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 서비스 지역 생성
export interface ServiceRegionCreateRequest {
  province: string;
  province_code?: string;
  city: string;
  city_code?: string;
  extra_fee: number;
  is_active?: boolean;
}

export const createServiceRegion = async (data: ServiceRegionCreateRequest): Promise<ServiceRegionDetail> => {
  const response = await apiClient.post<StandardResponse<ServiceRegionDetail>>('/admin/regions', data);
  if (!response.data.data) {
    throw new Error('서비스 지역 생성에 실패했습니다');
  }
  return response.data.data;
};

// 서비스 지역 수정
export interface ServiceRegionUpdateRequest {
  province?: string;
  province_code?: string;
  city?: string;
  city_code?: string;
  extra_fee?: number;
  is_active?: boolean;
}

export const updateServiceRegion = async (regionId: string, data: ServiceRegionUpdateRequest): Promise<ServiceRegionDetail> => {
  const response = await apiClient.patch<StandardResponse<ServiceRegionDetail>>(`/admin/regions/${regionId}`, data);
  if (!response.data.data) {
    throw new Error('서비스 지역 수정에 실패했습니다');
  }
  return response.data.data;
};

// 서비스 지역 삭제
export const deleteServiceRegion = async (regionId: string): Promise<void> => {
  await apiClient.delete(`/admin/regions/${regionId}`);
};

// 광역시도별 일괄 활성/비활성화
export interface BulkUpdateProvinceRequest {
  province_code: string;
  is_active: boolean;
}

export interface BulkUpdateProvinceResponse {
  province_code: string;
  is_active: boolean;
  total_regions: number;
  updated_count: number;
}

export const bulkUpdateProvinceRegions = async (
  provinceCode: string,
  isActive: boolean
): Promise<BulkUpdateProvinceResponse> => {
  const response = await apiClient.post<StandardResponse<BulkUpdateProvinceResponse>>(
    `/admin/regions/bulk-update-province?province_code=${provinceCode}&is_active=${isActive}`
  );
  if (!response.data.data) {
    throw new Error('일괄 업데이트에 실패했습니다');
  }
  return response.data.data;
};

// 광역시도별 상태 조회
export interface ProvinceStatusResponse {
  province_code: string;
  total: number;
  active_count: number;
  inactive_count: number;
  is_fully_active: boolean;
  is_partially_active: boolean;
}

export const getProvinceStatus = async (provinceCode: string): Promise<ProvinceStatusResponse> => {
  const response = await apiClient.get<StandardResponse<ProvinceStatusResponse>>(
    `/admin/regions/province-status/${provinceCode}`
  );
  if (!response.data.data) {
    throw new Error('상태 조회에 실패했습니다');
  }
  return response.data.data;
};

// ==================== 차량 마스터 관리 API ====================

// 차량 마스터 목록 조회
export interface VehicleMasterListItem {
  id: string;
  origin: string;
  manufacturer: string;
  model_group: string;
  model_detail?: string | null;
  vehicle_class: string;
  start_year: number;
  end_year?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface VehicleMasterListParams {
  origin?: string;
  manufacturer?: string;
  vehicle_class?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface VehicleMasterListResponse {
  items: VehicleMasterListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getVehicleMasters = async (params: VehicleMasterListParams = {}): Promise<VehicleMasterListResponse> => {
  const response = await apiClient.get<StandardResponse<VehicleMasterListResponse>>('/admin/vehicles/master', { params });
  if (!response.data.data) {
    throw new Error('차량 마스터 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 차량 마스터 상세 조회
export interface VehicleMasterDetail {
  id: string;
  origin: string;
  manufacturer: string;
  model_group: string;
  model_detail?: string | null;
  vehicle_class: string;
  start_year: number;
  end_year?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export const getVehicleMasterDetail = async (id: string): Promise<VehicleMasterDetail> => {
  const response = await apiClient.get<StandardResponse<VehicleMasterDetail>>(`/admin/vehicles/master/${id}`);
  if (!response.data.data) {
    throw new Error('차량 마스터 상세 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

// 차량 마스터 생성
export interface VehicleMasterCreateRequest {
  origin: string;
  manufacturer: string;
  model_group: string;
  model_detail?: string | null;
  vehicle_class: string;
  start_year: number;
  end_year?: number | null;
  is_active?: boolean;
}

export const createVehicleMaster = async (data: VehicleMasterCreateRequest): Promise<VehicleMasterDetail> => {
  const response = await apiClient.post<StandardResponse<VehicleMasterDetail>>('/admin/vehicles/master', data);
  if (!response.data.data) {
    throw new Error('차량 마스터 생성에 실패했습니다');
  }
  return response.data.data;
};

// 차량 마스터 수정
export interface VehicleMasterUpdateRequest {
  origin?: string | null;
  manufacturer?: string | null;
  model_group?: string | null;
  model_detail?: string | null;
  vehicle_class?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  is_active?: boolean | null;
}

export const updateVehicleMaster = async (masterId: string, data: VehicleMasterUpdateRequest): Promise<VehicleMasterDetail> => {
  const response = await apiClient.patch<StandardResponse<VehicleMasterDetail>>(`/admin/vehicles/master/${masterId}`, data);
  if (!response.data.data) {
    throw new Error('차량 마스터 수정에 실패했습니다');
  }
  return response.data.data;
};

// 차량 마스터 삭제
export const deleteVehicleMaster = async (masterId: string): Promise<void> => {
  await apiClient.delete(`/admin/vehicles/master/${masterId}`);
};

// 차량 마스터 동기화
export interface VehicleMasterSyncRequest {
  data: VehicleMasterCreateRequest[];
}

export interface VehicleMasterSyncResponse {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export const syncVehicleMasters = async (data: VehicleMasterSyncRequest): Promise<VehicleMasterSyncResponse> => {
  const response = await apiClient.post<StandardResponse<VehicleMasterSyncResponse>>('/admin/vehicles/master/sync', data);
  if (!response.data.data) {
    throw new Error('차량 마스터 동기화에 실패했습니다');
  }
  return response.data.data;
};

// ==================== 제조사 관리 API ====================
export interface ManufacturerListItem {
  id: string;
  name: string;
  origin: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ManufacturerListParams {
  origin?: string;
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface ManufacturerListResponse {
  items: ManufacturerListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ManufacturerDetail {
  id: string;
  name: string;
  origin: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ManufacturerCreateRequest {
  name: string;
  origin: 'domestic' | 'imported';
  is_active?: boolean;
}

export interface ManufacturerUpdateRequest {
  name?: string;
  origin?: 'domestic' | 'imported';
  is_active?: boolean;
}

export const getManufacturers = async (
  params: ManufacturerListParams = {}
): Promise<ManufacturerListResponse> => {
  const response = await apiClient.get<StandardResponse<ManufacturerListResponse>>(
    '/admin/manufacturers',
    { params }
  );
  if (!response.data.data) {
    throw new Error('제조사 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

export const getManufacturerDetail = async (id: string): Promise<ManufacturerDetail> => {
  const response = await apiClient.get<StandardResponse<ManufacturerDetail>>(
    `/admin/manufacturers/${id}`
  );
  if (!response.data.data) {
    throw new Error('제조사 상세 정보를 불러올 수 없습니다');
  }
  return response.data.data;
};

export const createManufacturer = async (
  data: ManufacturerCreateRequest
): Promise<ManufacturerDetail> => {
  const response = await apiClient.post<StandardResponse<ManufacturerDetail>>(
    '/admin/manufacturers',
    data
  );
  if (!response.data.data) {
    throw new Error('제조사 생성에 실패했습니다');
  }
  return response.data.data;
};

export const updateManufacturer = async (
  id: string,
  data: ManufacturerUpdateRequest
): Promise<ManufacturerDetail> => {
  const response = await apiClient.patch<StandardResponse<ManufacturerDetail>>(
    `/admin/manufacturers/${id}`,
    data
  );
  if (!response.data.data) {
    throw new Error('제조사 수정에 실패했습니다');
  }
  return response.data.data;
};

export const deleteManufacturer = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/manufacturers/${id}`);
};

// ==================== 차량 모델 관리 API ====================
export interface VehicleModelListItem {
  id: string;
  manufacturer_id: string;
  manufacturer_name?: string;
  manufacturer_origin?: string;
  model_group: string;
  model_detail?: string;
  vehicle_class: string;
  start_year: number;
  end_year?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface VehicleModelListParams {
  manufacturer_id?: string;
  origin?: string;
  vehicle_class?: string;
  model_group?: string;
  model_detail?: string;
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface VehicleModelListResponse {
  items: VehicleModelListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface VehicleModelDetail {
  id: string;
  manufacturer_id: string;
  manufacturer_name?: string;
  manufacturer_origin?: string;
  model_group: string;
  model_detail?: string;
  vehicle_class: string;
  start_year: number;
  end_year?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface VehicleModelCreateRequest {
  manufacturer_id: string;
  model_group: string;
  model_detail?: string;
  vehicle_class: 'compact' | 'small' | 'mid' | 'large' | 'suv' | 'sports' | 'supercar';
  start_year: number;
  end_year?: number;
  is_active?: boolean;
}

export interface VehicleModelUpdateRequest {
  manufacturer_id?: string;
  model_group?: string;
  model_detail?: string;
  vehicle_class?: 'compact' | 'small' | 'mid' | 'large' | 'suv' | 'sports' | 'supercar';
  start_year?: number;
  end_year?: number;
  is_active?: boolean;
}

export interface VehicleModelSyncRequest {
  items: VehicleModelCreateRequest[];
}

export interface VehicleModelSyncResponse {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export const getVehicleModels = async (
  params: VehicleModelListParams = {}
): Promise<VehicleModelListResponse> => {
  const response = await apiClient.get<StandardResponse<VehicleModelListResponse>>(
    '/admin/vehicle-models',
    { params }
  );
  if (!response.data.data) {
    throw new Error('차량 모델 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

export const getVehicleModelDetail = async (id: string): Promise<VehicleModelDetail> => {
  const response = await apiClient.get<StandardResponse<VehicleModelDetail>>(
    `/admin/vehicle-models/${id}`
  );
  if (!response.data.data) {
    throw new Error('차량 모델 상세 정보를 불러올 수 없습니다');
  }
  return response.data.data;
};

export const createVehicleModel = async (
  data: VehicleModelCreateRequest
): Promise<VehicleModelDetail> => {
  const response = await apiClient.post<StandardResponse<VehicleModelDetail>>(
    '/admin/vehicle-models',
    data
  );
  if (!response.data.data) {
    throw new Error('차량 모델 생성에 실패했습니다');
  }
  return response.data.data;
};

export const updateVehicleModel = async (
  id: string,
  data: VehicleModelUpdateRequest
): Promise<VehicleModelDetail> => {
  const response = await apiClient.patch<StandardResponse<VehicleModelDetail>>(
    `/admin/vehicle-models/${id}`,
    data
  );
  if (!response.data.data) {
    throw new Error('차량 모델 수정에 실패했습니다');
  }
  return response.data.data;
};

export const deleteVehicleModel = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/vehicle-models/${id}`);
};

export const syncVehicleModels = async (
  data: VehicleModelSyncRequest
): Promise<VehicleModelSyncResponse> => {
  const response = await apiClient.post<StandardResponse<VehicleModelSyncResponse>>(
    '/admin/vehicle-models/sync',
    data
  );
  if (!response.data.data) {
    throw new Error('차량 모델 동기화에 실패했습니다');
  }
  return response.data.data;
};


// ==================== 리뷰 관리 API ====================
export interface ReviewListItem {
  id: string;
  user_id: string;
  inspection_id: string;
  rating: number;
  content: string | null;
  photos: string[] | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
}

export interface ReviewListParams {
  rating?: number;
  is_hidden?: boolean;
  page?: number;
  limit?: number;
}

export interface ReviewListResponse {
  items: ReviewListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getReviews = async (params: ReviewListParams = {}): Promise<ReviewListResponse> => {
  const response = await apiClient.get<StandardResponse<ReviewListResponse>>('/admin/reviews', { params });
  if (!response.data.data) {
    throw new Error('리뷰 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

export const updateReviewVisibility = async (reviewId: string, isHidden: boolean): Promise<ReviewListItem> => {
  const response = await apiClient.patch<StandardResponse<ReviewListItem>>(`/admin/reviews/${reviewId}/visibility`, {
    is_hidden: isHidden
  });
  if (!response.data.data) {
    throw new Error('리뷰 상태 변경에 실패했습니다');
  }
  return response.data.data;
};

// ==================== FAQ 관리 API ====================
export interface FAQListItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FAQListParams {
  category?: string;
}

export interface FAQListResponse {
  items: FAQListItem[];
  total: number;
}

export const getFAQs = async (params: FAQListParams = {}): Promise<FAQListResponse> => {
  const response = await apiClient.get<StandardResponse<FAQListResponse>>('/admin/faqs', { params });
  if (!response.data.data) {
    throw new Error('FAQ 목록 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

export interface FAQCreateRequest {
  category: string;
  question: string;
  answer: string;
  is_active?: boolean;
  display_order?: number;
}

export const createFAQ = async (data: FAQCreateRequest): Promise<FAQListItem> => {
  const response = await apiClient.post<StandardResponse<FAQListItem>>('/admin/faqs', data);
  if (!response.data.data) {
    throw new Error('FAQ 생성에 실패했습니다');
  }
  return response.data.data;
};

export interface FAQUpdateRequest {
  category?: string;
  question?: string;
  answer?: string;
  is_active?: boolean;
  display_order?: number;
}

export const updateFAQ = async (faqId: string, data: FAQUpdateRequest): Promise<FAQListItem> => {
  const response = await apiClient.patch<StandardResponse<FAQListItem>>(`/admin/faqs/${faqId}`, data);
  if (!response.data.data) {
    throw new Error('FAQ 수정에 실패했습니다');
  }
  return response.data.data;
};

export const deleteFAQ = async (faqId: string): Promise<void> => {
  await apiClient.delete(`/admin/faqs/${faqId}`);
};

