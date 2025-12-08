'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { getPackages, PackageListItem, deletePackage } from '@/lib/api/admin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'admin_packages_filters';

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

export default function PackagesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // 로컬 스토리지에서 필터 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setIsActiveFilter(parsed.isActiveFilter || 'all');
        setSearchQuery(parsed.searchQuery || '');
        if (parsed.sorting) setSorting(parsed.sorting);
        if (parsed.pagination) setPagination(parsed.pagination);
      } catch (e) {
        console.error('필터 복원 실패:', e);
      }
    }
  }, []);

  // 필터 저장
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isActiveFilter,
        searchQuery,
        sorting,
        pagination,
      })
    );
  }, [isActiveFilter, searchQuery, sorting, pagination]);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // API 파라미터 구성
  const apiParams = useMemo(() => {
    const params: any = {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    };

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    if (isActiveFilter !== 'all') {
      params.is_active = isActiveFilter === 'active';
    }

    return params;
  }, [debouncedSearch, isActiveFilter, pagination]);

  // 데이터 조회
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['packages', apiParams],
    queryFn: () => getPackages(apiParams),
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: deletePackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    },
  });

  const handleDelete = useCallback(
    async (packageId: string, packageName: string) => {
      if (!confirm(`패키지 "${packageName}"을(를) 삭제하시겠습니까?`)) {
        return;
      }

      try {
        await deleteMutation.mutateAsync(packageId);
        alert('패키지가 삭제되었습니다');
      } catch (error: any) {
        alert(error.message || '패키지 삭제에 실패했습니다');
      }
    },
    [deleteMutation]
  );

  // 컬럼 정의
  const columns = useMemo<ColumnDef<PackageListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: '패키지명',
        cell: ({ row }) => (
          <Link
            href={`/admin/packages/${row.original.id}`}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'base_price',
        header: '기본 가격',
        cell: ({ row }) => {
          const price = row.original.base_price;
          return `${price.toLocaleString()}원`;
        },
      },
      {
        accessorKey: 'included_items',
        header: '포함 섹션',
        cell: ({ row }) => {
          try {
            const items = row.original.included_items;
            if (!items || typeof items !== 'object') return '-';
            
            // included_items 구조: { sections: [{ name: "...", items: [...] }] }
            const sections = items.sections;
            if (!sections || !Array.isArray(sections)) return '-';
            
            // 섹션 이름만 추출
            const sectionNames = sections
              .map((s: any) => {
                if (typeof s === 'string') return s;
                if (s && typeof s === 'object' && s.name) return String(s.name);
                return null;
              })
              .filter((name): name is string => Boolean(name));
            
            return sectionNames.length > 0 ? sectionNames.join(', ') : '-';
          } catch (error) {
            console.error('포함 섹션 렌더링 오류:', error);
            return '-';
          }
        },
      },
      {
        accessorKey: 'is_active',
        header: '상태',
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              row.original.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {row.original.is_active ? '활성' : '비활성'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: '생성일',
        cell: ({ row }) => {
          const date = row.original.created_at;
          return date ? format(new Date(date), 'yyyy-MM-dd') : '-';
        },
      },
      {
        id: 'actions',
        header: '액션',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Link
              href={`/admin/packages/${row.original.id}`}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              상세/수정
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original.id, row.original.name);
              }}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              삭제
            </button>
          </div>
        ),
      },
    ],
    [handleDelete]
  );

  const table = useReactTable({
    data: data?.items || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination,
    },
    manualPagination: true,
    pageCount: data?.total_pages ?? 0,
  });

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">오류가 발생했습니다: {(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">패키지 관리</h1>
        <Link
          href="/admin/packages/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          패키지 생성
        </Link>
      </div>

      {/* 필터 및 검색 */}
      <div className="mb-4 flex gap-4 items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="패키지명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={isActiveFilter}
          onChange={(e) => setIsActiveFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">전체</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
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
                      <div className="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : header.column.columnDef.header}
                        {header.column.getCanSort() && (
                          <span className="text-gray-400">
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
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                    패키지가 없습니다
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/packages/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const value = cell.renderValue();
                      // 객체나 배열인 경우 문자열로 변환
                      let displayValue: React.ReactNode = value;
                      if (value && typeof value === 'object' && !React.isValidElement(value)) {
                        displayValue = JSON.stringify(value);
                      }
                      return (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                총 <span className="font-medium">{data?.total ?? 0}</span>개 중{' '}
                <span className="font-medium">
                  {data?.items.length ? pagination.pageIndex * pagination.pageSize + 1 : 0}
                </span>
                -{' '}
                <span className="font-medium">
                  {Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    data?.total ?? 0
                  )}
                </span>
                개 표시
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  처음
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  {pagination.pageIndex + 1} / {data?.total_pages ?? 1}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
                <button
                  onClick={() => table.setPageIndex((data?.total_pages ?? 1) - 1)}
                  disabled={!table.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

