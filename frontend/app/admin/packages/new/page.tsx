'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPackage, PackageCreateRequest } from '@/lib/api/admin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

// 폼 스키마 정의
const packageCreateSchema = z.object({
  name: z.string().min(1, '패키지명을 입력해주세요').max(50, '패키지명은 50자 이하여야 합니다'),
  base_price: z.number().min(0, '기본 가격은 0원 이상이어야 합니다'),
  included_items: z.record(z.any()).optional(),
});

type PackageCreateFormData = z.infer<typeof packageCreateSchema>;

export default function NewPackagePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [jsonError, setJsonError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<PackageCreateFormData>({
    resolver: zodResolver(packageCreateSchema),
    defaultValues: {
      included_items: {
        sections: [
          {
            name: '외관',
            items: [],
          },
        ],
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: PackageCreateRequest) => createPackage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      router.push('/admin/packages');
    },
  });

  const handleJsonChange = (value: string) => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(value);
      setValue('included_items', parsed);
    } catch (e) {
      setJsonError('올바른 JSON 형식이 아닙니다');
    }
  };

  const onSubmit = async (formData: PackageCreateFormData) => {
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

    const createData: PackageCreateRequest = {
      name: formData.name,
      base_price: formData.base_price,
      included_items: includedItems || {},
    };
    
    try {
      await createMutation.mutateAsync(createData);
    } catch (error: any) {
      console.error('패키지 생성 실패:', error);
      alert(error.response?.data?.detail || '패키지 생성에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">패키지 생성</h1>
          <p className="mt-1 text-sm text-gray-500">새로운 패키지를 생성하세요</p>
        </div>
        <button
          onClick={() => router.push('/admin/packages')}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          목록으로
        </button>
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
              />
              {errors.base_price && <p className="mt-1 text-sm text-red-600">{errors.base_price.message}</p>}
            </div>
          </div>
        </div>

        {/* 포함 항목 섹션 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">포함 항목 (JSON)</h2>
          <div>
            <label htmlFor="included_items" className="block text-sm font-medium text-gray-700 mb-2">
              포함 항목 JSON 구조 *
            </label>
            <textarea
              {...register('included_items')}
              id="included_items"
              rows={15}
              onChange={(e) => handleJsonChange(e.target.value)}
              defaultValue={JSON.stringify(
                {
                  sections: [
                    {
                      name: '외관',
                      items: [],
                    },
                  ],
                },
                null,
                2
              )}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm font-mono text-gray-900 bg-white"
            />
            {jsonError && <p className="mt-1 text-sm text-red-600">{jsonError}</p>}
            {errors.included_items && <p className="mt-1 text-sm text-red-600">{errors.included_items.message}</p>}
            <p className="mt-2 text-xs text-gray-500">
              예시: {`{"sections": [{"name": "외관", "items": ["전면 유리", "도어"]}, {"name": "엔진룸", "items": ["엔진 오일", "냉각수"]}]}`}
            </p>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.push('/admin/packages')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending || !!jsonError}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting || createMutation.isPending ? '생성 중...' : '생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

