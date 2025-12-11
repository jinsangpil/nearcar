'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    ColumnDef,
    SortingState,
} from '@tanstack/react-table';
import {
    getFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
    FAQListItem,
    FAQCreateRequest,
    FAQUpdateRequest,
} from '@/lib/api/admin';
import { format } from 'date-fns';

const FAQ_CATEGORIES = [
    { value: 'payment', label: '결제' },
    { value: 'refund', label: '환불' },
    { value: 'reservation', label: '예약' },
    { value: 'inspection', label: '검수' },
    { value: 'etc', label: '기타' },
];

export default function FAQsPage() {
    const queryClient = useQueryClient();
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sorting, setSorting] = useState<SortingState>([{ id: 'display_order', desc: false }]);

    // Modals state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingFAQ, setEditingFAQ] = useState<FAQListItem | null>(null);
    const [deletingFAQId, setDeletingFAQId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState<FAQCreateRequest>({
        category: 'payment',
        question: '',
        answer: '',
        is_active: true,
        display_order: 0,
    });

    const { data, isLoading } = useQuery({
        queryKey: ['faqs', categoryFilter === 'all' ? undefined : categoryFilter],
        queryFn: () => getFAQs({ category: categoryFilter === 'all' ? undefined : categoryFilter }),
    });

    const createMutation = useMutation({
        mutationFn: createFAQ,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['faqs'] });
            setIsCreateModalOpen(false);
            resetForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: FAQUpdateRequest }) => updateFAQ(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['faqs'] });
            setEditingFAQ(null);
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteFAQ,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['faqs'] });
            setDeletingFAQId(null);
        },
    });

    const resetForm = () => {
        setFormData({
            category: 'payment',
            question: '',
            answer: '',
            is_active: true,
            display_order: 0,
        });
    };

    const handleEditClick = (faq: FAQListItem) => {
        setEditingFAQ(faq);
        setFormData({
            category: faq.category,
            question: faq.question,
            answer: faq.answer,
            is_active: faq.is_active,
            display_order: faq.display_order,
        });
    };

    const columns = useMemo<ColumnDef<FAQListItem>[]>(
        () => [
            {
                accessorKey: 'display_order',
                header: '순서',
                cell: ({ row }) => row.original.display_order,
            },
            {
                accessorKey: 'category',
                header: '카테고리',
                cell: ({ row }) => {
                    const cat = FAQ_CATEGORIES.find((c) => c.value === row.original.category);
                    return cat ? cat.label : row.original.category;
                },
            },
            {
                accessorKey: 'question',
                header: '질문',
                cell: ({ row }) => (
                    <div className="max-w-md truncate font-medium">
                        {row.original.question}
                    </div>
                ),
            },
            {
                accessorKey: 'answer',
                header: '답변',
                cell: ({ row }) => (
                    <div className="max-w-md truncate text-gray-500">
                        {row.original.answer}
                    </div>
                ),
            },
            {
                accessorKey: 'is_active',
                header: '상태',
                cell: ({ row }) => (
                    <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${row.original.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                    >
                        {row.original.is_active ? '활성' : '비활성'}
                    </span>
                ),
            },
            {
                accessorKey: 'created_at',
                header: '생성일',
                cell: ({ row }) => format(new Date(row.original.created_at), 'yyyy-MM-dd'),
            },
            {
                id: 'actions',
                header: '관리',
                cell: ({ row }) => (
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleEditClick(row.original)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                        >
                            수정
                        </button>
                        <button
                            onClick={() => setDeletingFAQId(row.original.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                        >
                            삭제
                        </button>
                    </div>
                ),
            },
        ],
        []
    );

    const table = useReactTable({
        data: data?.items || [],
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">FAQ 관리</h1>
                    <p className="mt-1 text-sm text-gray-500">자주 묻는 질문을 관리하세요</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsCreateModalOpen(true);
                    }}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    FAQ 추가
                </button>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 필터</label>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
                >
                    <option value="all">전체</option>
                    {FAQ_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                            {cat.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : typeof header.column.columnDef.header === 'string'
                                                ? header.column.columnDef.header
                                                : header.column.columnDef.header
                                                    ? header.column.columnDef.header({ column: header.column, header, table })
                                                    : null}
                                        {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
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
                                    FAQ가 없습니다.
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
            </div>

            {/* Create/Edit Modal */}
            {(isCreateModalOpen || editingFAQ) && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            {editingFAQ ? 'FAQ 수정' : 'FAQ 추가'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">카테고리</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2 px-3 bg-white text-gray-900"
                                >
                                    {FAQ_CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">질문</label>
                                <input
                                    type="text"
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2 px-3 text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">답변</label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    rows={4}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2 px-3 text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">표시 순서</label>
                                <input
                                    type="number"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2 px-3 text-gray-900"
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                                    활성화
                                </label>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setEditingFAQ(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    if (editingFAQ) {
                                        updateMutation.mutate({ id: editingFAQ.id, data: formData });
                                    } else {
                                        createMutation.mutate(formData);
                                    }
                                }}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {createMutation.isPending || updateMutation.isPending ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingFAQId && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">FAQ 삭제 확인</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            정말로 이 FAQ를 삭제하시겠습니까?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setDeletingFAQId(null)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingFAQId)}
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
