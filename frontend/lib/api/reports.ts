import apiClient from './client';
import { StandardResponse } from './api';

// 레포트 조회 API
export interface InspectionReport {
  inspection_id: string;
  checklist_data: Record<string, any[]>;
  images: Array<{
    s3_key?: string;
    s3_url?: string;
    file_key?: string;
    url?: string;
    section?: string;
    item_id?: string;
    [key: string]: any;
  }>;
  inspector_comment?: string;
  repair_cost_est?: number;
  status: string;
  created_at: string;
}

export interface InspectionDetail {
  id: string;
  customer_name?: string;
  vehicle_info?: string;
  report_summary?: {
    result: string;
    pdf_url?: string;
    web_view_url?: string;
  };
}

/**
 * 레포트 조회 (체크리스트 데이터 포함)
 */
export const getReport = async (inspectionId: string): Promise<InspectionReport> => {
  const response = await apiClient.get<StandardResponse<InspectionReport>>(
    `/checklists/inspections/${inspectionId}/checklist`
  );
  if (!response.data.data) {
    throw new Error('레포트 데이터를 불러올 수 없습니다');
  }
  return response.data.data;
};

/**
 * 신청 상세 정보 조회 (레포트 요약 포함)
 */
export const getInspectionDetail = async (inspectionId: string): Promise<InspectionDetail> => {
  const response = await apiClient.get<StandardResponse<InspectionDetail>>(
    `/client/inspections/${inspectionId}`
  );
  if (!response.data.data) {
    throw new Error('신청 정보를 불러올 수 없습니다');
  }
  return response.data.data;
};

