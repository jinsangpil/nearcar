'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyInspections, updateInspectionStatus, type MyInspection } from '@/lib/api/inspector';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
  saveInspections,
  getAllInspections,
  queueStatusChange,
} from '@/lib/db/inspectorDB';
import { isOnline, onOnlineStatusChange, startQueueSync } from '@/lib/utils/offline';
import { createNavigationLink } from '@/lib/utils/geolocation';

// 상태 필터 옵션
const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'assigned', label: '방문 예정' },
  { value: 'scheduled', label: '일정 확정' },
  { value: 'in_progress', label: '진단 중' },
  { value: 'report_submitted', label: '레포트 제출' },
];

// 다음 상태로 변경 가능한 상태 매핑
const NEXT_STATUS_MAP: Record<string, string> = {
  assigned: 'scheduled',
  scheduled: 'in_progress',
  in_progress: 'report_submitted',
};

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

export default function InspectionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isOffline, setIsOffline] = useState(!isOnline());
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeThreshold = 50; // 스와이프 최소 거리

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

  // 진행 중인 작업 목록 조회 (오프라인 시 캐시 사용)
  const { data: inspections, isLoading, error } = useQuery({
    queryKey: ['inspector-my-inspections', statusFilter],
    queryFn: async () => {
      try {
        const data = await getMyInspections(statusFilter || undefined);
        // 온라인일 때만 캐시에 저장
        if (isOnline()) {
          await saveInspections(data);
        }
        return data;
      } catch (err) {
        // 오프라인 또는 에러 시 캐시에서 조회
        if (isOffline || !isOnline()) {
          const cached = await getAllInspections();
          // 필터 적용
          if (statusFilter) {
            return cached.filter((item) => item.status === statusFilter);
          }
          return cached;
        }
        throw err;
      }
    },
    refetchInterval: isOffline ? false : 30000, // 오프라인 시 폴링 중지
    staleTime: 10000,
  });

  // 상태 변경 mutation
  const statusMutation = useMutation({
    mutationFn: ({ inspectionId, newStatus }: { inspectionId: string; newStatus: string }) =>
      updateInspectionStatus(inspectionId, newStatus as any),
    onSuccess: () => {
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

  const handleStatusChange = async (inspection: MyInspection) => {
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
    statusMutation.mutate({
      inspectionId: inspection.id,
      newStatus: nextStatus,
    });
  };

  // 스와이프 제스처 핸들러
  const handleTouchStart = (e: React.TouchEvent, inspection: MyInspection) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // 스와이프 중에는 스크롤 방지
    if (swipeStartX.current !== null) {
      const deltaX = e.touches[0].clientX - swipeStartX.current;
      const deltaY = e.touches[0].clientY - swipeStartY.current;
      
      // 수평 스와이프가 수직 스크롤보다 크면 스크롤 방지
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, inspection: MyInspection) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;

    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    const deltaY = e.changedTouches[0].clientY - swipeStartY.current;

    // 좌측 스와이프 (상태 변경)
    if (deltaX < -swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      const nextStatus = NEXT_STATUS_MAP[inspection.status];
      if (nextStatus) {
        handleStatusChange(inspection);
      }
    }

    swipeStartX.current = null;
    swipeStartY.current = null;
  };

  const getNextStatusLabel = (status: string): string | null => {
    const nextStatus = NEXT_STATUS_MAP[status];
    return nextStatus ? STATUS_LABELS[nextStatus] : null;
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600">작업 목록을 불러오는데 실패했습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">진행 중인 작업</h1>
        <div className="flex items-center gap-3">
          {isOffline && (
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              <span>오프라인</span>
            </div>
          )}
          <div className="text-sm text-gray-500">
            총 {inspections?.length || 0}건
          </div>
        </div>
      </div>

      {/* 상태 필터 탭 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                statusFilter === filter.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* 작업 목록 */}
      {!inspections || inspections.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">진행 중인 작업이 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">
            배정 요청을 수락하면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((inspection) => {
            const nextStatusLabel = getNextStatusLabel(inspection.status);
            return (
              <div
                key={inspection.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                onTouchStart={(e) => handleTouchStart(e, inspection)}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => handleTouchEnd(e, inspection)}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* 왼쪽: 정보 */}
                  <div className="flex-1 space-y-3">
                    {/* 상태 및 차량 정보 */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[inspection.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[inspection.status] || inspection.status}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {inspection.vehicle}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {inspection.plate_number && (
                            <span>차량번호: {inspection.plate_number}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 위치 정보 */}
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-gray-400 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">위치</p>
                        <p className="text-sm text-gray-600">{inspection.location}</p>
                      </div>
                    </div>

                    {/* 일정 정보 */}
                    {inspection.schedule_date && inspection.schedule_time && (
                      <div className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 text-gray-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">일정</p>
                          <p className="text-sm text-gray-600">
                            {format(parseISO(inspection.schedule_date), 'yyyy년 MM월 dd일', { locale: ko })}{' '}
                            {inspection.schedule_time.substring(0, 5)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 고객 정보 */}
                    {inspection.customer_name && (
                      <div className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 text-gray-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">고객</p>
                          <p className="text-sm text-gray-600">{inspection.customer_name}</p>
                        </div>
                      </div>
                    )}

                    {/* 금액 정보 */}
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">총액</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {inspection.total_amount.toLocaleString()}원
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 액션 버튼 */}
                  <div className="flex flex-col gap-3 md:w-48">
                    {/* 네비게이션 버튼 */}
                    <button
                      onClick={() => openNavigation(inspection.location)}
                      className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors min-h-[56px] flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      네비게이션
                    </button>

                    {/* 상태 변경 버튼 */}
                    {nextStatusLabel && (
                      <button
                        onClick={() => handleStatusChange(inspection)}
                        disabled={statusMutation.isPending}
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors min-h-[56px] flex items-center justify-center"
                      >
                        {statusMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>처리 중...</span>
                          </div>
                        ) : (
                          `${nextStatusLabel}로 변경`
                        )}
                      </button>
                    )}

                    {/* 상세 보기 버튼 */}
                    <button
                      onClick={() => router.push(`/inspector/inspections/${inspection.id}`)}
                      className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors min-h-[56px] flex items-center justify-center"
                    >
                      상세 보기
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

