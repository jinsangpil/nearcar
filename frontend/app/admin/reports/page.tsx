'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInspections, InspectionListItem } from '@/lib/api/admin';
import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import apiClient from '@/lib/api/client';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  // 제출된 레포트 목록 조회 (status가 completed 또는 submitted인 신청)
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-list', 'completed'],
    queryFn: () =>
      getInspections({
        status: 'completed',
        page: 1,
        limit: 100,
      }),
    refetchInterval: 30000, // 30초마다 폴링
  });

  const approveMutation = useMutation({
    mutationFn: async (inspectionId: string) => {
      // 레포트 승인 API 호출
      const params = feedback ? `?feedback=${encodeURIComponent(feedback)}` : '';
      await apiClient.post(`/admin/reports/${inspectionId}/approve${params}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-list'] });
      setSelectedReportId(null);
      setFeedback('');
      setAction(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (inspectionId: string) => {
      // 레포트 반려 API 호출
      const params = feedback ? `?feedback=${encodeURIComponent(feedback)}` : '';
      await apiClient.post(`/admin/reports/${inspectionId}/reject${params}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-list'] });
      setSelectedReportId(null);
      setFeedback('');
      setAction(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">데이터를 불러오는 중 오류가 발생했습니다.</div>
      </div>
    );
  }

  const reports = data?.items.filter((item) => item.status === 'completed') || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">레포트 검수</h1>
        <p className="mt-1 text-sm text-gray-500">제출된 진단 레포트를 검토하고 승인/반려하세요</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 레포트 목록 */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">제출된 레포트</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {reports.length === 0 ? (
              <div className="p-6 text-center text-gray-500">제출된 레포트가 없습니다.</div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedReportId === report.id ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => setSelectedReportId(report.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {report.customer_name || '고객명 없음'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {report.plate_number || '차량번호 없음'} ·{' '}
                        {report.schedule_date
                          ? format(new Date(report.schedule_date), 'MM/dd')
                          : '-'}
                      </div>
                    </div>
                    <Link
                      href={`/admin/inspections/${report.id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      상세보기
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 레포트 상세 및 검수 */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">레포트 검토</h2>
          </div>
          {selectedReportId ? (
            <ReportReviewPanel
              inspectionId={selectedReportId}
              feedback={feedback}
              setFeedback={setFeedback}
              action={action}
              setAction={setAction}
              onApprove={() => approveMutation.mutate(selectedReportId)}
              onReject={() => rejectMutation.mutate(selectedReportId)}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
            />
          ) : (
            <div className="p-6 text-center text-gray-500">
              왼쪽에서 레포트를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportReviewPanel({
  inspectionId,
  feedback,
  setFeedback,
  action,
  setAction,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  inspectionId: string;
  feedback: string;
  setFeedback: (value: string) => void;
  action: 'approve' | 'reject' | null;
  setAction: (value: 'approve' | 'reject' | null) => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const { data: report, isLoading } = useQuery({
    queryKey: ['inspection-report', inspectionId],
    queryFn: () => import('@/lib/api/admin').then((m) => m.getInspectionReport(inspectionId)),
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-center text-gray-500">레포트를 찾을 수 없습니다.</div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 레포트 내용 */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">체크리스트 데이터</h3>
        <div className="bg-gray-50 rounded-md p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(report.checklist_data, null, 2)}
          </pre>
        </div>
      </div>

      {/* 이미지 */}
      {report.images && report.images.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">첨부 이미지</h3>
          <div className="grid grid-cols-2 gap-2">
            {report.images.map((imageUrl, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={imageUrl}
                alt={`이미지 ${index + 1}`}
                className="w-full h-32 object-cover rounded-md"
              />
            ))}
          </div>
        </div>
      )}

      {/* 기사 코멘트 */}
      {report.inspector_comment && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">기사 코멘트</h3>
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-sm text-gray-700">{report.inspector_comment}</p>
          </div>
        </div>
      )}

      {/* 예상 수리비 */}
      {report.repair_cost_est !== undefined && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">예상 수리비</h3>
          <div className="text-lg font-semibold text-gray-900">
            {report.repair_cost_est.toLocaleString()}원
          </div>
        </div>
      )}

      {/* 피드백 입력 */}
      <div>
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
          피드백 (선택사항)
        </label>
        <textarea
          id="feedback"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="수정 요청 사항이나 피드백을 입력하세요"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {/* 승인/반려 버튼 */}
      <div className="flex space-x-3">
        <button
          onClick={() => {
            setAction('approve');
            onApprove();
          }}
          disabled={isApproving || isRejecting}
          className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {isApproving ? '승인 중...' : '승인'}
        </button>
        <button
          onClick={() => {
            setAction('reject');
            onReject();
          }}
          disabled={isApproving || isRejecting}
          className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
        >
          {isRejecting ? '반려 중...' : '반려'}
        </button>
      </div>
    </div>
  );
}

