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
import { getInspections, InspectionListItem } from '@/lib/api/admin';
import Link from 'next/link';
import { format } from 'date-fns';

const STORAGE_KEY = 'admin_inspections_filters';

export default function InspectionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // 로컬 스토리지에서 필터/정렬 설정 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStatusFilter(parsed.statusFilter || '');
        setRegionFilter(parsed.regionFilter || '');
        setDateFilter(parsed.dateFilter || '');
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
        statusFilter,
        regionFilter,
        dateFilter,
        sorting,
        pagination,
      })
    );
  }, [statusFilter, regionFilter, dateFilter, sorting, pagination]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'inspections',
      statusFilter,
      regionFilter,
      dateFilter,
      pagination.pageIndex + 1,
      pagination.pageSize,
      sorting[0]?.id || 'created_at',
      sorting[0]?.desc ? 'desc' : 'asc',
    ],
    queryFn: () =>
      getInspections({
        status: statusFilter || undefined,
        region: regionFilter || undefined,
        date: dateFilter || undefined,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        sort_by: sorting[0]?.id || 'created_at',
        sort_order: sorting[0]?.desc ? 'desc' : 'asc',
      }),
    refetchInterval: 30000, // 30초마다 폴링
  });

  const columns = useMemo<ColumnDef<InspectionListItem>[]>(
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
        accessorKey: 'customer_name',
        header: '고객명',
      },
      {
        accessorKey: 'vehicle_info',
        header: '차량정보',
        cell: ({ row }) => {
          return row.original.plate_number || '-';
        },
      },
      {
        accessorKey: 'region',
        header: '지역',
        cell: ({ row }) => {
          const address = row.original.location_address || '';
          // 주소에서 지역 추출 (간단한 예시)
          return address.split(' ').slice(0, 2).join(' ') || '-';
        },
      },
      {
        accessorKey: 'schedule_date',
        header: '일시',
        cell: ({ row }) => {
          const date = row.original.schedule_date;
          const time = row.original.schedule_time;
          if (date && time) {
            try {
              const dateObj = new Date(date);
              return format(dateObj, 'MM/dd') + ' ' + time.substring(0, 5);
            } catch {
              return date + ' ' + time.substring(0, 5);
            }
          }
          return '-';
        },
      },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ row }) => {
          const status = row.original.status;
          const statusMap: Record<string, { label: string; color: string }> = {
            requested: { label: '접수중', color: 'bg-yellow-100 text-yellow-800' },
            paid: { label: '결제완료', color: 'bg-blue-100 text-blue-800' },
            assigned: { label: '배정완료', color: 'bg-purple-100 text-purple-800' },
            in_progress: { label: '진행중', color: 'bg-green-100 text-green-800' },
            completed: { label: '완료', color: 'bg-gray-100 text-gray-800' },
            sent: { label: '발송완료', color: 'bg-indigo-100 text-indigo-800' },
            cancelled: { label: '취소', color: 'bg-red-100 text-red-800' },
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
        id: 'actions',
        header: '관리',
        cell: ({ row }) => {
          return (
            <div className="flex space-x-2">
              {(row.original.status === 'requested' || row.original.status === 'paid') && (
                <Link
                  href={`/admin/inspections/${row.original.id}/assign`}
                  className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                >
                  배정
                </Link>
              )}
              <Link
                href={`/admin/inspections/${row.original.id}`}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                보기
              </Link>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: data?.items || [],
    columns,
    pageCount: data?.total_pages ?? -1,
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">신청 관리</h1>
        <p className="mt-1 text-sm text-gray-500">진단 신청 목록을 확인하고 관리하세요</p>
      </div>

      {/* 필터 */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              상태
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
              <option value="requested">접수중</option>
              <option value="paid">결제완료</option>
              <option value="assigned">배정완료</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="sent">발송완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700">
              지역
            </label>
            <input
              type="text"
              id="region"
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              placeholder="지역 입력"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              날짜
            </label>
            <input
              type="date"
              id="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

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
            {table.getRowModel().rows.map((row) => (
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

        {/* 페이지네이션 */}
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
                총 <span className="font-medium">{data?.total || 0}</span>건 중{' '}
                <span className="font-medium">
                  {pagination.pageIndex * pagination.pageSize + 1}-
                  {Math.min((pagination.pageIndex + 1) * pagination.pageSize, data?.total || 0)}
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
      </div>
    </div>
  );
}

