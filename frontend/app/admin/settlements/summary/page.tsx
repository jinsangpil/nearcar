'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettlementSummary, calculateSettlements, type SettlementSummaryResponse } from '@/lib/api/settlements';
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
import { format } from 'date-fns';
import { formatNumberWithCommas } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';

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

export default function SettlementSummaryPage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<string>(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [calculateModal, setCalculateModal] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  // 정산 요약 정보 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['settlement-summary', startDate, endDate],
    queryFn: () => getSettlementSummary(startDate, endDate),
  });

  // 정산 집계 실행 Mutation
  const calculateMutation = useMutation({
    mutationFn: (date: string) => calculateSettlements(date),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['settlement-summary'] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      setCalculateModal(false);
      alert(
        `정산 집계가 완료되었습니다.\n대상일: ${result.target_date}\n생성된 정산 건수: ${result.settlements_created}건\n전체 진단 건수: ${result.total_inspections}건`
      );
    },
    onError: (error: any) => {
      console.error('정산 집계 실패:', error);
      alert(error.message || '정산 집계에 실패했습니다.');
    },
  });

  const handleCalculate = () => {
    setCalculateModal(true);
  };

  const confirmCalculate = () => {
    calculateMutation.mutate(targetDate);
  };

  // 일별 정산 차트 데이터
  const dailyChartData = useMemo(() => {
    if (!data?.daily_summary) return null;

    return {
      labels: data.daily_summary.map((item) => {
        try {
          return format(new Date(item.date), 'MM/dd');
        } catch {
          return item.date;
        }
      }),
      datasets: [
        {
          label: '정산액 (원)',
          data: data.daily_summary.map((item) => item.total_amount),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
        },
      ],
    };
  }, [data]);

  // 주별 정산 차트 데이터
  const weeklyChartData = useMemo(() => {
    if (!data?.weekly_summary) return null;

    return {
      labels: data.weekly_summary.map((item, index) => {
        if (item.week_start) {
          try {
            return format(new Date(item.week_start), 'MM/dd');
          } catch {
            return `주 ${index + 1}`;
          }
        }
        return `주 ${index + 1}`;
      }),
      datasets: [
        {
          label: '정산액 (원)',
          data: data.weekly_summary.map((item) => item.total_amount),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  // 월별 정산 차트 데이터
  const monthlyChartData = useMemo(() => {
    if (!data?.monthly_summary) return null;

    return {
      labels: data.monthly_summary.map((item) => {
        if (item.month_start) {
          try {
            return format(new Date(item.month_start), 'yyyy년 MM월');
          } catch {
            return item.month_start;
          }
        }
        return '-';
      }),
      datasets: [
        {
          label: '정산액 (원)',
          data: data.monthly_summary.map((item) => item.total_amount),
          backgroundColor: 'rgba(168, 85, 247, 0.5)',
          borderColor: 'rgb(168, 85, 247)',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

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
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${formatNumberWithCommas(context.parsed.y)}원`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: any) {
            return formatNumberWithCommas(value);
          },
        },
      },
    },
  };

  // 기사별 정산 현황 테이블 컬럼
  const inspectorColumns = useMemo<
    ColumnDef<SettlementSummaryResponse['inspector_summary'][0]>[]
  >(
    () => [
      {
        accessorKey: 'inspector_name',
        header: '기사명',
      },
      {
        accessorKey: 'inspection_count',
        header: '진단 건수',
        cell: ({ row }) => {
          return `${row.original.inspection_count}건`;
        },
      },
      {
        accessorKey: 'total_sales',
        header: '총 매출',
        cell: ({ row }) => {
          return `${formatNumberWithCommas(row.original.total_sales)}원`;
        },
      },
      {
        accessorKey: 'total_settle_amount',
        header: '총 정산액',
        cell: ({ row }) => {
          return `${formatNumberWithCommas(row.original.total_settle_amount)}원`;
        },
      },
      {
        accessorKey: 'pending_amount',
        header: '미정산액',
        cell: ({ row }) => {
          return `${formatNumberWithCommas(row.original.pending_amount)}원`;
        },
      },
      {
        accessorKey: 'completed_amount',
        header: '정산완료액',
        cell: ({ row }) => {
          return `${formatNumberWithCommas(row.original.completed_amount)}원`;
        },
      },
    ],
    []
  );

  const inspectorTable = useReactTable({
    data: data?.inspector_summary || [],
    columns: inspectorColumns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">정산 집계</h1>
          <p className="mt-1 text-sm text-gray-500">정산 요약 정보를 확인하고 집계를 실행하세요</p>
        </div>
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">데이터를 불러오는 중 오류가 발생했습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => window.history.back()}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">정산 집계</h1>
          <p className="mt-1 text-sm text-gray-500">정산 요약 정보를 확인하고 집계를 실행하세요</p>
        </div>
        <button
          onClick={handleCalculate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          정산 집계 실행
        </button>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
              시작일
            </label>
            <input
              type="date"
              id="start_date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
              종료일
            </label>
            <input
              type="date"
              id="end_date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      {data && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">미정산</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">미정산 건수</dt>
                    <dd className="text-lg font-medium text-gray-900">{data.pending_count}건</dd>
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
                    <span className="text-white text-sm font-bold">완료</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">정산완료 건수</dt>
                    <dd className="text-lg font-medium text-gray-900">{data.completed_count}건</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-600 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">미정산</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">미정산 총액</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatNumberWithCommas(data.total_pending_amount)}원
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">완료</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">정산완료 총액</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatNumberWithCommas(data.total_completed_amount)}원
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 차트 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {dailyChartData && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">일별 정산 추이</h2>
            <div className="h-64">
              <Line data={dailyChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {weeklyChartData && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">주별 정산 추이</h2>
            <div className="h-64">
              <Bar data={weeklyChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {monthlyChartData && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">월별 정산 추이</h2>
            <div className="h-64">
              <Bar data={monthlyChartData} options={chartOptions} />
            </div>
          </div>
        )}
      </div>

      {/* 기사별 정산 현황 테이블 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">기사별 정산 현황</h2>
        {data && data.inspector_summary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {inspectorTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <div className="flex items-center space-x-1">
                          <span>
                            {header.isPlaceholder
                              ? null
                              : typeof header.column.columnDef.header === 'string'
                              ? header.column.columnDef.header
                              : header.column.columnDef.header
                              ? header.column.columnDef.header({ column: header.column, header, table: inspectorTable })
                              : null}
                          </span>
                          {header.column.getCanSort() && (
                            <span>
                              {{
                                asc: ' ↑',
                                desc: ' ↓',
                              }[header.column.getIsSorted() as string] ?? ' ↕'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inspectorTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cell.renderValue() as React.ReactNode}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">기사별 정산 내역이 없습니다.</p>
        )}
      </div>

      {/* 정산 집계 실행 모달 */}
      {calculateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">정산 집계 실행</h3>
              <p className="text-sm text-gray-500 mb-4">
                지정된 날짜에 완료된 진단 건에 대한 정산을 집계합니다.
              </p>
              <div className="mb-4">
                <label htmlFor="target_date" className="block text-sm font-medium text-gray-700 mb-2">
                  정산 기준일
                </label>
                <input
                  type="date"
                  id="target_date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setCalculateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={confirmCalculate}
                  disabled={calculateMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {calculateMutation.isPending ? '집계 중...' : '집계 실행'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

