'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  getVehicleMasterDetail,
  updateVehicleMaster,
  VehicleMasterDetail,
  VehicleMasterUpdateRequest,
} from '@/lib/api/admin';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const vehicleMasterUpdateSchema = z.object({
  origin: z.enum(['domestic', 'imported']).optional(),
  manufacturer: z.string().min(1, '제조사를 입력해주세요').max(50, '제조사명은 50자 이하여야 합니다').optional(),
  model_group: z.string().min(1, '모델 그룹을 입력해주세요').max(100, '모델 그룹명은 100자 이하여야 합니다').optional(),
  model_detail: z.string().max(100, '모델 상세명은 100자 이하여야 합니다').nullable().optional(),
  vehicle_class: z.enum(['compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar']).optional(),
  start_year: z.number().min(1900, '출시 연도는 1900년 이후여야 합니다').max(2100, '출시 연도는 2100년 이하여야 합니다').optional(),
  end_year: z.number().min(1900, '종료 연도는 1900년 이후여야 합니다').max(2100, '종료 연도는 2100년 이하여야 합니다').nullable().optional(),
  is_active: z.boolean().optional(),
});

type VehicleMasterUpdateFormData = z.infer<typeof vehicleMasterUpdateSchema>;

export default function VehicleMasterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const masterId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicleMaster-detail', masterId],
    queryFn: () => getVehicleMasterDetail(masterId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: VehicleMasterUpdateRequest) => updateVehicleMaster(masterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleMaster-detail', masterId] });
      queryClient.invalidateQueries({ queryKey: ['vehicleMasters'] });
      setIsEditing(false);
      alert('차량 마스터 정보가 성공적으로 수정되었습니다.');
    },
    onError: (error: any) => {
      console.error('차량 마스터 수정 실패:', error);
      alert(error.response?.data?.detail || '차량 마스터 수정에 실패했습니다');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<VehicleMasterUpdateFormData>({
    resolver: zodResolver(vehicleMasterUpdateSchema),
  });

  // 데이터가 로드되면 폼 초기화
  useEffect(() => {
    if (data && !isEditing) {
      reset({
        origin: data.origin as 'domestic' | 'imported',
        manufacturer: data.manufacturer,
        model_group: data.model_group,
        model_detail: data.model_detail,
        vehicle_class: data.vehicle_class as 'compact' | 'small' | 'mid' | 'large' | 'suv' | 'sports' | 'supercar',
        start_year: data.start_year,
        end_year: data.end_year,
        is_active: data.is_active,
      });
    }
  }, [data, isEditing, reset]);

  const onSubmit = async (formData: VehicleMasterUpdateFormData) => {
    const updateData: VehicleMasterUpdateRequest = {
      origin: formData.origin || null,
      manufacturer: formData.manufacturer || null,
      model_group: formData.model_group || null,
      model_detail: formData.model_detail ?? null,
      vehicle_class: formData.vehicle_class || null,
      start_year: formData.start_year || null,
      end_year: formData.end_year ?? null,
      is_active: formData.is_active ?? null,
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
          차량 마스터 정보를 불러오는 중 오류가 발생했습니다: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="text-sm text-yellow-800">차량 마스터를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const classMap: Record<string, string> = {
    compact: '경차',
    small: '소형',
    mid: '중형',
    large: '대형',
    suv: 'SUV',
    sports: '스포츠카',
    supercar: '슈퍼카',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차량 마스터 상세</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data.manufacturer} {data.model_group} {data.model_detail || ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/vehicles/master')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            목록으로
          </button>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
            >
              수정
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              취소
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 국산/수입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">국산/수입</label>
            {isEditing ? (
              <select
                {...register('origin')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="domestic">국산</option>
                <option value="imported">수입</option>
              </select>
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">
                {data.origin === 'domestic' ? '국산' : '수입'}
              </div>
            )}
            {errors.origin && <p className="mt-1 text-sm text-red-600">{errors.origin.message}</p>}
          </div>

          {/* 제조사 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">제조사</label>
            {isEditing ? (
              <input
                type="text"
                {...register('manufacturer')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">{data.manufacturer}</div>
            )}
            {errors.manufacturer && <p className="mt-1 text-sm text-red-600">{errors.manufacturer.message}</p>}
          </div>

          {/* 모델 그룹 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">모델 그룹</label>
            {isEditing ? (
              <input
                type="text"
                {...register('model_group')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">{data.model_group}</div>
            )}
            {errors.model_group && <p className="mt-1 text-sm text-red-600">{errors.model_group.message}</p>}
          </div>

          {/* 모델 상세 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">모델 상세</label>
            {isEditing ? (
              <input
                type="text"
                {...register('model_detail')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">{data.model_detail || '-'}</div>
            )}
            {errors.model_detail && <p className="mt-1 text-sm text-red-600">{errors.model_detail.message}</p>}
          </div>

          {/* 차량 등급 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">차량 등급</label>
            {isEditing ? (
              <select
                {...register('vehicle_class')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="compact">경차</option>
                <option value="small">소형</option>
                <option value="mid">중형</option>
                <option value="large">대형</option>
                <option value="suv">SUV</option>
                <option value="sports">스포츠카</option>
                <option value="supercar">슈퍼카</option>
              </select>
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">
                {classMap[data.vehicle_class] || data.vehicle_class}
              </div>
            )}
            {errors.vehicle_class && <p className="mt-1 text-sm text-red-600">{errors.vehicle_class.message}</p>}
          </div>

          {/* 출시 시작 연도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">출시 시작 연도</label>
            {isEditing ? (
              <input
                type="number"
                {...register('start_year', { valueAsNumber: true })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">{data.start_year}</div>
            )}
            {errors.start_year && <p className="mt-1 text-sm text-red-600">{errors.start_year.message}</p>}
          </div>

          {/* 출시 종료 연도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">출시 종료 연도</label>
            {isEditing ? (
              <input
                type="number"
                {...register('end_year', { valueAsNumber: true })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">{data.end_year || '-'}</div>
            )}
            {errors.end_year && <p className="mt-1 text-sm text-red-600">{errors.end_year.message}</p>}
          </div>

          {/* 활성화 여부 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
            {isEditing ? (
              <select
                {...register('is_active', { valueAsNumber: false })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            ) : (
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">
                {data.is_active ? '활성' : '비활성'}
              </div>
            )}
            {errors.is_active && <p className="mt-1 text-sm text-red-600">{errors.is_active.message}</p>}
          </div>
        </div>

        {/* 생성일/수정일 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">생성일</label>
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">
                {data.created_at ? format(new Date(data.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">수정일</label>
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-gray-900">
                {data.updated_at ? format(new Date(data.updated_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* 수정 버튼 */}
        {isEditing && (
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

