'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getVehicleModelDetail, updateVehicleModel, getManufacturers, VehicleModelDetail, VehicleModelUpdateRequest } from '@/lib/api/admin';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const vehicleModelUpdateSchema = z.object({
  manufacturer_id: z.string().min(1, '제조사를 선택해주세요'),
  model_group: z.string().min(1, '모델 그룹을 입력해주세요').max(100, '모델 그룹은 100자 이하여야 합니다'),
  model_detail: z.string().max(100, '모델 상세는 100자 이하여야 합니다').nullable(),
  vehicle_class: z.enum(['compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar'], {
    required_error: '차량 등급을 선택해주세요',
  }),
  start_year: z.number().min(1900, '1900년 이상이어야 합니다').max(new Date().getFullYear() + 1, '현재 연도보다 클 수 없습니다'),
  end_year: z.number().min(1900, '1900년 이상이어야 합니다').max(new Date().getFullYear() + 1, '현재 연도보다 클 수 없습니다').nullable(),
  is_active: z.boolean(),
}).refine(data => {
  if (data.end_year !== null && data.end_year < data.start_year) {
    return false;
  }
  return true;
}, {
  message: '종료 연도는 시작 연도보다 빠를 수 없습니다',
  path: ['end_year'],
});

type VehicleModelUpdateFormData = z.infer<typeof vehicleModelUpdateSchema>;

export default function VehicleModelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const modelId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, error } = useQuery<VehicleModelDetail, Error>({
    queryKey: ['vehicle-model-detail', modelId],
    queryFn: () => getVehicleModelDetail(modelId),
  });

  // 제조사 목록 조회
  const { data: manufacturersData } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => getManufacturers(),
  });

  const updateMutation = useMutation<VehicleModelDetail, Error, VehicleModelUpdateRequest>({
    mutationFn: (data: VehicleModelUpdateRequest) => updateVehicleModel(modelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-model-detail', modelId] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-models'] });
      setIsEditing(false);
      alert('차량 모델 정보가 성공적으로 수정되었습니다.');
    },
    onError: (error: any) => {
      console.error('차량 모델 수정 실패:', error);
      alert(error.response?.data?.detail || '차량 모델 수정에 실패했습니다');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<VehicleModelUpdateFormData>({
    resolver: zodResolver(vehicleModelUpdateSchema),
  });

  // 데이터가 로드되면 폼 초기화
  useEffect(() => {
    if (data && !isEditing) {
      reset({
        manufacturer_id: data.manufacturer_id,
        model_group: data.model_group,
        model_detail: data.model_detail || null,
        vehicle_class: data.vehicle_class as 'compact' | 'small' | 'mid' | 'large' | 'suv' | 'sports' | 'supercar',
        start_year: data.start_year,
        end_year: data.end_year || null,
        is_active: data.is_active,
      });
    }
  }, [data, isEditing, reset]);

  const onSubmit = async (formData: VehicleModelUpdateFormData) => {
    const updateData: VehicleModelUpdateRequest = {
      manufacturer_id: formData.manufacturer_id,
      model_group: formData.model_group,
      model_detail: formData.model_detail || undefined,
      vehicle_class: formData.vehicle_class,
      start_year: formData.start_year,
      end_year: formData.end_year || undefined,
      is_active: formData.is_active,
    };
    updateMutation.mutate(updateData);
  };

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
        <div className="text-sm text-red-800">
          차량 모델 상세 정보를 불러오는 중 오류가 발생했습니다: {error.message}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['vehicle-model-detail', modelId] })}
            className="ml-4 text-indigo-700 hover:text-indigo-900 font-medium"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="text-sm text-yellow-800">차량 모델 데이터를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차량 모델 상세/수정</h1>
          <p className="mt-1 text-sm text-gray-500">차량 모델 정보를 확인하고 수정합니다.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push('/admin/vehicles')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            목록으로
          </button>
          {isEditing ? (
            <button
              onClick={() => {
                setIsEditing(false);
                reset({
                  manufacturer_id: data.manufacturer_id,
                  model_group: data.model_group,
                  model_detail: data.model_detail || null,
                  vehicle_class: data.vehicle_class as 'compact' | 'small' | 'mid' | 'large' | 'suv' | 'sports' | 'supercar',
                  start_year: data.start_year,
                  end_year: data.end_year || null,
                  is_active: data.is_active,
                });
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              취소
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
            >
              수정
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <label htmlFor="manufacturer_id" className="block text-sm font-medium text-gray-700">
              제조사
            </label>
            <select
              id="manufacturer_id"
              {...register('manufacturer_id')}
              disabled={!isEditing}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base ${
                isEditing ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <option value="">제조사를 선택하세요</option>
              {manufacturersData?.items.map((mfr) => (
                <option key={mfr.id} value={mfr.id}>
                  {mfr.name} ({mfr.origin === 'domestic' ? '국산' : '수입'})
                </option>
              ))}
            </select>
            {errors.manufacturer_id && <p className="mt-2 text-sm text-red-600">{errors.manufacturer_id.message}</p>}
          </div>

          <div>
            <label htmlFor="model_group" className="block text-sm font-medium text-gray-700">
              모델 그룹
            </label>
            <input
              type="text"
              id="model_group"
              {...register('model_group')}
              disabled={!isEditing}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base ${
                isEditing ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            />
            {errors.model_group && <p className="mt-2 text-sm text-red-600">{errors.model_group.message}</p>}
          </div>

          <div>
            <label htmlFor="model_detail" className="block text-sm font-medium text-gray-700">
              모델 상세
            </label>
            <input
              type="text"
              id="model_detail"
              {...register('model_detail')}
              disabled={!isEditing}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base ${
                isEditing ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            />
            {errors.model_detail && <p className="mt-2 text-sm text-red-600">{errors.model_detail.message}</p>}
          </div>

          <div>
            <label htmlFor="vehicle_class" className="block text-sm font-medium text-gray-700">
              차량 등급
            </label>
            <select
              id="vehicle_class"
              {...register('vehicle_class')}
              disabled={!isEditing}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base ${
                isEditing ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <option value="compact">경차</option>
              <option value="small">소형</option>
              <option value="mid">중형</option>
              <option value="large">대형</option>
              <option value="suv">SUV</option>
              <option value="sports">스포츠카</option>
              <option value="supercar">슈퍼카</option>
            </select>
            {errors.vehicle_class && <p className="mt-2 text-sm text-red-600">{errors.vehicle_class.message}</p>}
          </div>

          <div>
            <label htmlFor="start_year" className="block text-sm font-medium text-gray-700">
              출시 시작 연도
            </label>
            <input
              type="number"
              id="start_year"
              {...register('start_year', { valueAsNumber: true })}
              disabled={!isEditing}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base ${
                isEditing ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            />
            {errors.start_year && <p className="mt-2 text-sm text-red-600">{errors.start_year.message}</p>}
          </div>

          <div>
            <label htmlFor="end_year" className="block text-sm font-medium text-gray-700">
              출시 종료 연도
            </label>
            <input
              type="number"
              id="end_year"
              {...register('end_year', { valueAsNumber: true })}
              disabled={!isEditing}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base ${
                isEditing ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            />
            {errors.end_year && <p className="mt-2 text-sm text-red-600">{errors.end_year.message}</p>}
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              type="checkbox"
              {...register('is_active')}
              disabled={!isEditing}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm font-medium text-gray-700">
              활성화 여부
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-6">
          <h2 className="text-lg font-medium text-gray-900">기타 정보</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">생성일</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {data.created_at ? format(new Date(data.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">최종 수정일</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {data.updated_at ? format(new Date(data.updated_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
              </dd>
            </div>
          </dl>
        </div>

        {isEditing && (
          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isSubmitting ? '저장 중...' : '변경 사항 저장'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

