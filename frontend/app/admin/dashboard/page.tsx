'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/api/admin';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardPage() {
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30000, // 30초마다 폴링
    retry: 1, // 재시도 1회만
    staleTime: 10000, // 10초간 캐시 유지
  });

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

  if (isError || error) {
    console.error('대시보드 데이터 로딩 오류:', error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">오늘의 주요 지표를 확인하세요</p>
        </div>
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">
            데이터를 불러오는 중 오류가 발생했습니다.
            {error instanceof Error && (
              <div className="mt-2 text-xs text-red-600">{error.message}</div>
            )}
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 일별 추이 차트 데이터
  const dailyChartData = {
    labels: (data.daily_trend || []).map((item) => {
      const date = new Date(item.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        label: '신청 건수',
        data: (data.daily_trend || []).map((item) => item.count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
    ],
  };

  // 주별 추이 차트 데이터
  const weeklyChartData = {
    labels: (data.weekly_trend || []).map((item, index) => `${index + 1}주 전`),
    datasets: [
      {
        label: '신청 건수',
        data: (data.weekly_trend || []).map((item) => item.count),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">오늘의 주요 지표를 확인하세요</p>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">신규</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">신규 신청</dt>
                  <dd className="text-lg font-medium text-gray-900">{data.new_inspections ?? 0}건</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">미배정</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">미배정</dt>
                  <dd className="text-lg font-medium text-gray-900">{data.unassigned ?? 0}건</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">진행중</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">진행 중</dt>
                  <dd className="text-lg font-medium text-gray-900">{data.in_progress ?? 0}건</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">완료</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">완료</dt>
                  <dd className="text-lg font-medium text-gray-900">{data.completed ?? 0}건</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">일별 신청 추이</h2>
          <div className="h-64">
            <Line data={dailyChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">주별 신청 추이</h2>
          <div className="h-64">
            <Bar data={weeklyChartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

