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
  getPricePolicies, 
  PricePolicyListItem, 
  deletePricePolicy,
  createPricePolicy,
  updatePricePolicy,
  getPricePolicyDetail,
  PricePolicyListParams,
  PricePolicyCreateRequest,
  PricePolicyUpdateRequest,
  PricePolicyDetail
} from '@/lib/api/admin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  VEHICLE_CLASS_ORDER,
  ORIGIN_ORDER,
  getOriginName,
  getVehicleClassName,
  getOriginColors,
  getVehicleClassColors,
} from '@/lib/constants/vehicle';

const STORAGE_KEY = 'admin_prices_filters';

export default function PricesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [vehicleClassFilter, setVehicleClassFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'origin', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [modalFormData, setModalFormData] = useState<PricePolicyCreateRequest>({
    origin: 'domestic',
    vehicle_class: 'mid',
    add_amount: 0,
  });
  const [editFormData, setEditFormData] = useState<PricePolicyUpdateRequest>({
    add_amount: 0,
  });

  // 로컬 스토리지에서 필터 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOriginFilter(parsed.originFilter || 'all');
        setVehicleClassFilter(parsed.vehicleClassFilter || 'all');
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
        originFilter,
        vehicleClassFilter,
        sorting,
        pagination,
      })
    );
  }, [originFilter, vehicleClassFilter, sorting, pagination]);

  // API 파라미터 구성
  const apiParams = useMemo(() => {
    const params: PricePolicyListParams = {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    };

    if (originFilter !== 'all') {
      params.origin = originFilter;
    }

    if (vehicleClassFilter !== 'all') {
      params.vehicle_class = vehicleClassFilter;
    }

    return params;
  }, [originFilter, vehicleClassFilter, pagination]);

  // 데이터 조회
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pricePolicies', apiParams],
    queryFn: () => getPricePolicies(apiParams),
    keepPreviousData: true,
  });

  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: deletePricePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricePolicies'] });
    },
  });

  // 생성 뮤테이션
  const createMutation = useMutation({
    mutationFn: (data: PricePolicyCreateRequest) => createPricePolicy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricePolicies'] });
      setIsModalOpen(false);
      setModalFormData({
        origin: 'domestic',
        vehicle_class: 'mid',
        add_amount: 0,
      });
      alert('가격 정책이 생성되었습니다');
    },
    onError: (error: any) => {
      alert(error.message || '가격 정책 생성에 실패했습니다');
    },
  });

  // 수정을 위한 가격 정책 상세 조회
  const { data: editingPolicy } = useQuery({
    queryKey: ['pricePolicy', editingPolicyId],
    queryFn: () => getPricePolicyDetail(editingPolicyId!),
    enabled: !!editingPolicyId && isEditModalOpen,
  });

  // 수정 폼 초기화
  useEffect(() => {
    if (editingPolicy && isEditModalOpen) {
      setEditFormData({
        add_amount: editingPolicy.add_amount,
      });
    }
  }, [editingPolicy, isEditModalOpen]);

  // 수정 뮤테이션
  const updateMutation = useMutation({
    mutationFn: (data: PricePolicyUpdateRequest) => updatePricePolicy(editingPolicyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricePolicies'] });
      queryClient.invalidateQueries({ queryKey: ['pricePolicy', editingPolicyId] });
      setIsEditModalOpen(false);
      setEditingPolicyId(null);
      alert('가격 정책이 수정되었습니다');
    },
    onError: (error: any) => {
      alert(error.message || '가격 정책 수정에 실패했습니다');
    },
  });

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (modalFormData.add_amount < 0) {
      alert('추가 금액은 0 이상이어야 합니다');
      return;
    }

    createMutation.mutate(modalFormData);
  };

  const handleEditModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editFormData.add_amount !== undefined && editFormData.add_amount < 0) {
      alert('추가 금액은 0 이상이어야 합니다');
      return;
    }

    if (!editingPolicyId) return;
    updateMutation.mutate(editFormData);
  };

  const handleEditClick = (policyId: string) => {
    setEditingPolicyId(policyId);
    setIsEditModalOpen(true);
  };

  // 테이블 컬럼 정의
  const columns = useMemo<ColumnDef<PricePolicyListItem>[]>(
    () => [
      {
        accessorKey: 'origin',
        header: '구분',
        cell: ({ getValue }) => {
          const origin = getValue() as string;
          const colors = getOriginColors(origin);
          return (
            <span className={`px-3 py-1.5 rounded text-sm font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
              {getOriginName(origin)}
            </span>
          );
        },
      },
      {
        accessorKey: 'vehicle_class',
        header: '차량 등급',
        cell: ({ getValue }) => {
          const vehicleClass = getValue() as string;
          const colors = getVehicleClassColors(vehicleClass);
          return (
            <span className={`px-3 py-1.5 rounded text-sm font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
              {getVehicleClassName(vehicleClass)}
            </span>
          );
        },
      },
      {
        accessorKey: 'add_amount',
        header: '추가 금액',
        cell: ({ getValue }) => {
          const amount = getValue() as number;
          return (
            <span className="font-bold text-gray-900 text-base">
              {amount.toLocaleString()}원
            </span>
          );
        },
      },
      {
        accessorKey: 'updated_at',
        header: '수정일',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return (
            <span className="text-gray-700 text-sm">
              {format(new Date(date), 'yyyy-MM-dd HH:mm')}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '작업',
        cell: ({ row }) => {
          const policy = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEditClick(policy.id)}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                수정
              </button>
              <button
                onClick={() => {
                  if (confirm('정말 삭제하시겠습니까?')) {
                    deleteMutation.mutate(policy.id);
                  }
                }}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                disabled={deleteMutation.isLoading}
              >
                삭제
              </button>
            </div>
          );
        },
      },
    ],
    [deleteMutation]
  );

  // 테이블 인스턴스
  const table = useReactTable({
    data: data?.items || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: data?.total_pages || 0,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            가격 정책 목록을 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : '알 수 없는 오류'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">가격 정책 관리</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium"
        >
          새 가격 정책 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              국산/수입
            </label>
            <select
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-base bg-white"
            >
              <option value="all">전체</option>
              <option value="domestic">국산</option>
              <option value="imported">수입</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              차량 등급
            </label>
            <select
              value={vehicleClassFilter}
              onChange={(e) => {
                setVehicleClassFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-base bg-white"
            >
              <option value="all">전체</option>
              {VEHICLE_CLASS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {getVehicleClassName(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : header.column.getCanSort() ? (
                            <>
                              {{
                                asc: '↑',
                                desc: '↓',
                              }[header.column.getIsSorted() as string] ?? '⇅'}
                            </>
                          ) : null}
                        {header.column.columnDef.header}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <p className="text-gray-600 font-medium text-base">가격 정책이 없습니다.</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-gray-900">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {data && data.total_pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              총 {data.total}개 중 {pagination.pageIndex * pagination.pageSize + 1}-
              {Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.total)}개 표시
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                이전
              </button>
              <span className="text-sm text-gray-700">
                {pagination.pageIndex + 1} / {data.total_pages}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">새 가격 정책 추가</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="space-y-4">
                {/* 국산/수입 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    국산/수입 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalFormData.origin}
                    onChange={(e) => setModalFormData({ ...modalFormData, origin: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-base bg-white"
                    required
                  >
                    <option value="domestic">국산</option>
                    <option value="imported">수입</option>
                  </select>
                </div>

                {/* 차량 등급 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    차량 등급 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalFormData.vehicle_class}
                    onChange={(e) => setModalFormData({ ...modalFormData, vehicle_class: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-base bg-white"
                    required
                  >
                    {VEHICLE_CLASS_ORDER.map((value) => (
                      <option key={value} value={value}>
                        {getVehicleClassName(value)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 추가 금액 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    추가 금액 (원) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={modalFormData.add_amount}
                    onChange={(e) => setModalFormData({ ...modalFormData, add_amount: parseInt(e.target.value) || 0 })}
                    min="0"
                    step="1000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-base bg-white"
                    placeholder="0"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    기본 패키지 가격에 추가되는 할증 금액입니다.
                  </p>
                </div>

                {/* 미리보기 */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">미리보기</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">구분:</span>{' '}
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${getOriginColors(modalFormData.origin).bg} text-gray-900 border ${getOriginColors(modalFormData.origin).border}`}>
                        {getOriginName(modalFormData.origin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">차량 등급:</span>{' '}
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${getVehicleClassColors(modalFormData.vehicle_class).bg} text-gray-900 border ${getVehicleClassColors(modalFormData.vehicle_class).border}`}>
                        {getVehicleClassName(modalFormData.vehicle_class)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">추가 금액:</span>{' '}
                      <span className="font-bold text-gray-900">
                        {modalFormData.add_amount.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-medium"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {createMutation.isLoading ? '생성 중...' : '생성'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {isEditModalOpen && editingPolicy && (
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => {
            setIsEditModalOpen(false);
            setEditingPolicyId(null);
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">가격 정책 수정</h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPolicyId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditModalSubmit}>
              <div className="space-y-4">
                {/* 기본 정보 (읽기 전용) */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">기본 정보</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">국산/수입</label>
                      <div className="px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-md">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${getOriginColors(editingPolicy.origin).bg} text-gray-900 border ${getOriginColors(editingPolicy.origin).border}`}>
                          {getOriginName(editingPolicy.origin)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">차량 등급</label>
                      <div className="px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-md">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${getVehicleClassColors(editingPolicy.vehicle_class).bg} text-gray-900 border ${getVehicleClassColors(editingPolicy.vehicle_class).border}`}>
                          {getVehicleClassName(editingPolicy.vehicle_class)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 추가 금액 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    추가 금액 (원) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editFormData.add_amount ?? 0}
                    onChange={(e) => setEditFormData({ ...editFormData, add_amount: parseInt(e.target.value) || 0 })}
                    min="0"
                    step="1000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-base bg-white"
                    placeholder="0"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    기본 패키지 가격에 추가되는 할증 금액입니다.
                  </p>
                </div>

                {/* 미리보기 */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">미리보기</h4>
                  <div className="space-y-2.5 text-sm">
                    <div>
                      <span className="text-gray-700 font-medium">구분:</span>{' '}
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${getOriginColors(editingPolicy.origin).bg} text-gray-900 border ${getOriginColors(editingPolicy.origin).border}`}>
                        {getOriginName(editingPolicy.origin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 font-medium">차량 등급:</span>{' '}
                      <span className={`px-2 py-1 rounded text-sm font-semibold ${getVehicleClassColors(editingPolicy.vehicle_class).bg} text-gray-900 border ${getVehicleClassColors(editingPolicy.vehicle_class).border}`}>
                        {getVehicleClassName(editingPolicy.vehicle_class)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 font-medium">추가 금액:</span>{' '}
                      <span className="font-bold text-gray-900 text-base">
                        {(editFormData.add_amount ?? 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingPolicyId(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-medium"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {updateMutation.isLoading ? '수정 중...' : '수정'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

