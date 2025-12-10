'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getInspectionDetail, updateInspectionStatus } from '@/lib/api/inspector';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { isOnline, onOnlineStatusChange, startQueueSync } from '@/lib/utils/offline';
import { queueStatusChange } from '@/lib/db/inspectorDB';
import { createNavigationLink } from '@/lib/utils/geolocation';

const STATUS_LABELS: Record<string, string> = {
  assigned: '방문 예정',
  scheduled: '일정 확정',
  in_progress: '진단 중',
  report_submitted: '레포트 제출',
};

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  report_submitted: 'bg-green-100 text-green-800',
};

const NEXT_STATUS_MAP: Record<string, string> = {
  assigned: 'scheduled',
  scheduled: 'in_progress',
  in_progress: 'report_submitted',
};

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inspectionId = params.id as string;
  const [isOffline, setIsOffline] = useState(!isOnline());

  // 오프라인 상태 감지 및 큐 동기화
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOffline(!online);
    });

    // 큐 동기화 시작
    const stopSync = startQueueSync(30000);

    return () => {
      unsubscribe();
      stopSync();
    };
  }, []);

  // 작업 상세 정보 조회
  const { data: inspection, isLoading, error } = useQuery({
    queryKey: ['inspector-inspection-detail', inspectionId],
    queryFn: () => getInspectionDetail(inspectionId),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // 상태 변경 mutation
  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => updateInspectionStatus(inspectionId, newStatus as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspector-inspection-detail', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['inspector-my-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspector-dashboard-stats'] });
      alert('상태가 변경되었습니다.');
    },
    onError: (error: any) => {
      alert(`상태 변경에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    },
  });

  // 네비게이션 앱 딥링크 생성 (현재 위치 포함)
  const openNavigation = async (address: string) => {
    try {
      const link = await createNavigationLink(address, true);
      window.location.href = link;
      
      // 카카오맵이 설치되지 않은 경우를 대비해 네이버맵도 시도
      setTimeout(() => {
        const naverMapUrl = `nmap://route/car?dlat=&dlng=&dname=${encodeURIComponent(address)}`;
        window.location.href = naverMapUrl;
      }, 1000);
    } catch (error) {
      // 위치 조회 실패 시 기본 딥링크 사용
      const kakaoMapUrl = `kakaomap://route?ep=${encodeURIComponent(address)}`;
      window.location.href = kakaoMapUrl;
    }
  };

  const handleStatusChange = async () => {
    if (!inspection) return;
    
    const nextStatus = NEXT_STATUS_MAP[inspection.status];
    if (!nextStatus) {
      alert('더 이상 상태를 변경할 수 없습니다.');
      return;
    }

    const statusLabel = STATUS_LABELS[nextStatus];
    if (!confirm(`상태를 "${statusLabel}"로 변경하시겠습니까?`)) {
      return;
    }

    // 오프라인 상태면 큐에 저장
    if (isOffline || !isOnline()) {
      await queueStatusChange(inspection.id, nextStatus);
      alert('오프라인 상태입니다. 온라인 복귀 시 자동으로 처리됩니다.');
      return;
    }

    // 온라인 상태면 즉시 처리
    statusMutation.mutate(nextStatus);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600">작업 정보를 불러오는데 실패했습니다.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const nextStatus = NEXT_STATUS_MAP[inspection.status];
  const nextStatusLabel = nextStatus ? STATUS_LABELS[nextStatus] : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>목록으로</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">작업 상세</h1>
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <span>오프라인</span>
          </div>
        )}
      </div>

      {/* 상태 카드 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">현재 상태</p>
            <span className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[inspection.status] || 'bg-gray-100 text-gray-800'}`}>
              {STATUS_LABELS[inspection.status] || inspection.status}
            </span>
          </div>
          <div className="flex gap-3">
            {inspection.status === 'in_progress' && (
              <button
                onClick={() => router.push(`/inspector/inspections/${inspectionId}/checklist`)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors min-h-[56px]"
              >
                체크리스트 작성
              </button>
            )}
            {nextStatusLabel && (
              <button
                onClick={handleStatusChange}
                disabled={statusMutation.isPending}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors min-h-[56px]"
              >
                {statusMutation.isPending ? '처리 중...' : `${nextStatusLabel}로 변경`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 차량 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">차량 정보</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-600">차량</p>
            <p className="text-base text-gray-900">{inspection.vehicle_info || '미확인'}</p>
          </div>
        </div>
      </div>

      {/* 위치 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">위치 정보</h2>
          <button
            onClick={() => openNavigation(inspection.location_address || '')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors min-h-[56px] flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            네비게이션
          </button>
        </div>
        <p className="text-base text-gray-900">{inspection.location_address || '미확인'}</p>
      </div>

      {/* 일정 정보 */}
      {inspection.schedule && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">일정 정보</h2>
          <div className="space-y-3">
            {inspection.schedule.preferred_date && inspection.schedule.preferred_time && (
              <div>
                <p className="text-sm font-medium text-gray-600">희망 일정</p>
                <p className="text-base text-gray-900">
                  {format(parseISO(inspection.schedule.preferred_date), 'yyyy년 MM월 dd일', { locale: ko })}{' '}
                  {inspection.schedule.preferred_time.substring(0, 5)}
                </p>
              </div>
            )}
            {inspection.schedule.actual_date && inspection.schedule.actual_time && (
              <div>
                <p className="text-sm font-medium text-gray-600">실제 일정</p>
                <p className="text-base text-gray-900">
                  {format(parseISO(inspection.schedule.actual_date), 'yyyy년 MM월 dd일', { locale: ko })}{' '}
                  {inspection.schedule.actual_time.substring(0, 5)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 고객 정보 */}
      {inspection.customer && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">고객 정보</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-600">이름</p>
              <p className="text-base text-gray-900">{inspection.customer.name || '미확인'}</p>
            </div>
            {inspection.customer.phone && (
              <div>
                <p className="text-sm font-medium text-gray-600">전화번호</p>
                <a
                  href={`tel:${inspection.customer.phone}`}
                  className="text-base text-indigo-600 hover:text-indigo-700"
                >
                  {inspection.customer.phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 결제 정보 */}
      {inspection.payment && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-600">결제 금액</p>
              <p className="text-base font-semibold text-gray-900">
                {inspection.payment.amount?.toLocaleString() || 0}원
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">결제 상태</p>
              <p className="text-base text-gray-900">{inspection.payment.status || '미확인'}</p>
            </div>
          </div>
        </div>
      )}

      {/* 레포트 정보 */}
      {inspection.report_summary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">레포트 정보</h2>
          <div className="space-y-3">
            {inspection.report_summary.result && (
              <div>
                <p className="text-sm font-medium text-gray-600">진단 결과</p>
                <p className="text-base text-gray-900">{inspection.report_summary.result}</p>
              </div>
            )}
            {inspection.report_summary.web_view_url && (
              <a
                href={inspection.report_summary.web_view_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                레포트 보기
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

