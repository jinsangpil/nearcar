'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, UserCreateRequest } from '@/lib/api/admin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

// 폼 스키마 정의
const userCreateSchema = z
  .object({
    role: z.enum(['client', 'inspector', 'staff', 'admin'], {
      required_error: '역할을 선택해주세요',
    }),
    name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하여야 합니다'),
    email: z.string().email('올바른 이메일 형식이 아닙니다').nullable().optional().or(z.literal('')),
    phone: z.string().min(10, '전화번호를 입력해주세요').max(11, '전화번호 형식이 올바르지 않습니다'),
    password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').optional().or(z.literal('')),
    region_id: z.string().nullable().optional(),
    level: z.number().min(1).max(5).nullable().optional(),
    commission_rate: z.number().min(0).max(100).nullable().optional(),
    status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  })
  .refine(
    (data) => {
      // 기사인 경우 등급, 수수료율, 활동 지역 필수
      if (data.role === 'inspector') {
        return (
          data.level !== null &&
          data.level !== undefined &&
          data.commission_rate !== null &&
          data.commission_rate !== undefined &&
          data.region_id &&
          data.region_id.trim() !== ''
        );
      }
      return true;
    },
    {
      message: '기사는 등급, 수수료율, 활동 지역이 모두 필요합니다',
      path: ['level'],
    }
  );

type UserCreateFormData = z.infer<typeof userCreateSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      role: 'client',
      status: 'active',
    },
  });

  const selectedRole = watch('role');
  const isInspector = selectedRole === 'inspector';

  const createMutation = useMutation({
    mutationFn: (data: UserCreateRequest) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push('/admin/users');
    },
  });

  const onSubmit = async (formData: UserCreateFormData) => {
    try {
      const createData: UserCreateRequest = {
        role: formData.role,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        password: formData.password || null,
        region_id: formData.region_id || null,
        level: formData.level || null,
        commission_rate: formData.commission_rate || null,
        status: formData.status,
      };
      await createMutation.mutateAsync(createData);
    } catch (error: any) {
      console.error('유저 생성 실패:', error);
      alert(error.response?.data?.detail || '유저 생성에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">유저 생성</h1>
          <p className="mt-1 text-sm text-gray-500">새로운 유저를 생성하세요</p>
        </div>
        <button
          onClick={() => router.push('/admin/users')}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 역할 선택 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">역할 선택</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: 'client', label: '고객' },
              { value: 'inspector', label: '기사' },
              { value: 'staff', label: '직원' },
              { value: 'admin', label: '관리자' },
            ].map((role) => (
              <label
                key={role.value}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  selectedRole === role.value
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <input
                  {...register('role')}
                  type="radio"
                  value={role.value}
                  className="sr-only"
                />
                <div className="flex flex-1">
                  <div className="flex flex-col">
                    <span className={`block text-sm font-medium ${
                      selectedRole === role.value ? 'text-indigo-900' : 'text-gray-900'
                    }`}>
                      {role.label}
                    </span>
                  </div>
                </div>
                {selectedRole === role.value && (
                  <div className="text-indigo-600">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
          {errors.role && <p className="mt-2 text-sm text-red-600">{errors.role.message}</p>}
        </div>

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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 (선택)
              </label>
              <input
                {...register('password')}
                type="password"
                id="password"
                placeholder="비워두면 임시 비밀번호가 생성됩니다"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                상태 *
              </label>
              <select
                {...register('status')}
                id="status"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
            <h2 className="text-lg font-medium text-gray-900 mb-4">기사 정보 *</h2>
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
                  placeholder="UUID 형식"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                {errors.region_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.region_id.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting || createMutation.isPending ? '생성 중...' : '생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

