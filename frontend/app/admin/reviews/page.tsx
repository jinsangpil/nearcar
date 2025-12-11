'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    ColumnDef,
    SortingState,
    PaginationState,
} from '@tanstack/react-table';
import { getReviews, updateReviewVisibility, ReviewListItem } from '@/lib/api/admin';
import { format } from 'date-fns';
import Image from 'next/image';

export default function ReviewsPage() {
    const queryClient = useQueryClient();
    const [ratingFilter, setRatingFilter] = useState<string>('all');
    const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
    const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });

    const { data, isLoading, error } = useQuery({
        queryKey: [
            'reviews',
            ratingFilter === 'all' ? undefined : parseInt(ratingFilter),
            visibilityFilter === 'all' ? undefined : visibilityFilter === 'hidden',
            pagination.pageIndex + 1,
            pagination.pageSize,
        ],
        queryFn: () =>
            getReviews({
                rating: ratingFilter === 'all' ? undefined : parseInt(ratingFilter),
                is_hidden: visibilityFilter === 'all' ? undefined : visibilityFilter === 'hidden',
                page: pagination.pageIndex + 1,
                limit: pagination.pageSize,
            }),
    });

    const toggleVisibilityMutation = useMutation({
        mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
            updateReviewVisibility(id, isHidden),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
        },
    });

    const columns = useMemo<ColumnDef<ReviewListItem>[]>(
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
                header: '작성자',
                accessorKey: 'user_name',
                cell: ({ row }) => row.original.user_name || '알 수 없음',
            },
            {
                accessorKey: 'rating',
                header: '별점',
                cell: ({ row }) => (
                    <div className="flex text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                            <span key={i}>{i < row.original.rating ? '★' : '☆'}</span>
                        ))}
                    </div>
                ),
            },
            {
                accessorKey: 'content',
                header: '내용',
                cell: ({ row }) => (
                    <div className="max-w-md truncate" title={row.original.content || ''}>
                        {row.original.content || '-'}
                    </div>
                ),
            },
            {
                header: '사진',
                cell: ({ row }) =>
                    row.original.photos && row.original.photos.length > 0 ? (
                        <div className="flex -space-x-2 overflow-hidden">
                            {row.original.photos.slice(0, 3).map((photo, index) => (
                                <div key={index} className="relative w-8 h-8 rounded-full border-2 border-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photo} alt="Review" className="w-full h-full object-cover" />
                                </div>
                            ))}
                            {row.original.photos.length > 3 && (
                                <div className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-medium">
                                    +{row.original.photos.length - 3}
                                </div>
                            )}
                        </div>
                    ) : (
                        '-'
                    ),
            },
            {
                accessorKey: 'is_hidden',
                header: '상태',
                cell: ({ row }) => (
                    <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${row.original.is_hidden ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}
                    >
                        {row.original.is_hidden ? '숨김' : '공개'}
                    </span>
                ),
            },
            {
                accessorKey: 'created_at',
                header: '작성일',
                cell: ({ row }) => format(new Date(row.original.created_at), 'yyyy-MM-dd'),
            },
            {
                id: 'actions',
                header: '관리',
                cell: ({ row }) => (
                    <button
                        onClick={() =>
                            toggleVisibilityMutation.mutate({
                                id: row.original.id,
                                isHidden: !row.original.is_hidden,
                            })
                        }
                        disabled={toggleVisibilityMutation.isPending}
                        className={`text-sm font-medium ${row.original.is_hidden ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'
                            }`}
                    >
                        {row.original.is_hidden ? '공개 처리' : '숨김 처리'}
                    </button>
                ),
            },
        ],
        [toggleVisibilityMutation]
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">리뷰 관리</h1>
                    <p className="mt-1 text-sm text-gray-500">사용자 리뷰를 조회하고 관리하세요</p>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">별점</label>
                    <select
                        value={ratingFilter}
                        onChange={(e) => {
                            setRatingFilter(e.target.value);
                            setPagination({ ...pagination, pageIndex: 0 });
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
                    >
                        <option value="all">전체</option>
                        <option value="5">5점</option>
                        <option value="4">4점</option>
                        <option value="3">3점</option>
                        <option value="2">2점</option>
                        <option value="1">1점</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">상태</label>
                    <select
                        value={visibilityFilter}
                        onChange={(e) => {
                            setVisibilityFilter(e.target.value);
                            setPagination({ ...pagination, pageIndex: 0 });
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
                    >
                        <option value="all">전체</option>
                        <option value="visible">공개</option>
                        <option value="hidden">숨김</option>
                    </select>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : typeof header.column.columnDef.header === 'string'
                                                ? header.column.columnDef.header
                                                : header.column.columnDef.header
                                                    ? header.column.columnDef.header({ column: header.column, header, table })
                                                    : null}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-gray-500">
                                    로딩 중...
                                </td>
                            </tr>
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-gray-500">
                                    리뷰가 없습니다.
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

                {/* 페이지네이션 (간소화) */}
                {!isLoading && data && (
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
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                <button
                                    onClick={() => table.previousPage()}
                                    disabled={!table.getCanPreviousPage()}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    이전
                                </button>
                                <button
                                    onClick={() => table.nextPage()}
                                    disabled={!table.getCanNextPage()}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    다음
                                </button>
                            </nav>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
