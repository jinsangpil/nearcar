'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getPackageDetail, updatePackage, PackageDetail, PackageUpdateRequest } from '@/lib/api/admin';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const packageUpdateSchema = z.object({
  name: z.string().min(1, '패키지명을 입력해주세요').max(50, '패키지명은 50자 이하여야 합니다'),
  base_price: z.number().min(0, '기본 가격은 0원 이상이어야 합니다'),
  included_items: z.record(z.any()).optional(),
  is_active: z.boolean(),
});

type PackageUpdateFormData = z.infer<typeof packageUpdateSchema>;

export default function PackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const packageId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['package-detail', packageId],
    queryFn: () => getPackageDetail(packageId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: PackageUpdateRequest) => updatePackage(packageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['package-detail', packageId] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setIsEditing(false);
      setJsonError(null);
      alert('패키지 정보가 성공적으로 수정되었습니다.');
    },
    onError: (error: any) => {
      console.error('패키지 수정 실패:', error);
      alert(error.response?.data?.detail || '패키지 수정에 실패했습니다');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<PackageUpdateFormData>({
    resolver: zodResolver(packageUpdateSchema),
  });

  const includedItemsJson = watch('included_items');

  // 데이터가 로드되면 폼 초기화
  useEffect(() => {
    if (data && !isEditing) {
      reset({
        name: data.name,
        base_price: data.base_price,
        included_items: data.included_items,
        is_active: data.is_active,
      });
    }
  }, [data, isEditing, reset]);

  const onSubmit = async (formData: PackageUpdateFormData) => {
    // JSON 유효성 검사
    let includedItems = formData.included_items;
    if (typeof includedItems === 'string') {
      try {
        includedItems = JSON.parse(includedItems);
      } catch (e) {
        setJsonError('포함 항목이 올바른 JSON 형식이 아닙니다');
        return;
      }
    }

    const updateData: PackageUpdateRequest = {
      name: formData.name,
      base_price: formData.base_price,
      included_items: includedItems || null,
      is_active: formData.is_active,
    };
    updateMutation.mutate(updateData);
  };

  const handleJsonChange = (value: string) => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(value);
      setValue('included_items', parsed);
    } catch (e) {
      setJsonError('올바른 JSON 형식이 아닙니다');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error || !data) {
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
          <h1 className="text-2xl font-bold text-gray-900">패키지 상세</h1>
          <p className="mt-1 text-sm text-gray-500">패키지 정보를 확인하고 수정하세요</p>
        </div>
        <div className="flex space-x-3">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                수정
              </button>
              <button
                onClick={() => router.push('/admin/packages')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                목록으로
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  reset();
                  setJsonError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || updateMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting || updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 기본 정보 섹션 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">기본 정보</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                패키지명 *
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="base_price" className="block text-sm font-medium text-gray-700">
                기본 가격 (원) *
              </label>
              <input
                {...register('base_price', { valueAsNumber: true })}
                type="number"
                id="base_price"
                min="0"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
                }`}
              />
              {errors.base_price && <p className="mt-1 text-sm text-red-600">{errors.base_price.message}</p>}
            </div>

            <div>
              <label htmlFor="is_active" className="block text-sm font-medium text-gray-700">
                상태 *
              </label>
              <select
                {...register('is_active', { valueAsNumber: false })}
                id="is_active"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
              {errors.is_active && <p className="mt-1 text-sm text-red-600">{errors.is_active.message}</p>}
            </div>
          </div>
        </div>

        {/* 포함 항목 섹션 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">포함 항목 (JSON)</h2>
          <div>
            <label htmlFor="included_items" className="block text-sm font-medium text-gray-700 mb-2">
              포함 항목 JSON 구조
            </label>
            <textarea
              {...register('included_items')}
              id="included_items"
              rows={15}
              disabled={!isEditing}
              onChange={(e) => {
                if (isEditing) {
                  handleJsonChange(e.target.value);
                }
              }}
              defaultValue={JSON.stringify(data.included_items || {}, null, 2)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-mono text-gray-900 ${
                !isEditing ? 'bg-gray-50' : 'bg-white'
              }`}
            />
            {jsonError && <p className="mt-1 text-sm text-red-600">{jsonError}</p>}
            {errors.included_items && <p className="mt-1 text-sm text-red-600">{errors.included_items.message}</p>}
            <p className="mt-2 text-xs text-gray-500">
              예시: {`{"sections": [{"name": "외관", "items": ["전면 유리", "도어"]}]}`}
            </p>
          </div>
        </div>

        {/* 읽기 전용 정보 */}
        {!isEditing && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">추가 정보</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">생성일</label>
                <div className="mt-1 text-sm text-gray-900">
                  {data.created_at ? format(new Date(data.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">수정일</label>
                <div className="mt-1 text-sm text-gray-900">
                  {data.updated_at ? format(new Date(data.updated_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

