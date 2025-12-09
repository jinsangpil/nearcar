'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVehicleMaster, VehicleMasterCreateRequest } from '@/lib/api/admin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const vehicleMasterCreateSchema = z.object({
  origin: z.enum(['domestic', 'imported'], { required_error: '국산/수입을 선택해주세요' }),
  manufacturer: z.string().min(1, '제조사를 입력해주세요').max(50, '제조사명은 50자 이하여야 합니다'),
  model_group: z.string().min(1, '모델 그룹을 입력해주세요').max(100, '모델 그룹명은 100자 이하여야 합니다'),
  model_detail: z.string().max(100, '모델 상세명은 100자 이하여야 합니다').nullable().optional(),
  vehicle_class: z.enum(['compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar'], {
    required_error: '차량 등급을 선택해주세요',
  }),
  start_year: z.number().min(1900, '출시 연도는 1900년 이후여야 합니다').max(2100, '출시 연도는 2100년 이하여야 합니다'),
  end_year: z.number().min(1900, '종료 연도는 1900년 이후여야 합니다').max(2100, '종료 연도는 2100년 이하여야 합니다').nullable().optional(),
  is_active: z.boolean().default(true),
});

type VehicleMasterCreateFormData = z.infer<typeof vehicleMasterCreateSchema>;

export default function NewVehicleMasterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VehicleMasterCreateFormData>({
    resolver: zodResolver(vehicleMasterCreateSchema),
    defaultValues: {
      is_active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VehicleMasterCreateRequest) => createVehicleMaster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleMasters'] });
      router.push('/admin/vehicles/master');
    },
    onError: (error: any) => {
      console.error('차량 마스터 생성 실패:', error);
      alert(error.response?.data?.detail || '차량 마스터 생성에 실패했습니다');
    },
  });

  const onSubmit = async (formData: VehicleMasterCreateFormData) => {
    const createData: VehicleMasterCreateRequest = {
      origin: formData.origin,
      manufacturer: formData.manufacturer,
      model_group: formData.model_group,
      model_detail: formData.model_detail || null,
      vehicle_class: formData.vehicle_class,
      start_year: formData.start_year,
      end_year: formData.end_year || null,
      is_active: formData.is_active,
    };

    try {
      await createMutation.mutateAsync(createData);
    } catch (error: any) {
      console.error('차량 마스터 생성 실패:', error);
      alert(error.response?.data?.detail || '차량 마스터 생성에 실패했습니다');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차량 마스터 생성</h1>
          <p className="mt-1 text-sm text-gray-500">새로운 차량 마스터를 생성하세요</p>
        </div>
        <button
          onClick={() => router.push('/admin/vehicles/master')}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 국산/수입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              국산/수입 <span className="text-red-500">*</span>
            </label>
            <select
              {...register('origin')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">선택해주세요</option>
              <option value="domestic">국산</option>
              <option value="imported">수입</option>
            </select>
            {errors.origin && <p className="mt-1 text-sm text-red-600">{errors.origin.message}</p>}
          </div>

          {/* 제조사 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제조사 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('manufacturer')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: Hyundai"
            />
            {errors.manufacturer && <p className="mt-1 text-sm text-red-600">{errors.manufacturer.message}</p>}
          </div>

          {/* 모델 그룹 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              모델 그룹 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('model_group')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: Grandeur"
            />
            {errors.model_group && <p className="mt-1 text-sm text-red-600">{errors.model_group.message}</p>}
          </div>

          {/* 모델 상세 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">모델 상세</label>
            <input
              type="text"
              {...register('model_detail')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: The New Grandeur"
            />
            {errors.model_detail && <p className="mt-1 text-sm text-red-600">{errors.model_detail.message}</p>}
          </div>

          {/* 차량 등급 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              차량 등급 <span className="text-red-500">*</span>
            </label>
            <select
              {...register('vehicle_class')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">선택해주세요</option>
              <option value="compact">경차</option>
              <option value="small">소형</option>
              <option value="mid">중형</option>
              <option value="large">대형</option>
              <option value="suv">SUV</option>
              <option value="sports">스포츠카</option>
              <option value="supercar">슈퍼카</option>
            </select>
            {errors.vehicle_class && <p className="mt-1 text-sm text-red-600">{errors.vehicle_class.message}</p>}
          </div>

          {/* 출시 시작 연도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              출시 시작 연도 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              {...register('start_year', { valueAsNumber: true })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: 2019"
            />
            {errors.start_year && <p className="mt-1 text-sm text-red-600">{errors.start_year.message}</p>}
          </div>

          {/* 출시 종료 연도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">출시 종료 연도</label>
            <input
              type="number"
              {...register('end_year', { valueAsNumber: true })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: 2023 (현재 생산 중이면 비워두세요)"
            />
            {errors.end_year && <p className="mt-1 text-sm text-red-600">{errors.end_year.message}</p>}
          </div>

          {/* 활성화 여부 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
            <select
              {...register('is_active', { valueAsNumber: false })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
            {errors.is_active && <p className="mt-1 text-sm text-red-600">{errors.is_active.message}</p>}
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '생성 중...' : '생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

