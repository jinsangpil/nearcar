'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';
import { getSettlements, exportSettlements, type SettlementItem, type SettlementListParams } from '@/lib/api/settlements';
import { getInspectors, type Inspector } from '@/lib/api/admin';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatNumberWithCommas } from '@/lib/utils';

const STORAGE_KEY = 'admin_settlements_filters';

// 디바운스 훅
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SettlementsPage() {
  const [inspectorFilter, setInspectorFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'settle_date', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [isExporting, setIsExporting] = useState(false);

  // 기사 목록 조회 (필터용)
  const { data: inspectors = [] } = useQuery<Inspector[]>({
    queryKey: ['inspectors'],
    queryFn: getInspectors,
  });

  // 로컬 스토리지에서 필터/정렬 설정 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInspectorFilter(parsed.inspectorFilter || '');
        setStatusFilter(parsed.statusFilter || '');
        setStartDateFilter(parsed.startDateFilter || '');
        setEndDateFilter(parsed.endDateFilter || '');
        if (parsed.sorting) setSorting(parsed.sorting);
        if (parsed.pagination) setPagination(parsed.pagination);
      } catch (e) {
        console.error('로컬 스토리지 복원 실패:', e);
      }
    }
  }, []);

  // 필터/정렬 설정 저장
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        inspectorFilter,
        statusFilter,
        startDateFilter,
        endDateFilter,
        sorting,
        pagination,
      })
    );
  }, [inspectorFilter, statusFilter, startDateFilter, endDateFilter, sorting, pagination]);

  // API 파라미터 구성
  const apiParams = useMemo<SettlementListParams>(() => {
    const params: SettlementListParams = {
      page: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    };

    if (inspectorFilter) {
      params.inspector_id = inspectorFilter;
    }

    if (statusFilter) {
      params.status = statusFilter as 'pending' | 'completed';
    }

    if (startDateFilter) {
      params.start_date = startDateFilter;
    }

    if (endDateFilter) {
      params.end_date = endDateFilter;
    }

    if (sorting[0]) {
      params.sort_by = (sorting[0].id as 'settle_date' | 'settle_amount' | 'created_at') || 'settle_date';
      params.sort_order = sorting[0].desc ? 'desc' : 'asc';
    }

    return params;
  }, [inspectorFilter, statusFilter, startDateFilter, endDateFilter, pagination, sorting]);

  // 정산 목록 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['settlements', apiParams],
    queryFn: () => getSettlements(apiParams),
  });

  const columns = useMemo<ColumnDef<SettlementItem>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'No',
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex;
          const pageSize = table.getState().pagination.pageSize;
          return pageIndex * pageSize + row.index + 1;
        },
      },
      {
        accessorKey: 'inspector_name',
        header: '기사명',
        cell: ({ row }) => {
          return row.original.inspector_name || '-';
        },
      },
      {
        accessorKey: 'inspection_id',
        header: '진단 ID',
        cell: ({ row }) => {
          const inspectionId = row.original.inspection_id;
          return inspectionId ? (
            <Link
              href={`/admin/inspections/${inspectionId}`}
              className="text-indigo-600 hover:text-indigo-900 text-sm"
            >
              {inspectionId.substring(0, 8)}...
            </Link>
          ) : '-';
        },
      },
      {
        accessorKey: 'total_sales',
        header: '총 금액',
        cell: ({ row }) => {
          return `${formatNumberWithCommas(row.original.total_sales)}원`;
        },
      },
      {
        accessorKey: 'settle_amount',
        header: '정산액',
        cell: ({ row }) => {
          return `${formatNumberWithCommas(row.original.settle_amount)}원`;
        },
      },
      {
        accessorKey: 'status',
        header: '정산 상태',
        cell: ({ row }) => {
          const status = row.original.status;
          const statusMap: Record<string, { label: string; color: string }> = {
            pending: { label: '미정산', color: 'bg-yellow-100 text-yellow-800' },
            completed: { label: '정산완료', color: 'bg-green-100 text-green-800' },
          };
          const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
          return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          );
        },
      },
      {
        accessorKey: 'settle_date',
        header: '정산일',
        cell: ({ row }) => {
          const date = row.original.settle_date;
          if (date) {
            try {
              return format(new Date(date), 'yyyy-MM-dd');
            } catch {
              return date;
            }
          }
          return '-';
        },
      },
      {
        id: 'actions',
        header: '관리',
        cell: ({ row }) => {
          return (
            <div className="flex space-x-2">
              <Link
                href={`/admin/settlements/${row.original.id}`}
                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
              >
                상세
              </Link>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: data?.settlements || [],
    columns,
    pageCount: data ? Math.ceil(data.total / data.page_size) : -1,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
          <p className="mt-1 text-sm text-gray-500">기사별 정산 내역을 확인하고 관리하세요</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              setIsExporting(true);
              try {
                const params: SettlementListParams = {
                  inspector_id: inspectorFilter || undefined,
                  status: (statusFilter as 'pending' | 'completed') || undefined,
                  start_date: startDateFilter || undefined,
                  end_date: endDateFilter || undefined,
                };
                const blob = await exportSettlements(params);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `정산내역_${format(new Date(), 'yyyyMMdd')}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('엑셀 다운로드 실패:', error);
                alert('엑셀 다운로드에 실패했습니다.');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? '다운로드 중...' : '엑셀 다운로드'}
          </button>
          <Link
            href="/admin/settlements/summary"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            정산 집계
          </Link>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="inspector" className="block text-sm font-medium text-gray-700">
              기사
            </label>
            <select
              id="inspector"
              value={inspectorFilter}
              onChange={(e) => {
                setInspectorFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">전체</option>
              {inspectors.map((inspector) => (
                <option key={inspector.id} value={inspector.id}>
                  {inspector.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              정산 상태
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">전체</option>
              <option value="pending">미정산</option>
              <option value="completed">정산완료</option>
            </select>
          </div>

          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
              시작일
            </label>
            <input
              type="date"
              id="start_date"
              value={startDateFilter}
              onChange={(e) => {
                setStartDateFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
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
              value={endDateFilter}
              onChange={(e) => {
                setEndDateFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-gray-900">{data.total}</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전체 정산 건수</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-yellow-600">
                    {data.settlements.filter(s => s.status === 'pending').length}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">미정산 건수</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumberWithCommas(
                      data.settlements
                        .filter(s => s.status === 'pending')
                        .reduce((sum, s) => sum + s.settle_amount, 0)
                    )}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">미정산 총액 (원)</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
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
                          ? header.column.columnDef.header({ column: header.column, header, table })
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-gray-500">
                  정산 내역이 없습니다.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cell.renderValue() as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {data && data.total > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                다음
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  총 <span className="font-medium">{data.total}</span>건 중{' '}
                  <span className="font-medium">
                    {pagination.pageIndex * pagination.pageSize + 1}-
                    {Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.total)}
                  </span>
                  건 표시
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    처음
                  </button>
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    마지막
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

