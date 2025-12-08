'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { getUsers, UserListItem, deleteUser } from '@/lib/api/admin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'admin_users_filters';

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

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);

  // 디바운스된 검색어
  const debouncedSearch = useDebounce(searchQuery, 300);

  // 로컬 스토리지에서 필터/정렬 설정 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRoleFilter(parsed.roleFilter || 'all');
        setStatusFilter(parsed.statusFilter || 'all');
        setLevelFilter(parsed.levelFilter || 'all');
        setSearchQuery(parsed.searchQuery || '');
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
        roleFilter,
        statusFilter,
        levelFilter,
        searchQuery,
        sorting,
        pagination,
      })
    );
  }, [roleFilter, statusFilter, levelFilter, searchQuery, sorting, pagination]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'users',
      roleFilter === 'all' ? undefined : roleFilter,
      statusFilter === 'all' ? undefined : statusFilter,
      levelFilter === 'all' ? undefined : parseInt(levelFilter),
      debouncedSearch || undefined,
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: () =>
      getUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        level: levelFilter === 'all' ? undefined : parseInt(levelFilter),
        search: debouncedSearch || undefined,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      }),
    refetchInterval: 30000, // 30초마다 폴링
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteModalOpen(null);
    },
  });

  const handleDelete = useCallback((userId: string) => {
    deleteMutation.mutate(userId);
  }, [deleteMutation]);

  const columns = useMemo<ColumnDef<UserListItem>[]>(
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
        accessorKey: 'name',
        header: '이름',
      },
      {
        accessorKey: 'email',
        header: '이메일',
        cell: ({ row }) => row.original.email || '-',
      },
      {
        accessorKey: 'phone',
        header: '전화번호',
      },
      {
        accessorKey: 'role',
        header: '역할',
        cell: ({ row }) => {
          const roleMap: Record<string, string> = {
            client: '고객',
            inspector: '기사',
            staff: '직원',
            admin: '관리자',
          };
          return roleMap[row.original.role] || row.original.role;
        },
      },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ row }) => {
          const status = row.original.status;
          const statusMap: Record<string, { label: string; color: string }> = {
            active: { label: '활성', color: 'bg-green-100 text-green-800' },
            inactive: { label: '비활성', color: 'bg-gray-100 text-gray-800' },
            suspended: { label: '정지', color: 'bg-red-100 text-red-800' },
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
        accessorKey: 'level',
        header: '등급',
        cell: ({ row }) => {
          if (row.original.role === 'inspector' && row.original.level) {
            return `${row.original.level}등급`;
          }
          return '-';
        },
      },
      {
        accessorKey: 'created_at',
        header: '가입일',
        cell: ({ row }) => {
          if (row.original.created_at) {
            try {
              return format(new Date(row.original.created_at), 'yyyy-MM-dd');
            } catch {
              return row.original.created_at;
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
                href={`/admin/users/${row.original.id}`}
                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
              >
                상세
              </Link>
              <Link
                href={`/admin/users/${row.original.id}/edit`}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                수정
              </Link>
              <button
                onClick={() => setDeleteModalOpen(row.original.id)}
                className="text-red-600 hover:text-red-900 text-sm font-medium"
              >
                삭제
              </button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">유저 관리</h1>
          <p className="mt-1 text-sm text-gray-500">사용자 목록을 확인하고 관리하세요</p>
        </div>
        <Link
          href="/admin/users/new"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          유저 추가
        </Link>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white shadow rounded-lg p-4">
        {/* 역할별 필터 탭 */}
        <div className="mb-4">
          <div className="flex space-x-2 border-b border-gray-200">
            {[
              { value: 'all', label: '전체' },
              { value: 'client', label: '고객' },
              { value: 'inspector', label: '기사' },
              { value: 'staff', label: '직원' },
              { value: 'admin', label: '관리자' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setRoleFilter(tab.value);
                  setPagination({ ...pagination, pageIndex: 0 });
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  roleFilter === tab.value
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 및 추가 필터 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              검색
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              placeholder="이름, 이메일, 전화번호"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

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
              <option value="all">전체</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="suspended">정지</option>
            </select>
          </div>

          <div>
            <label htmlFor="level" className="block text-sm font-medium text-gray-700">
              등급 (기사)
            </label>
            <select
              id="level"
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setPagination({ ...pagination, pageIndex: 0 });
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">전체</option>
              <option value="1">1등급</option>
              <option value="2">2등급</option>
              <option value="3">3등급</option>
              <option value="4">4등급</option>
              <option value="5">5등급</option>
            </select>
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-gray-500">
                  유저가 없습니다.
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

      {/* 삭제 확인 모달 */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">유저 삭제 확인</h3>
            <p className="text-sm text-gray-500 mb-6">
              정말로 이 유저를 삭제하시겠습니까? 삭제된 유저는 복구는 불가능합니다.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModalOpen(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteModalOpen)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

