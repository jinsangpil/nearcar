/**
 * 체크리스트 API 클라이언트
 */
import apiClient from '../api/client';
import type { StandardResponse } from '../api/client';

export interface ChecklistTemplate {
  section: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  name: string;
  type: 'checkbox' | 'select';
  options?: string[];
}

export interface ChecklistItemData {
  item_id: string;
  status: 'normal' | 'warning' | 'defect';
  note?: string;
}

export interface ChecklistSaveRequest {
  checklist_data: Record<string, ChecklistItemData[]>;
  images?: Array<{
    section: string;
    item_id?: string;
    url: string;
    thumbnail_url?: string;
  }>;
  inspector_comment?: string;
  repair_cost_est?: number;
}

export interface ChecklistResponse {
  inspection_id: string;
  checklist_data: Record<string, ChecklistItemData[]>;
  images: Array<{
    section: string;
    item_id?: string;
    url: string;
    thumbnail_url?: string;
  }>;
  inspector_comment?: string;
  repair_cost_est?: number;
  status: string;
  created_at: string;
}

/**
 * 체크리스트 템플릿 조회
 */
export async function getChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const response = await apiClient.get<StandardResponse<ChecklistTemplate[]>>(
    '/checklists/templates'
  );
  return response.data.data;
}

/**
 * 체크리스트 저장
 */
export async function saveChecklist(
  inspectionId: string,
  data: ChecklistSaveRequest
): Promise<ChecklistResponse> {
  const response = await apiClient.post<StandardResponse<ChecklistResponse>>(
    `/checklists/inspections/${inspectionId}/checklist`,
    data
  );
  return response.data.data;
}

/**
 * 체크리스트 조회
 */
export async function getChecklist(
  inspectionId: string,
  section?: string
): Promise<ChecklistResponse | null> {
  const response = await apiClient.get<StandardResponse<ChecklistResponse>>(
    `/checklists/inspections/${inspectionId}/checklist${section ? `?section=${section}` : ''}`
  );
  return response.data.data || null;
}

