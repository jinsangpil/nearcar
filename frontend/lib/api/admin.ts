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

