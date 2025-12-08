'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getUserDetail, updateUser, UserDetail, UserUpdateRequest } from '@/lib/api/admin';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 폼 스키마 정의
const userUpdateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하여야 합니다'),
  email: z.string().email('올바른 이메일 형식이 아닙니다').nullable().optional().or(z.literal('')),
  phone: z.string().min(10, '전화번호를 입력해주세요').max(11, '전화번호 형식이 올바르지 않습니다'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').optional().or(z.literal('')),
  region_id: z.string().nullable().optional(),
  level: z.number().min(1).max(5).nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
}).refine((data) => {
  // 기사인 경우 등급, 수수료율, 활동 지역 필수
  if (data.level !== null && data.level !== undefined) {
    return data.commission_rate !== null && data.commission_rate !== undefined && data.region_id;
  }
  return true;
}, {
  message: '기사는 등급, 수수료율, 활동 지역이 모두 필요합니다',
  path: ['level'],
});

type UserUpdateFormData = z.infer<typeof userUpdateSchema>;

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => getUserDetail(userId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UserUpdateRequest) => updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditing(false);
      alert('유저 정보가 성공적으로 수정되었습니다.');
    },
    onError: (error: any) => {
      console.error('유저 수정 실패:', error);
      alert(error.response?.data?.detail || '유저 수정에 실패했습니다');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
  });

  // 데이터가 로드되면 폼 초기화
  useEffect(() => {
    if (data && !isEditing) {
      reset({
        name: data.name,
        email: data.email || '',
        phone: data.phone,
        password: '',
        region_id: data.region_id || '',
        level: data.level || null,
        commission_rate: data.commission_rate || null,
        status: data.status as 'active' | 'inactive' | 'suspended',
      });
    }
  }, [data, isEditing, reset]);

  const onSubmit = async (formData: UserUpdateFormData) => {
    const updateData: UserUpdateRequest = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone,
      password: formData.password || null,
      region_id: formData.region_id || null,
      level: formData.level || null,
      commission_rate: formData.commission_rate || null,
      status: formData.status,
    };
    updateMutation.mutate(updateData);
  };

  const roleMap: Record<string, string> = {
    client: '고객',
    inspector: '기사',
    staff: '직원',
    admin: '관리자',
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: '활성', color: 'bg-green-100 text-green-800' },
    inactive: { label: '비활성', color: 'bg-gray-100 text-gray-800' },
    suspended: { label: '정지', color: 'bg-red-100 text-red-800' },
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

  const isInspector = data.role === 'inspector';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">유저 상세</h1>
          <p className="mt-1 text-sm text-gray-500">유저 정보를 확인하고 수정하세요</p>
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
                onClick={() => router.push('/admin/users')}
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
                이름 *
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  !isEditing ? 'bg-gray-50' : ''
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  !isEditing ? 'bg-gray-50' : ''
                }`}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                전화번호 *
              </label>
              <input
                {...register('phone')}
                type="tel"
                id="phone"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  !isEditing ? 'bg-gray-50' : ''
                }`}
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 변경 (선택)
              </label>
              <input
                {...register('password')}
                type="password"
                id="password"
                disabled={!isEditing}
                placeholder="변경하지 않으려면 비워두세요"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  !isEditing ? 'bg-gray-50' : ''
                }`}
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>
          </div>
        </div>

        {/* 역할 및 권한 섹션 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">역할 및 권한</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">역할</label>
              <div className="mt-1 text-sm text-gray-900">{roleMap[data.role] || data.role}</div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                상태 *
              </label>
              <select
                {...register('status')}
                id="status"
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                  !isEditing ? 'bg-gray-50' : ''
                }`}
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
                <option value="suspended">정지</option>
              </select>
              {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>}
            </div>
          </div>
        </div>

        {/* 기사 전용 섹션 */}
        {isInspector && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">기사 정보</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label htmlFor="level" className="block text-sm font-medium text-gray-700">
                  등급 (1~5) *
                </label>
                <input
                  {...register('level', { valueAsNumber: true })}
                  type="number"
                  id="level"
                  min="1"
                  max="5"
                  disabled={!isEditing}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    !isEditing ? 'bg-gray-50' : ''
                  }`}
                />
                {errors.level && <p className="mt-1 text-sm text-red-600">{errors.level.message}</p>}
              </div>

              <div>
                <label htmlFor="commission_rate" className="block text-sm font-medium text-gray-700">
                  수수료율 (0~100%) *
                </label>
                <input
                  {...register('commission_rate', { valueAsNumber: true })}
                  type="number"
                  id="commission_rate"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!isEditing}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    !isEditing ? 'bg-gray-50' : ''
                  }`}
                />
                {errors.commission_rate && (
                  <p className="mt-1 text-sm text-red-600">{errors.commission_rate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="region_id" className="block text-sm font-medium text-gray-700">
                  활동 지역 ID *
                </label>
                <input
                  {...register('region_id')}
                  type="text"
                  id="region_id"
                  disabled={!isEditing}
                  placeholder="UUID 형식"
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    !isEditing ? 'bg-gray-50' : ''
                  }`}
                />
                {errors.region_id && <p className="mt-1 text-sm text-red-600">{errors.region_id.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* 활동 이력 섹션 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">활동 이력</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">가입일</label>
              <div className="mt-1 text-sm text-gray-900">
                {data.created_at ? format(new Date(data.created_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">최종 수정일</label>
              <div className="mt-1 text-sm text-gray-900">
                {data.updated_at ? format(new Date(data.updated_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

