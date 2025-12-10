/**
 * 파일 업로드 API 클라이언트
 */
import apiClient from '../api/client';
import type { StandardResponse } from '../api/client';

export interface PresignedUrlRequest {
  inspection_id: string;
  section: string;
  item_id?: string;
  file_name: string;
  content_type?: string;
}

export interface PresignedUrlResponse {
  presigned_url: string;
  metadata: {
    s3_key: string;
    s3_url: string;
    section: string;
    item_id?: string;
    file_name: string;
    content_type: string;
    upload_id: string;
    expires_at: string;
  };
}

export interface UploadCallbackRequest {
  inspection_id: string;
  s3_key: string;
  section: string;
  item_id?: string;
  metadata?: Record<string, any>;
}

export interface UploadedImage {
  id: string;
  s3_key: string;
  url: string;
  thumbnail_url?: string;
  section: string;
  item_id?: string;
  created_at: string;
}

/**
 * S3 Presigned URL 생성
 */
export async function generatePresignedUrl(
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {
  const response = await apiClient.post<StandardResponse<PresignedUrlResponse>>(
    '/uploads/presigned',
    request
  );
  return response.data.data;
}

/**
 * 업로드 완료 콜백
 */
export async function uploadCallback(
  request: UploadCallbackRequest
): Promise<UploadedImage> {
  const response = await apiClient.post<StandardResponse<UploadedImage>>(
    '/uploads/callback',
    request
  );
  return response.data.data;
}

/**
 * 이미지 목록 조회
 */
export async function getImageList(
  inspectionId: string
): Promise<UploadedImage[]> {
  const response = await apiClient.get<StandardResponse<UploadedImage[]>>(
    `/uploads/inspections/${inspectionId}/images`
  );
  return response.data.data;
}

