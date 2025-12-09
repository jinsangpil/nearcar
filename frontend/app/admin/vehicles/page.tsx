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
  getManufacturers,
  getVehicleModels,
  ManufacturerListItem,
  VehicleModelListItem,
  deleteVehicleModel,
  VehicleModelListParams,
} from '@/lib/api/admin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'admin_vehicles_filters';

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

export default function VehiclesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [selectedModelGroup, setSelectedModelGroup] = useState<string>('');
  const [selectedModelDetail, setSelectedModelDetail] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'model_group', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // 로컬 스토리지에서 필터 상태 로드
  useEffect(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const {
        manufacturerId,
        origin,
        modelGroup,
        modelDetail,
        pageIndex,
        pageSize,
        sorting: savedSorting,
      } = JSON.parse(savedFilters);
      setSelectedManufacturerId(manufacturerId || '');
      setOriginFilter(origin || 'all');
      setSelectedModelGroup(modelGroup || '');
      setSelectedModelDetail(modelDetail || '');
      setPagination({ pageIndex: pageIndex || 0, pageSize: pageSize || 20 });
      setSorting(savedSorting || [{ id: 'model_group', desc: false }]);
    }
  }, []);

  // 필터 상태 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    const filtersToSave = {
      manufacturerId: selectedManufacturerId,
      origin: originFilter,
      modelGroup: selectedModelGroup,
      modelDetail: selectedModelDetail,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      sorting,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
  }, [selectedManufacturerId, originFilter, selectedModelGroup, selectedModelDetail, pagination, sorting]);

  // 국산/수입 필터 변경 시 제조사 및 모델 필터 초기화
  useEffect(() => {
    if (originFilter !== 'all') {
      setSelectedManufacturerId('');
      setSelectedModelGroup('');
      setSelectedModelDetail('');
    }
  }, [originFilter]);

  // 제조사 선택 변경 시 모델 필터 초기화
  useEffect(() => {
    if (selectedManufacturerId) {
      setSelectedModelGroup('');
      setSelectedModelDetail('');
    }
  }, [selectedManufacturerId]);

  // 모델 그룹 선택 변경 시 세부 모델 필터 초기화
  useEffect(() => {
    if (selectedModelGroup) {
      setSelectedModelDetail('');
    }
  }, [selectedModelGroup]);

  // 제조사 목록 조회 (국산/수입 필터가 선택된 경우에만 조회)
  const { 
    data: manufacturersData, 
    isLoading: isLoadingManufacturers,
    error: manufacturersError 
  } = useQuery({
    queryKey: ['manufacturers', { origin: originFilter === 'all' ? undefined : originFilter }],
    queryFn: () => getManufacturers({ origin: originFilter === 'all' ? undefined : originFilter }),
    enabled: originFilter !== 'all', // 국산/수입이 선택된 경우에만 제조사 목록 조회
  });

  // 선택된 제조사의 모델 그룹 목록 조회 (필터 옵션용)
  const { data: vehicleModelsData } = useQuery({
    queryKey: ['vehicle-models', { manufacturer_id: selectedManufacturerId, origin: originFilter, forFilter: true }],
    queryFn: async () => {
      // 페이지네이션을 사용하여 모든 데이터 가져오기
      let allItems: VehicleModelListItem[] = [];
      let page = 1;
      const limit = 100; // API 최대값
      let hasMore = true;

      while (hasMore) {
        const response = await getVehicleModels({ 
          manufacturer_id: selectedManufacturerId || undefined,
          origin: originFilter === 'all' ? undefined : originFilter,
          page,
          limit
        });
        
        allItems = [...allItems, ...response.items];
        
        if (response.items.length < limit || page >= response.total_pages) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return {
        items: allItems,
        total: allItems.length,
        page: 1,
        limit: allItems.length,
        total_pages: 1,
      };
    },
    enabled: !!selectedManufacturerId && originFilter !== 'all',
  });

  // 고유한 모델 그룹 목록 추출
  const uniqueModelGroups = useMemo(() => {
    if (!vehicleModelsData?.items) return [];
    const groups = new Set<string>();
    vehicleModelsData.items.forEach(item => {
      if (item.model_group) {
        groups.add(item.model_group);
      }
    });
    return Array.from(groups).sort();
  }, [vehicleModelsData]);

  // 선택된 모델 그룹의 세부 모델 목록 추출
  const uniqueModelDetails = useMemo(() => {
    if (!vehicleModelsData?.items || !selectedModelGroup) return [];
    const details = new Set<string>();
    vehicleModelsData.items
      .filter(item => item.model_group === selectedModelGroup && item.model_detail)
      .forEach(item => {
        if (item.model_detail) {
          details.add(item.model_detail);
        }
      });
    return Array.from(details).sort();
  }, [vehicleModelsData, selectedModelGroup]);

  // 차량 모델 목록 조회
  const apiParams = useMemo<VehicleModelListParams>(
    () => ({
      manufacturer_id: selectedManufacturerId || undefined,
      origin: originFilter === 'all' ? undefined : originFilter,
      model_group: selectedModelGroup || undefined,
      model_detail: selectedModelDetail || undefined,
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    }),
    [selectedManufacturerId, originFilter, selectedModelGroup, selectedModelDetail, pagination]
  );

  // 차량 모델 조회 조건: 국산/수입이 선택되어야 조회
  const shouldFetchVehicleModels = originFilter !== 'all';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vehicle-models', apiParams],
    queryFn: () => getVehicleModels(apiParams),
    enabled: shouldFetchVehicleModels, // 필터가 하나라도 선택된 경우 조회
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: deleteVehicleModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-models'] });
    },
  });

  const handleDelete = useCallback(
    async (modelId: string, modelName: string) => {
      if (!confirm(`차량 모델 "${modelName}"을(를) 삭제하시겠습니까?`)) {
        return;
      }

      try {
        await deleteMutation.mutateAsync(modelId);
        alert('차량 모델이 삭제되었습니다');
      } catch (error: any) {
        alert(error.message || '차량 모델 삭제에 실패했습니다');
      }
    },
    [deleteMutation]
  );

  // 컬럼 정의
  const columns = useMemo<ColumnDef<VehicleModelListItem>[]>(
    () => [
      {
        accessorKey: 'manufacturer_name',
        header: '제조사',
      },
      {
        accessorKey: 'model_group',
        header: '모델 그룹',
        cell: ({ row }) => (
          <Link
            href={`/admin/vehicles/models/${row.original.id}`}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {row.original.model_group}
          </Link>
        ),
      },
      {
        accessorKey: 'model_detail',
        header: '모델 상세',
        cell: ({ row }) => row.original.model_detail || '-',
      },
      {
        accessorKey: 'vehicle_class',
        header: '차량 등급',
      },
      {
        accessorKey: 'start_year',
        header: '출시 연도',
        cell: ({ row }) =>
          `${row.original.start_year}${row.original.end_year ? ` - ${row.original.end_year}` : ''}`,
      },
      {
        accessorKey: 'is_active',
        header: '상태',
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              row.original.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
              href={`/admin/vehicles/models/${row.original.id}`}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
              onClick={(e) => e.stopPropagation()}
            >
              상세/수정
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original.id, `${row.original.model_group} ${row.original.model_detail || ''}`);
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


  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">차량 관리</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/vehicles/manufacturers/new"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            제조사 추가
          </Link>
          <Link
            href="/admin/vehicles/models/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            차량 모델 추가
          </Link>
        </div>
      </div>

      {/* 필터 (국산/수입 → 제조사 → 모델 → 세부모델 순서) */}
      <div className="mb-4 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              국산/수입 <span className="text-red-500">*</span>
            </label>
            <select
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value);
                setSelectedManufacturerId('');
                setSelectedModelGroup('');
                setSelectedModelDetail('');
                setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">전체</option>
              <option value="domestic">국산</option>
              <option value="imported">수입</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">제조사 선택</label>
            <select
              value={selectedManufacturerId}
              onChange={(e) => {
                setSelectedManufacturerId(e.target.value);
                setSelectedModelGroup('');
                setSelectedModelDetail('');
                setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
              }}
              disabled={originFilter === 'all' || isLoadingManufacturers}
              className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                originFilter === 'all' || isLoadingManufacturers
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-900'
              }`}
            >
              <option value="">
                {originFilter === 'all' 
                  ? '국산/수입을 먼저 선택하세요' 
                  : isLoadingManufacturers 
                    ? '제조사 목록 로딩 중...' 
                    : manufacturersError 
                      ? '제조사 목록을 불러올 수 없습니다'
                      : '제조사를 선택하세요'}
              </option>
              {manufacturersData?.items.map((mfr) => (
                <option key={mfr.id} value={mfr.id}>
                  {mfr.name}
                </option>
              ))}
            </select>
            {manufacturersError && (
              <p className="mt-1 text-sm text-red-600">
                제조사 목록을 불러오는 중 오류가 발생했습니다: {(manufacturersError as Error).message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">모델</label>
            <select
              value={selectedModelGroup}
              onChange={(e) => {
                setSelectedModelGroup(e.target.value);
                setSelectedModelDetail('');
                setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
              }}
              disabled={!selectedManufacturerId || uniqueModelGroups.length === 0}
              className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                !selectedManufacturerId || uniqueModelGroups.length === 0
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-900'
              }`}
            >
              <option value="">
                {!selectedManufacturerId
                  ? '제조사를 먼저 선택하세요'
                  : uniqueModelGroups.length === 0
                    ? '모델 그룹 없음'
                    : '모델을 선택하세요'}
              </option>
              {uniqueModelGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">세부모델</label>
            <select
              value={selectedModelDetail}
              onChange={(e) => {
                setSelectedModelDetail(e.target.value);
                setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
              }}
              disabled={!selectedModelGroup || uniqueModelDetails.length === 0}
              className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                !selectedModelGroup || uniqueModelDetails.length === 0
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-gray-900'
              }`}
            >
              <option value="">
                {!selectedModelGroup
                  ? '모델을 먼저 선택하세요'
                  : uniqueModelDetails.length === 0
                    ? '세부 모델 없음'
                    : '세부 모델을 선택하세요 (전체)'}
              </option>
              {uniqueModelDetails.map((detail) => (
                <option key={detail} value={detail}>
                  {detail}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 차량 모델 목록 */}
      {!shouldFetchVehicleModels ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500">
            국산/수입을 선택하면 차량 모델 목록이 표시됩니다.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">로딩 중...</div>
        </div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">
            차량 모델 목록을 불러오는 중 오류가 발생했습니다: {(error as Error).message}
            <button
              onClick={() => refetch()}
              className="ml-4 text-indigo-700 hover:text-indigo-900 font-medium"
            >
              새로고침
            </button>
          </div>
        </div>
      ) : (
        <>
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
                      차량 모델 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/admin/vehicles/models/${row.original.id}`)}
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
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
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
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 0 010 1.414l-4 4a1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

