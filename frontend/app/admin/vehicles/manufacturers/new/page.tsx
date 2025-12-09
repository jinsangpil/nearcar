'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createManufacturer, ManufacturerCreateRequest } from '@/lib/api/admin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const manufacturerCreateSchema = z.object({
  name: z.string().min(1, '제조사명을 입력해주세요').max(50, '제조사명은 50자 이하여야 합니다'),
  origin: z.enum(['domestic', 'imported'], { required_error: '국산/수입을 선택해주세요' }),
  is_active: z.boolean().default(true),
});

type ManufacturerCreateFormData = z.infer<typeof manufacturerCreateSchema>;

export default function NewManufacturerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ManufacturerCreateFormData>({
    resolver: zodResolver(manufacturerCreateSchema),
    defaultValues: {
      origin: 'domestic',
      is_active: true,
    },
  });

  const createMutation = useMutation<any, Error, ManufacturerCreateRequest>({
    mutationFn: (data: ManufacturerCreateRequest) => createManufacturer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      router.push('/admin/vehicles');
      alert('제조사가 성공적으로 생성되었습니다.');
    },
    onError: (error: any) => {
      console.error('제조사 생성 실패:', error);
      alert(error.response?.data?.detail || '제조사 생성에 실패했습니다');
    },
  });

  const onSubmit = async (formData: ManufacturerCreateFormData) => {
    const createData: ManufacturerCreateRequest = {
      name: formData.name,
      origin: formData.origin,
      is_active: formData.is_active,
    };
    
    createMutation.mutate(createData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">제조사 생성</h1>
          <p className="mt-1 text-sm text-gray-500">새로운 제조사를 생성합니다.</p>
        </div>
        <button
          onClick={() => router.push('/admin/vehicles')}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              제조사명
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
            />
            {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="origin" className="block text-sm font-medium text-gray-700">
              국산/수입
            </label>
            <select
              id="origin"
              {...register('origin')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
            >
              <option value="domestic">국산</option>
              <option value="imported">수입</option>
            </select>
            {errors.origin && <p className="mt-2 text-sm text-red-600">{errors.origin.message}</p>}
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              type="checkbox"
              {...register('is_active')}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm font-medium text-gray-700">
              활성화 여부
            </label>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {isSubmitting ? '생성 중...' : '제조사 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

