'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getInspectionDetail, InspectionDetail } from '@/lib/api/admin';
import { format } from 'date-fns';
import { useState } from 'react';
import apiClient from '@/lib/api/client';

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inspectionId = params.id as string;
  const [statusChangeModal, setStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inspection-detail', inspectionId],
    queryFn: () => getInspectionDetail(inspectionId),
    refetchInterval: 30000, // 30초마다 폴링
  });

  const statusChangeMutation = useMutation({
    mutationFn: async (status: string) => {
      // 상태 변경 API 호출
      await apiClient.patch(`/admin/inspections/${inspectionId}/status?status=${status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-detail', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      setStatusChangeModal(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">데이터를 불러오는 중 오류가 발생했습니다.</div>
      </div>
    );
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    requested: { label: '접수중', color: 'bg-yellow-100 text-yellow-800' },
    paid: { label: '결제완료', color: 'bg-blue-100 text-blue-800' },
    assigned: { label: '배정완료', color: 'bg-purple-100 text-purple-800' },
    in_progress: { label: '진행중', color: 'bg-green-100 text-green-800' },
    completed: { label: '완료', color: 'bg-gray-100 text-gray-800' },
    sent: { label: '발송완료', color: 'bg-indigo-100 text-indigo-800' },
    cancelled: { label: '취소', color: 'bg-red-100 text-red-800' },
  };

  const statusInfo = statusMap[data.status] || { label: data.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 목록으로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">신청 상세</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <button
            onClick={() => {
              setNewStatus(data.status);
              setStatusChangeModal(true);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            상태 변경
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 차량 정보 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">차량 정보</h2>
          <dl className="space-y-3">
            {data.vehicle_info && (
              <div>
                <dt className="text-sm font-medium text-gray-500">차량 정보</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.vehicle_info}</dd>
              </div>
            )}
            {data.vehicle?.plate_number && (
              <div>
                <dt className="text-sm font-medium text-gray-500">차량번호</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.vehicle.plate_number}</dd>
              </div>
            )}
            {data.vehicle?.model && (
              <div>
                <dt className="text-sm font-medium text-gray-500">모델</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.vehicle.model}</dd>
              </div>
            )}
            {data.vehicle?.year && (
              <div>
                <dt className="text-sm font-medium text-gray-500">연식</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.vehicle.year}년</dd>
              </div>
            )}
            {data.vehicle?.mileage && (
              <div>
                <dt className="text-sm font-medium text-gray-500">주행거리</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.vehicle.mileage.toLocaleString()}km</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 고객 정보 */}
        {data.customer && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">고객 정보</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">이름</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.customer.name}</dd>
              </div>
              {data.customer.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">연락처</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.customer.phone}</dd>
                </div>
              )}
              {data.customer.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">이메일</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.customer.email}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* 결제 정보 */}
        {data.payment && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">결제 정보</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">결제 금액</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.payment.amount.toLocaleString()}원</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">결제 상태</dt>
                <dd className="mt-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusMap[data.payment.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {statusMap[data.payment.status]?.label || data.payment.status}
                  </span>
                </dd>
              </div>
              {data.payment.paid_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">결제일시</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {format(new Date(data.payment.paid_at), 'yyyy-MM-dd HH:mm')}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* 일정 정보 */}
        {data.schedule && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">일정 정보</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">희망 일시</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(data.schedule.preferred_date), 'yyyy-MM-dd')} {data.schedule.preferred_time}
                </dd>
              </div>
              {data.schedule.actual_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">실제 일시</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {format(new Date(data.schedule.actual_date), 'yyyy-MM-dd')} {data.schedule.actual_time}
                  </dd>
                </div>
              )}
              {data.location_address && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">진단 장소</dt>
                  <dd className="mt-1 text-sm text-gray-900">{data.location_address}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* 기사 정보 */}
        {data.inspector && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">배정 기사</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">기사명</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.inspector.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">연락처</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.inspector.phone}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* 상태 변경 모달 */}
      {statusChangeModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">상태 변경</h3>
            <div className="mb-4">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                새 상태 선택
              </label>
              <select
                id="status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="requested">접수중</option>
                <option value="paid">결제완료</option>
                <option value="assigned">배정완료</option>
                <option value="in_progress">진행중</option>
                <option value="completed">완료</option>
                <option value="sent">발송완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setStatusChangeModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => statusChangeMutation.mutate(newStatus)}
                disabled={statusChangeMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {statusChangeMutation.isPending ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

