'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createVehicleModel, getManufacturers, VehicleModelCreateRequest } from '@/lib/api/admin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const vehicleModelCreateSchema = z.object({
  manufacturer_id: z.string().min(1, '제조사를 선택해주세요'),
  model_group: z.string().min(1, '모델 그룹을 입력해주세요').max(100, '모델 그룹은 100자 이하여야 합니다'),
  model_detail: z.string().max(100, '모델 상세는 100자 이하여야 합니다').nullable(),
  vehicle_class: z.enum(['compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar'], {
    required_error: '차량 등급을 선택해주세요',
  }),
  start_year: z.number().min(1900, '1900년 이상이어야 합니다').max(new Date().getFullYear() + 1, '현재 연도보다 클 수 없습니다'),
  end_year: z.number().min(1900, '1900년 이상이어야 합니다').max(new Date().getFullYear() + 1, '현재 연도보다 클 수 없습니다').nullable(),
  is_active: z.boolean().default(true),
}).refine(data => {
  if (data.end_year !== null && data.end_year < data.start_year) {
    return false;
  }
  return true;
}, {
  message: '종료 연도는 시작 연도보다 빠를 수 없습니다',
  path: ['end_year'],
});

type VehicleModelCreateFormData = z.infer<typeof vehicleModelCreateSchema>;

export default function NewVehicleModelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const manufacturerIdFromQuery = searchParams.get('manufacturer_id');

  // 제조사 목록 조회
  const { data: manufacturersData } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => getManufacturers(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<VehicleModelCreateFormData>({
    resolver: zodResolver(vehicleModelCreateSchema),
    defaultValues: {
      manufacturer_id: manufacturerIdFromQuery || '',
      vehicle_class: 'mid',
      start_year: new Date().getFullYear(),
      is_active: true,
    },
  });

  // URL 파라미터에서 제조사 ID가 있으면 설정
  useEffect(() => {
    if (manufacturerIdFromQuery) {
      setValue('manufacturer_id', manufacturerIdFromQuery);
    }
  }, [manufacturerIdFromQuery, setValue]);

  const createMutation = useMutation<any, Error, VehicleModelCreateRequest>({
    mutationFn: (data: VehicleModelCreateRequest) => createVehicleModel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-models'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      router.push('/admin/vehicles');
      alert('차량 모델이 성공적으로 생성되었습니다.');
    },
    onError: (error: any) => {
      console.error('차량 모델 생성 실패:', error);
      alert(error.response?.data?.detail || '차량 모델 생성에 실패했습니다');
    },
  });

  const onSubmit = async (formData: VehicleModelCreateFormData) => {
    const createData: VehicleModelCreateRequest = {
      manufacturer_id: formData.manufacturer_id,
      model_group: formData.model_group,
      model_detail: formData.model_detail || undefined,
      vehicle_class: formData.vehicle_class,
      start_year: formData.start_year,
      end_year: formData.end_year || undefined,
      is_active: formData.is_active,
    };
    
    createMutation.mutate(createData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차량 모델 생성</h1>
          <p className="mt-1 text-sm text-gray-500">새로운 차량 모델을 생성합니다.</p>
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
            <label htmlFor="manufacturer_id" className="block text-sm font-medium text-gray-700">
              제조사
            </label>
            <select
              id="manufacturer_id"
              {...register('manufacturer_id')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 text-base bg-white text-gray-900"
            />
            {errors.end_year && <p className="mt-2 text-sm text-red-600">{errors.end_year.message}</p>}
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
            {isSubmitting ? '생성 중...' : '차량 모델 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

