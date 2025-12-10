'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getSettlementDetail, updateSettlementStatus, type SettlementDetailResponse } from '@/lib/api/settlements';
import { format } from 'date-fns';
import { useState } from 'react';
import Link from 'next/link';
import { formatNumberWithCommas } from '@/lib/utils';

export default function SettlementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const settlementId = params.id as string;
  const [statusChangeModal, setStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState<'pending' | 'completed'>('completed');

  const { data, isLoading, error } = useQuery({
    queryKey: ['settlement-detail', settlementId],
    queryFn: () => getSettlementDetail(settlementId),
  });

  const statusChangeMutation = useMutation({
    mutationFn: (status: 'pending' | 'completed') => updateSettlementStatus(settlementId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlement-detail', settlementId] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      setStatusChangeModal(false);
      alert('정산 상태가 성공적으로 변경되었습니다.');
    },
    onError: (error: any) => {
      console.error('정산 상태 변경 실패:', error);
      alert(error.message || '정산 상태 변경에 실패했습니다.');
    },
  });

  const handleStatusChange = () => {
    if (data?.settlement.status === 'completed') {
      alert('이미 정산 완료된 건입니다.');
      return;
    }
    setNewStatus('completed');
    setStatusChangeModal(true);
  };

  const confirmStatusChange = () => {
    statusChangeMutation.mutate(newStatus);
  };

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

  const { settlement, inspection_detail, inspector_detail } = data;

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '미정산', color: 'bg-yellow-100 text-yellow-800' },
    completed: { label: '정산완료', color: 'bg-green-100 text-green-800' },
  };

  const statusInfo = statusMap[settlement.status] || { label: settlement.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/admin/settlements')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 목록으로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">정산 상세</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {settlement.status === 'pending' && (
            <button
              onClick={handleStatusChange}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              정산 완료 처리
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 정산 정보 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">정산 정보</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">정산 ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{settlement.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">정산 상태</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">정산일</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {settlement.settle_date ? format(new Date(settlement.settle_date), 'yyyy-MM-dd') : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">생성일</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {settlement.created_at ? format(new Date(settlement.created_at), 'yyyy-MM-dd HH:mm') : '-'}
              </dd>
            </div>
          </dl>
        </div>

        {/* 기사 정보 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">기사 정보</h2>
          {inspector_detail ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">기사명</dt>
                <dd className="mt-1 text-sm text-gray-900">{inspector_detail.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">전화번호</dt>
                <dd className="mt-1 text-sm text-gray-900">{inspector_detail.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">수수료율</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {inspector_detail.commission_rate !== null && inspector_detail.commission_rate !== undefined
                    ? `${(inspector_detail.commission_rate * 100).toFixed(1)}%`
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">기사 상세</dt>
                <dd className="mt-1">
                  <Link
                    href={`/admin/users/${settlement.inspector_id}`}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    기사 정보 보기 →
                  </Link>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">기사 정보를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>

      {/* 진단 건 상세 내역 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">진단 건 상세 내역</h2>
        {inspection_detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">진단 ID</dt>
                <dd className="mt-1">
                  <Link
                    href={`/admin/inspections/${inspection_detail.id}`}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium font-mono"
                  >
                    {inspection_detail.id}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">차량번호</dt>
                <dd className="mt-1 text-sm text-gray-900">{inspection_detail.plate_number || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">연식</dt>
                <dd className="mt-1 text-sm text-gray-900">{inspection_detail.production_year || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">위치</dt>
                <dd className="mt-1 text-sm text-gray-900">{inspection_detail.location_address || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">희망 일시</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {inspection_detail.preferred_schedule
                    ? format(new Date(inspection_detail.preferred_schedule), 'yyyy-MM-dd HH:mm')
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">진단 상태</dt>
                <dd className="mt-1">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {inspection_detail.status}
                  </span>
                </dd>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-md font-medium text-gray-900 mb-3">정산 계산 내역</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">고객 결제금액</dt>
                  <dd className="text-sm text-gray-900 font-medium">
                    {formatNumberWithCommas(settlement.total_sales)}원
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">적용 수수료율</dt>
                  <dd className="text-sm text-gray-900">
                    {(settlement.fee_rate * 100).toFixed(1)}%
                  </dd>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <dt className="text-sm font-medium text-gray-900">정산액</dt>
                  <dd className="text-sm text-gray-900 font-bold text-lg">
                    {formatNumberWithCommas(settlement.settle_amount)}원
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">진단 건 정보를 불러올 수 없습니다.</p>
        )}
      </div>

      {/* 상태 변경 모달 */}
      {statusChangeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">정산 상태 변경</h3>
              <p className="text-sm text-gray-500 mb-4">
                정산 상태를 <span className="font-medium text-gray-900">정산완료</span>로 변경하시겠습니까?
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setStatusChangeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={statusChangeMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {statusChangeMutation.isPending ? '처리 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

