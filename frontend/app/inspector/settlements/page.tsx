'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getMySettlements,
  getMonthlySettlementSummary,
  getSettlementDetail,
  type Settlement,
  type MonthlySettlementSummary,
} from '@/lib/api/inspector';
import { format, parseISO, startOfYear, endOfYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { FixedSizeList } from 'react-window';
import { isOnline, onOnlineStatusChange } from '@/lib/utils/offline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

export default function SettlementsPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const listRef = useRef<FixedSizeList>(null);

  const pageSize = 20;

  // 오프라인 상태 감지
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOffline(!online);
    });
    return () => unsubscribe();
  }, []);

  // 월별 정산 요약 조회
  const { data: monthlySummary, isLoading: monthlyLoading } = useQuery({
    queryKey: ['inspector-monthly-settlement', selectedYear],
    queryFn: () => getMonthlySettlementSummary(selectedYear),
    enabled: !isOffline,
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 정산 내역 목록 조회
  const { data: settlementsData, isLoading: settlementsLoading } = useQuery({
    queryKey: ['inspector-settlements', statusFilter, startDate, endDate, page],
    queryFn: () =>
      getMySettlements({
        status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        page_size: pageSize,
      }),
    enabled: !isOffline,
    staleTime: 30000, // 30초
  });

  // 정산 상세 조회
  const { data: settlementDetail } = useQuery({
    queryKey: ['inspector-settlement-detail', selectedSettlement?.id],
    queryFn: () => getSettlementDetail(selectedSettlement!.id),
    enabled: !!selectedSettlement && showDetailModal && !isOffline,
  });

  // 차트 데이터 준비
  const chartData = monthlySummary
    ? {
        labels: monthlySummary.monthly_summary.map((m) => `${m.month}월`),
        datasets: [
          {
            label: '정산 금액',
            data: monthlySummary.monthly_summary.map((m) => m.total_amount),
            backgroundColor: 'rgba(99, 102, 241, 0.5)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y.toLocaleString()}원`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            return `${value.toLocaleString()}원`;
          },
        },
      },
    },
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    if (!settlementsData) return;

    const headers = ['정산일', '진단 ID', '고객 결제금액', '수수료율', '정산액', '상태'];
    const rows = settlementsData.settlements.map((s) => [
      s.settle_date,
      s.inspection_id,
      s.total_sales.toLocaleString(),
      `${(s.fee_rate * 100).toFixed(1)}%`,
      s.settle_amount.toLocaleString(),
      s.status === 'completed' ? '정산완료' : '미정산',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `정산내역_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 상세 내역 모달 열기
  const handleOpenDetail = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setShowDetailModal(true);
  };

  // 더보기 버튼 클릭
  const handleLoadMore = () => {
    if (settlementsData && page * pageSize < settlementsData.total) {
      setPage((prev) => prev + 1);
    }
  };

  // 가상 스크롤 아이템 렌더링
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (!settlementsData || index >= settlementsData.settlements.length) return null;

    const settlement = settlementsData.settlements[index];
    return (
      <div
        style={style}
        className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => handleOpenDetail(settlement)}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-900">
                {format(parseISO(settlement.settle_date), 'yyyy년 MM월 dd일', { locale: ko })}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  settlement.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {settlement.status === 'completed' ? '정산완료' : '미정산'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              진단 ID: {settlement.inspection_id.substring(0, 8)}...
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">
              {settlement.settle_amount.toLocaleString()}원
            </div>
            <div className="text-sm text-gray-500">
              수수료율: {(settlement.fee_rate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">정산 내역</h1>
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <span>오프라인</span>
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          {/* 연도 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">연도</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
          </div>

          {/* 상태 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
            >
              <option value="">전체</option>
              <option value="pending">미정산</option>
              <option value="completed">정산완료</option>
            </select>
          </div>

          {/* 시작일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
            />
          </div>

          {/* 종료일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
            />
          </div>

          {/* 필터 초기화 */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors min-h-[44px]"
            >
              초기화
            </button>
          </div>

          {/* CSV 다운로드 */}
          <div className="flex items-end ml-auto">
            <button
              onClick={handleDownloadCSV}
              disabled={!settlementsData || isOffline}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              CSV 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* 월별 요약 차트 */}
      {monthlyLoading ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      ) : chartData ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedYear}년 월별 정산 금액 추이
          </h2>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      ) : null}

      {/* 정산 내역 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            정산 내역 ({settlementsData?.total || 0}건)
          </h2>
        </div>
        {settlementsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : settlementsData && settlementsData.settlements.length > 0 ? (
          <>
            <FixedSizeList
              ref={listRef}
              height={600}
              itemCount={settlementsData.settlements.length}
              itemSize={80}
              width="100%"
            >
              {Row}
            </FixedSizeList>
            {settlementsData.total > page * pageSize && (
              <div className="p-4 border-t border-gray-200 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors min-h-[44px]"
                >
                  더보기 ({settlementsData.total - page * pageSize}건 남음)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-500">정산 내역이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 상세 내역 모달 */}
      {showDetailModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">정산 상세 내역</h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedSettlement(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {settlementDetail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">정산일</p>
                      <p className="text-base text-gray-900">
                        {format(parseISO(selectedSettlement.settle_date), 'yyyy년 MM월 dd일', {
                          locale: ko,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">상태</p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                          selectedSettlement.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {selectedSettlement.status === 'completed' ? '정산완료' : '미정산'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">고객 결제금액</p>
                      <p className="text-base text-gray-900">
                        {selectedSettlement.total_sales.toLocaleString()}원
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">수수료율</p>
                      <p className="text-base text-gray-900">
                        {(selectedSettlement.fee_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">정산액</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedSettlement.settle_amount.toLocaleString()}원
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">진단 ID</p>
                      <p className="text-base text-gray-900">{selectedSettlement.inspection_id}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

