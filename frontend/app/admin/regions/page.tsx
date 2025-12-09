'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  PaginationState,
  flexRender,
} from '@tanstack/react-table';
import { 
  getServiceRegions, 
  ServiceRegionListItem,
  ServiceRegionHierarchyItem,
  ServiceRegionListResponse,
  deleteServiceRegion,
  createServiceRegion,
  updateServiceRegion,
  getServiceRegionDetail,
  ServiceRegionListParams,
  ServiceRegionCreateRequest,
  ServiceRegionUpdateRequest,
  ServiceRegionDetail,
  bulkUpdateProvinceRegions,
  getProvinceStatus,
  ProvinceStatusResponse
} from '@/lib/api/admin';
import { getProvinces, getCitiesByProvince, ProvinceItem, CityItem } from '@/lib/api/public-data';
import { PROVINCE_LIST } from '@/lib/constants/regions';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'admin_regions_filters';

export default function RegionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'province', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [modalFormData, setModalFormData] = useState<ServiceRegionCreateRequest>({
    province: '',
    province_code: '',
    city: '',
    city_code: '',
    extra_fee: 0,
    is_active: true,
  });
  const [availableCities, setAvailableCities] = useState<CityItem[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [editAvailableCities, setEditAvailableCities] = useState<CityItem[]>([]);
  const [isLoadingEditCities, setIsLoadingEditCities] = useState(false);
  const [editFormData, setEditFormData] = useState<ServiceRegionUpdateRequest>({
    extra_fee: 0,
  });

  // 로컬 스토리지에서 필터 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProvinceFilter(parsed.provinceFilter || 'all');
        setIsActiveFilter(parsed.isActiveFilter ?? null);
        setSearchQuery(parsed.searchQuery || '');
        setViewMode(parsed.viewMode || 'table');
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
        provinceFilter,
        isActiveFilter,
        searchQuery,
        viewMode,
        sorting,
        pagination,
      })
    );
  }, [provinceFilter, isActiveFilter, searchQuery, viewMode, sorting, pagination]);

  // API 파라미터 구성
  const apiParams = useMemo(() => {
    const params: ServiceRegionListParams = {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      hierarchy: viewMode === 'hierarchy',
    };

    if (provinceFilter !== 'all') {
      params.province = provinceFilter;
    }

    if (isActiveFilter !== null) {
      params.is_active = isActiveFilter;
    }

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    return params;
  }, [provinceFilter, isActiveFilter, searchQuery, pagination, viewMode]);

  // 데이터 조회
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['serviceRegions', apiParams],
    queryFn: () => getServiceRegions(apiParams),
    keepPreviousData: true,
  });

  // 광역시도별 상태 조회
  const [provinceStatuses, setProvinceStatuses] = useState<Record<string, ProvinceStatusResponse>>({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  // 모든 광역시도 상태 조회
  useEffect(() => {
    const loadProvinceStatuses = async () => {
      setIsLoadingStatuses(true);
      try {
        const statuses: Record<string, ProvinceStatusResponse> = {};
        await Promise.all(
          PROVINCE_LIST.map(async (province) => {
            try {
              const status = await getProvinceStatus(province.code);
              statuses[province.code] = status;
            } catch (error) {
              console.error(`광역시도 ${province.code} 상태 조회 실패:`, error);
            }
          })
        );
        setProvinceStatuses(statuses);
      } catch (error) {
        console.error('광역시도 상태 조회 실패:', error);
      } finally {
        setIsLoadingStatuses(false);
      }
    };

    if (data) {
      loadProvinceStatuses();
    }
  }, [data]);

  // 광역시도 일괄 활성/비활성화
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ provinceCode, isActive }: { provinceCode: string; isActive: boolean }) =>
      bulkUpdateProvinceRegions(provinceCode, isActive),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['serviceRegions'] });
      // 상태도 다시 조회
      getProvinceStatus(variables.provinceCode).then((status) => {
        setProvinceStatuses((prev) => ({
          ...prev,
          [variables.provinceCode]: status,
        }));
      });
      alert(
        `${result.total_regions}개 지역이 ${variables.isActive ? '활성화' : '비활성화'}되었습니다.`
      );
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || error.message || '일괄 업데이트에 실패했습니다.');
    },
  });

  const handleProvinceToggle = (provinceCode: string) => {
    const status = provinceStatuses[provinceCode];
    if (!status) return;

    const newIsActive = !status.is_fully_active;
    if (
      confirm(
        `${PROVINCE_LIST.find((p) => p.code === provinceCode)?.name}의 모든 시군구를 ${
          newIsActive ? '활성화' : '비활성화'
        }하시겠습니까?`
      )
    ) {
      bulkUpdateMutation.mutate({ provinceCode, isActive: newIsActive });
    }
  };

  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: deleteServiceRegion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRegions'] });
      alert('서비스 지역이 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || error.message || '서비스 지역 삭제에 실패했습니다');
    },
  });

  // 생성 뮤테이션
  const createMutation = useMutation({
    mutationFn: (data: ServiceRegionCreateRequest) => createServiceRegion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRegions'] });
      setIsModalOpen(false);
      setModalFormData({
        province: '',
        city: '',
        extra_fee: 0,
        is_active: true,
      });
      alert('서비스 지역이 생성되었습니다');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || error.message || '서비스 지역 생성에 실패했습니다');
    },
  });

  // 수정을 위한 서비스 지역 상세 조회
  const { data: editingRegion } = useQuery({
    queryKey: ['serviceRegion', editingRegionId],
    queryFn: () => getServiceRegionDetail(editingRegionId!),
    enabled: !!editingRegionId && isEditModalOpen,
  });

  // 수정 뮤테이션
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceRegionUpdateRequest }) =>
      updateServiceRegion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRegions'] });
      setIsEditModalOpen(false);
      setEditingRegionId(null);
      alert('서비스 지역이 수정되었습니다');
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || error.message || '서비스 지역 수정에 실패했습니다');
    },
  });

  // 수정 모달 열기
  const handleEdit = (regionId: string) => {
    setEditingRegionId(regionId);
    setIsEditModalOpen(true);
  };

  // 수정 폼 데이터 업데이트
  useEffect(() => {
    if (editingRegion) {
      setEditFormData({
        province: editingRegion.province,
        province_code: editingRegion.province_code || undefined,
        city: editingRegion.city,
        city_code: editingRegion.city_code || undefined,
        extra_fee: editingRegion.extra_fee,
        is_active: editingRegion.is_active,
      });
      // 수정 시에도 city 목록 로드
      if (editingRegion.province_code) {
        loadEditCities(editingRegion.province_code);
      }
    }
  }, [editingRegion]);

  // 수정 모달용 city 목록 로드
  const loadEditCities = async (provinceCode: string) => {
    if (!provinceCode) {
      setEditAvailableCities([]);
      return;
    }
    
    setIsLoadingEditCities(true);
    try {
      const cities = await getCitiesByProvince(provinceCode);
      setEditAvailableCities(cities);
    } catch (error) {
      console.error('시군구 목록 로드 실패:', error);
      setEditAvailableCities([]);
    } finally {
      setIsLoadingEditCities(false);
    }
  };

  // 수정 모달용 province 선택 핸들러
  const handleEditProvinceChange = (provinceCode: string) => {
    const selectedProvince = PROVINCE_LIST.find(p => p.code === provinceCode);
    if (selectedProvince) {
      setEditFormData({
        ...editFormData,
        province: selectedProvince.name,
        province_code: selectedProvince.code,
        city: '',
        city_code: '',
      });
      loadEditCities(provinceCode);
    }
  };

  // 수정 모달용 city 선택 핸들러
  const handleEditCityChange = (cityCode: string) => {
    const selectedCity = editAvailableCities.find(c => c.code === cityCode);
    if (selectedCity) {
      setEditFormData({
        ...editFormData,
        city: selectedCity.name,
        city_code: selectedCity.code,
      });
    }
  };

  // province 선택 시 city 목록 로드
  const loadCities = async (provinceCode: string) => {
    if (!provinceCode) {
      setAvailableCities([]);
      return;
    }
    
    setIsLoadingCities(true);
    try {
      const cities = await getCitiesByProvince(provinceCode);
      setAvailableCities(cities);
    } catch (error) {
      console.error('시군구 목록 로드 실패:', error);
      setAvailableCities([]);
      alert('시군구 목록을 불러올 수 없습니다. 수동으로 입력해주세요.');
    } finally {
      setIsLoadingCities(false);
    }
  };

  // province 선택 핸들러
  const handleProvinceChange = (provinceCode: string) => {
    const selectedProvince = PROVINCE_LIST.find(p => p.code === provinceCode);
    if (selectedProvince) {
      setModalFormData({
        ...modalFormData,
        province: selectedProvince.name,
        province_code: selectedProvince.code,
        city: '',
        city_code: '',
      });
      loadCities(provinceCode);
    }
  };

  // city 선택 핸들러
  const handleCityChange = (cityCode: string) => {
    const selectedCity = availableCities.find(c => c.code === cityCode);
    if (selectedCity) {
      setModalFormData({
        ...modalFormData,
        city: selectedCity.name,
        city_code: selectedCity.code,
      });
    }
  };

  // 테이블 컬럼 정의
  const columns = useMemo<ColumnDef<ServiceRegionListItem>[]>(() => [
    {
      accessorKey: 'province',
      header: '상위 지역',
      cell: (info) => (
        <span className="text-gray-900 font-medium">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'city',
      header: '하위 지역',
      cell: (info) => (
        <span className="text-gray-900 font-medium">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'extra_fee',
      header: '추가 요금',
      cell: (info) => (
        <span className="text-gray-900 font-semibold">
          {new Intl.NumberFormat('ko-KR').format(info.getValue() as number)}원
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: '상태',
      cell: (info) => {
        const isActive = info.getValue() as boolean;
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isActive ? '활성' : '비활성'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '액션',
      cell: (info) => {
        const region = info.row.original;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(region.id)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              수정
            </button>
            <button
              onClick={() => {
                if (confirm('정말 삭제하시겠습니까?')) {
                  deleteMutation.mutate(region.id);
                }
              }}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              삭제
            </button>
          </div>
        );
      },
    },
  ], [deleteMutation]);

  // 테이블 데이터 준비
  const tableData = useMemo(() => {
    if (!data) return [];
    if (viewMode === 'hierarchy') {
      // 계층 구조 모드에서는 평면화
      const hierarchyData = data as ServiceRegionHierarchyItem[];
      return hierarchyData.flatMap(item => item.cities);
    }
    const listData = data as ServiceRegionListResponse;
    return listData.items || [];
  }, [data, viewMode]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: viewMode === 'table' && data && 'total_pages' in data ? (data as ServiceRegionListResponse).total_pages : 1,
  });

  // Province 목록은 고정 리스트 사용
  const provinces = useMemo(() => {
    return PROVINCE_LIST.map(p => p.name);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-600">오류가 발생했습니다: {(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">서비스 지역 관리</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          새 지역 추가
        </button>
      </div>

      {/* 광역시도 일괄 선택 버튼 그리드 */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">기본 서비스 가능 지역 선택</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {PROVINCE_LIST.map((province) => {
            const status = provinceStatuses[province.code];
            const isFullyActive = status?.is_fully_active || false;
            const isPartiallyActive = status?.is_partially_active || false;
            const isLoading = isLoadingStatuses || bulkUpdateMutation.isLoading;

            return (
              <button
                key={province.code}
                onClick={() => handleProvinceToggle(province.code)}
                disabled={isLoading}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${
                    isFullyActive
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : isPartiallyActive
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={
                  status
                    ? `활성: ${status.active_count}개 / 전체: ${status.total}개`
                    : '로딩 중...'
                }
              >
                {province.name}
                {isFullyActive && ' ✓'}
                {isPartiallyActive && ' ⚠'}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          버튼을 클릭하면 해당 광역시도의 모든 시군구가 활성화/비활성화됩니다. (녹색: 전체 활성, 노란색: 일부 활성, 회색: 비활성)
        </p>
      </div>

      {/* 필터 및 검색 */}
      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">상위 지역:</label>
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-gray-900 text-base bg-white"
          >
            <option value="all">전체</option>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">상태:</label>
          <select
            value={isActiveFilter === null ? 'all' : isActiveFilter ? 'active' : 'inactive'}
            onChange={(e) => {
              if (e.target.value === 'all') setIsActiveFilter(null);
              else setIsActiveFilter(e.target.value === 'active');
            }}
            className="border border-gray-300 rounded px-3 py-2 text-gray-900 text-base bg-white"
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">검색:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="상위/하위 지역 검색"
            className="border border-gray-300 rounded px-3 py-2 text-gray-900 text-base bg-white"
          />
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">보기 모드:</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'table' | 'hierarchy')}
            className="border border-gray-300 rounded px-3 py-2 text-gray-900 text-base bg-white"
          >
            <option value="table">테이블</option>
            <option value="hierarchy">계층 구조</option>
          </select>
        </div>
      </div>

      {/* 계층 구조 뷰 */}
      {viewMode === 'hierarchy' && data && Array.isArray(data) && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {(data as ServiceRegionHierarchyItem[]).map((item) => (
            <div key={item.province} className="border-b last:border-b-0">
              <div className="px-4 py-3 bg-gray-50 font-semibold text-gray-900">
                {item.province}
              </div>
              <div className="divide-y">
                {item.cities.map((city) => (
                  <div key={city.id} className="px-6 py-3 flex justify-between items-center">
                    <div className="flex-1">
                      <span className="text-gray-900 font-medium">{city.city}</span>
                      <span className="ml-4 text-gray-600">
                        {new Intl.NumberFormat('ko-KR').format(city.extra_fee)}원
                      </span>
                      <span
                        className={`ml-4 px-2 py-1 rounded-full text-xs font-medium ${
                          city.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {city.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(city.id)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까?')) {
                            deleteMutation.mutate(city.id);
                          }
                        }}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 테이블 뷰 */}
      {viewMode === 'table' && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {data && 'total_pages' in data && (data as ServiceRegionListResponse).total_pages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-700">
                총 {(data as ServiceRegionListResponse).total}건
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-1">
                  {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 생성 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">새 서비스 지역 추가</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상위 지역 (도/광역시) *
                </label>
                <select
                  value={modalFormData.province_code || ''}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                  required
                >
                  <option value="">선택하세요</option>
                  {PROVINCE_LIST.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  하위 지역 (시/구) *
                </label>
                {isLoadingCities ? (
                  <div className="w-full border border-gray-300 rounded px-3 py-2 text-gray-500">
                    로딩 중...
                  </div>
                ) : (
                  <select
                    value={modalFormData.city_code || ''}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                    required
                    disabled={!modalFormData.province_code || availableCities.length === 0}
                  >
                    <option value="">
                      {!modalFormData.province_code
                        ? '상위 지역을 먼저 선택하세요'
                        : availableCities.length === 0
                        ? '시군구 목록을 불러올 수 없습니다'
                        : '선택하세요'}
                    </option>
                    {availableCities.map((city) => (
                      <option key={city.code} value={city.code}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                )}
                {availableCities.length === 0 && modalFormData.province_code && !isLoadingCities && (
                  <p className="mt-1 text-sm text-gray-500">
                    시군구 목록을 불러올 수 없습니다. 수동으로 입력해주세요.
                  </p>
                )}
              </div>
              {availableCities.length === 0 && modalFormData.province_code && !isLoadingCities && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    하위 지역 수동 입력
                  </label>
                  <input
                    type="text"
                    value={modalFormData.city}
                    onChange={(e) =>
                      setModalFormData({ ...modalFormData, city: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                    placeholder="예: 강남구, 분당구"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  추가 요금 (원)
                </label>
                <input
                  type="number"
                  value={modalFormData.extra_fee}
                  onChange={(e) =>
                    setModalFormData({ ...modalFormData, extra_fee: parseInt(e.target.value) || 0 })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  min="0"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={modalFormData.is_active}
                    onChange={(e) =>
                      setModalFormData({ ...modalFormData, is_active: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">활성 상태</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!modalFormData.province || !modalFormData.city) {
                    alert('상위 지역과 하위 지역을 모두 선택해주세요');
                    return;
                  }
                  createMutation.mutate(modalFormData);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                disabled={createMutation.isLoading}
              >
                {createMutation.isLoading ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {isEditModalOpen && editingRegion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900">서비스 지역 수정</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상위 지역 (도/광역시)
                </label>
                <select
                  value={editFormData.province_code || ''}
                  onChange={(e) => handleEditProvinceChange(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                >
                  <option value="">선택하세요</option>
                  {PROVINCE_LIST.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  하위 지역 (시/구)
                </label>
                {isLoadingEditCities ? (
                  <div className="w-full border border-gray-300 rounded px-3 py-2 text-gray-500">
                    로딩 중...
                  </div>
                ) : (
                  <select
                    value={editFormData.city_code || ''}
                    onChange={(e) => handleEditCityChange(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                    disabled={!editFormData.province_code || editAvailableCities.length === 0}
                  >
                    <option value="">
                      {!editFormData.province_code
                        ? '상위 지역을 먼저 선택하세요'
                        : editAvailableCities.length === 0
                        ? '시군구 목록을 불러올 수 없습니다'
                        : '선택하세요'}
                    </option>
                    {editAvailableCities.map((city) => (
                      <option key={city.code} value={city.code}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                )}
                {editAvailableCities.length === 0 && editFormData.province_code && !isLoadingEditCities && (
                  <p className="mt-1 text-sm text-gray-500">
                    시군구 목록을 불러올 수 없습니다. 수동으로 입력해주세요.
                  </p>
                )}
              </div>
              {editAvailableCities.length === 0 && editFormData.province_code && !isLoadingEditCities && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    하위 지역 수동 입력
                  </label>
                  <input
                    type="text"
                    value={editFormData.city || ''}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, city: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                    placeholder="예: 강남구, 분당구"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  추가 요금 (원)
                </label>
                <input
                  type="number"
                  value={editFormData.extra_fee || 0}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, extra_fee: parseInt(e.target.value) || 0 })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  min="0"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active ?? true}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, is_active: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">활성 상태</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingRegionId(null);
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (editingRegionId) {
                    updateMutation.mutate({ id: editingRegionId, data: editFormData });
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                disabled={updateMutation.isLoading}
              >
                {updateMutation.isLoading ? '수정 중...' : '수정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

