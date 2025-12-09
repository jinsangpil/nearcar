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
import {
  getVehicleMasters,
  VehicleMasterListItem,
  deleteVehicleMaster,
  VehicleMasterListParams,
} from '@/lib/api/admin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'admin_vehicle_masters_filters';

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

export default function VehicleMastersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('');
  const [vehicleClassFilter, setVehicleClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'manufacturer', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // 로컬 스토리지에서 필터 상태 로드
  useEffect(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const {
        origin,
        manufacturer,
        vehicleClass,
        search,
        pageIndex,
        pageSize,
        sorting: savedSorting,
      } = JSON.parse(savedFilters);
      setOriginFilter(origin || 'all');
      setManufacturerFilter(manufacturer || '');
      setVehicleClassFilter(vehicleClass || 'all');
      setSearchQuery(search || '');
      setPagination({ pageIndex: pageIndex || 0, pageSize: pageSize || 20 });
      setSorting(savedSorting || [{ id: 'manufacturer', desc: false }]);
    }
  }, []);

  // 필터 상태 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    const filtersToSave = {
      origin: originFilter,
      manufacturer: manufacturerFilter,
      vehicleClass: vehicleClassFilter,
      search: searchQuery,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sorting,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
  }, [originFilter, manufacturerFilter, vehicleClassFilter, searchQuery, pagination, sorting]);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const apiParams = useMemo<VehicleMasterListParams>(
    () => ({
      origin: originFilter === 'all' ? undefined : originFilter,
      manufacturer: manufacturerFilter || undefined,
      vehicle_class: vehicleClassFilter === 'all' ? undefined : vehicleClassFilter,
      search: debouncedSearchQuery || undefined,
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    }),
    [originFilter, manufacturerFilter, vehicleClassFilter, debouncedSearchQuery, pagination]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vehicleMasters', apiParams],
    queryFn: () => getVehicleMasters(apiParams),
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: deleteVehicleMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleMasters'] });
    },
  });

  const handleDelete = useCallback(
    async (masterId: string, manufacturer: string, modelGroup: string) => {
      if (!confirm(`차량 마스터 "${manufacturer} ${modelGroup}"을(를) 삭제하시겠습니까?`)) {
        return;
      }

      try {
        await deleteMutation.mutateAsync(masterId);
        alert('차량 마스터가 삭제되었습니다');
      } catch (error: any) {
        alert(error.message || '차량 마스터 삭제에 실패했습니다');
      }
    },
    [deleteMutation]
  );

  // 컬럼 정의
  const columns = useMemo<ColumnDef<VehicleMasterListItem>[]>(
    () => [
      {
        accessorKey: 'manufacturer',
        header: '제조사',
        cell: ({ row }) => (
          <Link
            href={`/admin/vehicles/master/${row.original.id}`}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {row.original.manufacturer}
          </Link>
        ),
      },
      {
        accessorKey: 'model_group',
        header: '모델 그룹',
        cell: ({ row }) => row.original.model_group,
      },
      {
        accessorKey: 'model_detail',
        header: '모델 상세',
        cell: ({ row }) => row.original.model_detail || '-',
      },
      {
        accessorKey: 'origin',
        header: '국산/수입',
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              row.original.origin === 'domestic'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {row.original.origin === 'domestic' ? '국산' : '수입'}
          </span>
        ),
      },
      {
        accessorKey: 'vehicle_class',
        header: '차량 등급',
        cell: ({ row }) => {
          const classMap: Record<string, string> = {
            compact: '경차',
            small: '소형',
            mid: '중형',
            large: '대형',
            suv: 'SUV',
            sports: '스포츠카',
            supercar: '슈퍼카',
          };
          return classMap[row.original.vehicle_class] || row.original.vehicle_class;
        },
      },
      {
        accessorKey: 'start_year',
        header: '출시 연도',
        cell: ({ row }) => {
          const startYear = row.original.start_year;
          const endYear = row.original.end_year;
          return endYear ? `${startYear}~${endYear}` : `${startYear}~`;
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
        id: 'actions',
        header: '액션',
        cell: ({ row }) => (
          <div className="flex space-x-2">
            <Link
              href={`/admin/vehicles/master/${row.original.id}`}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
              onClick={(e) => e.stopPropagation()}
            >
              상세/수정
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original.id, row.original.manufacturer, row.original.model_group);
              }}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
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
    rowCount: data?.total || 0,
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
        <div className="text-sm text-red-800">
          차량 마스터 목록을 불러오는 중 오류가 발생했습니다: {(error as Error).message}
          <button
            onClick={() => refetch()}
            className="ml-4 text-indigo-700 hover:text-indigo-900 font-medium"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">차량 마스터 관리</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/vehicles/master/sync"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            동기화
          </Link>
          <Link
            href="/admin/vehicles/master/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            차량 마스터 생성
          </Link>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="제조사, 모델명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">전체</option>
          <option value="domestic">국산</option>
          <option value="imported">수입</option>
        </select>
        <input
          type="text"
          placeholder="제조사 필터"
          value={manufacturerFilter}
          onChange={(e) => setManufacturerFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={vehicleClassFilter}
          onChange={(e) => setVehicleClassFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">전체 등급</option>
          <option value="compact">경차</option>
          <option value="small">소형</option>
          <option value="mid">중형</option>
          <option value="large">대형</option>
          <option value="suv">SUV</option>
          <option value="sports">스포츠카</option>
          <option value="supercar">슈퍼카</option>
        </select>
      </div>

      {/* 차량 마스터 목록 테이블 */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : (
                          <div className="flex items-center">
                            {header.column.columnDef.header as React.ReactNode}
                            {{
                              asc: ' 🔼',
                              desc: ' 🔽',
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                  차량 마스터가 없습니다
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/admin/vehicles/master/${row.original.id}`)}
                >
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
      </div>

      {/* 페이지네이션 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            이전
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            다음
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              총 <span className="font-medium">{data?.total || 0}</span>개 결과 중{' '}
              <span className="font-medium">
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              </span>
              -
              <span className="font-medium">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  data?.total || 0
                )}
              </span>{' '}
              표시
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span className="sr-only">이전</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              {/* 페이지 번호 렌더링 */}
              {Array.from({ length: table.getPageCount() }, (_, i) => (
                <button
                  key={i}
                  onClick={() => table.setPageIndex(i)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    table.getState().pagination.pageIndex === i
                      ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span className="sr-only">다음</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

