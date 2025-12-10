'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAssignments, acceptAssignment, rejectAssignment, type Assignment } from '@/lib/api/inspector';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { saveAssignments, getAssignments as getCachedAssignments } from '@/lib/db/inspectorDB';
import { isOnline, onOnlineStatusChange } from '@/lib/utils/offline';

// 거절 사유 목록
const REJECT_REASONS = [
  '일정 충돌',
  '거리 너무 멀어서',
  '차량 종류 부적합',
  '개인 사정',
  '기타',
];

export default function AssignmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isOffline, setIsOffline] = useState(!isOnline());

  // 오프라인 상태 감지
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOffline(!online);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 배정 요청 목록 조회 (오프라인 시 캐시 사용)
  const { data: assignments, isLoading, error } = useQuery({
    queryKey: ['inspector-assignments'],
    queryFn: async () => {
      try {
        const data = await getAssignments();
        // 온라인일 때만 캐시에 저장
        if (isOnline()) {
          await saveAssignments(data);
        }
        return data;
      } catch (err) {
        // 오프라인 또는 에러 시 캐시에서 조회
        if (isOffline || !isOnline()) {
          return await getCachedAssignments();
        }
        throw err;
      }
    },
    refetchInterval: isOffline ? false : 30000, // 오프라인 시 폴링 중지
    staleTime: 10000,
  });

  // 배정 수락 mutation
  const acceptMutation = useMutation({
    mutationFn: (inspectionId: string) => acceptAssignment(inspectionId, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspector-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['inspector-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspector-my-inspections'] });
      alert('배정 요청을 수락했습니다.');
    },
    onError: (error: any) => {
      alert(`배정 수락에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    },
  });

  // 배정 거절 mutation
  const rejectMutation = useMutation({
    mutationFn: ({ inspectionId, reason }: { inspectionId: string; reason: string }) =>
      rejectAssignment(inspectionId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspector-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['inspector-dashboard-stats'] });
      setShowRejectModal(false);
      setSelectedAssignment(null);
      setRejectReason('');
      setCustomReason('');
      alert('배정 요청을 거절했습니다.');
    },
    onError: (error: any) => {
      alert(`배정 거절에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    },
  });

  const handleAccept = (assignment: Assignment) => {
    if (confirm('이 배정 요청을 수락하시겠습니까?')) {
      acceptMutation.mutate(assignment.id);
    }
  };

  const handleReject = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (!selectedAssignment) return;

    let reason = rejectReason;
    if (rejectReason === '기타') {
      if (!customReason.trim()) {
        alert('거절 사유를 입력해주세요.');
        return;
      }
      reason = customReason.trim();
    } else if (!reason) {
      alert('거절 사유를 선택해주세요.');
      return;
    }

    rejectMutation.mutate({
      inspectionId: selectedAssignment.id,
      reason,
    });
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
          <p className="text-red-600">배정 요청 목록을 불러오는데 실패했습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">배정 요청</h1>
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
            총 {assignments?.length || 0}건
          </div>
        </div>
      </div>

      {/* 배정 요청 목록 */}
      {!assignments || assignments.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">배정 요청이 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">
            새로운 배정 요청이 들어오면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* 왼쪽: 정보 */}
                <div className="flex-1 space-y-3">
                  {/* 차량 정보 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {assignment.vehicle}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {assignment.plate_number && (
                        <span>차량번호: {assignment.plate_number}</span>
                      )}
                      {assignment.year && (
                        <span>연식: {assignment.year}년</span>
                      )}
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
                    <div>
                      <p className="text-sm font-medium text-gray-900">위치</p>
                      <p className="text-sm text-gray-600">{assignment.location}</p>
                    </div>
                  </div>

                  {/* 일정 정보 */}
                  {assignment.schedule_date && assignment.schedule_time && (
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
                        <p className="text-sm font-medium text-gray-900">희망 일정</p>
                        <p className="text-sm text-gray-600">
                          {format(parseISO(assignment.schedule_date), 'yyyy년 MM월 dd일', { locale: ko })}{' '}
                          {assignment.schedule_time.substring(0, 5)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 수익 정보 */}
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
                      <p className="text-sm font-medium text-gray-900">예상 수익</p>
                      <p className="text-lg font-bold text-indigo-600">
                        {assignment.fee?.toLocaleString() || 0}원
                      </p>
                    </div>
                  </div>
                </div>

                {/* 오른쪽: 액션 버튼 */}
                <div className="flex flex-col gap-3 md:w-48">
                  <button
                    onClick={() => handleAccept(assignment)}
                    disabled={acceptMutation.isPending}
                    className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors min-h-[56px] flex items-center justify-center"
                  >
                    {acceptMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>처리 중...</span>
                      </div>
                    ) : (
                      '수락'
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(assignment)}
                    disabled={rejectMutation.isPending}
                    className="w-full md:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors min-h-[56px] flex items-center justify-center"
                  >
                    거절
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 거절 사유 모달 */}
      {showRejectModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">배정 거절 사유</h2>
            <p className="text-sm text-gray-600 mb-4">
              배정 요청을 거절하는 사유를 선택해주세요.
            </p>

            <div className="space-y-2 mb-4">
              {REJECT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    value={reason}
                    checked={rejectReason === reason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-900">{reason}</span>
                </label>
              ))}
            </div>

            {rejectReason === '기타' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사유 입력
                </label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="거절 사유를 입력해주세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedAssignment(null);
                  setRejectReason('');
                  setCustomReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={rejectMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
              >
                {rejectMutation.isPending ? '처리 중...' : '거절하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

