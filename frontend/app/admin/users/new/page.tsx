'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createUser, UserCreateRequest, getServiceRegions, ServiceRegionListItem, ServiceRegionListResponse } from '@/lib/api/admin';
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
    level: z.number().min(1).max(5).nullable().optional(),
    commission_rate: z.number().min(0).max(100).nullable().optional(),
    status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  })
  .refine(
    (data) => {
      // 기사인 경우 등급, 수수료율 필수 (활동 지역은 selectedRegions로 검증)
      if (data.role === 'inspector') {
        return (
          data.level !== null &&
          data.level !== undefined &&
          data.commission_rate !== null &&
          data.commission_rate !== undefined
        );
      }
      return true;
    },
    {
      message: '기사는 등급, 수수료율이 모두 필요합니다',
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
    setValue,
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
  
  // 활동 지역 선택 모달 상태
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<ServiceRegionListItem[]>([]);
  const [regionSearchQuery, setRegionSearchQuery] = useState('');
  const [regionProvinceFilter, setRegionProvinceFilter] = useState<string>('all');

  // 서비스 지역 목록 조회
  const { data: regionsData, isLoading: isLoadingRegions, error: regionsError } = useQuery({
    queryKey: ['serviceRegions', { 
      is_active: true, 
      search: regionSearchQuery || undefined, 
      province: regionProvinceFilter === 'all' ? undefined : regionProvinceFilter,
      hierarchy: false 
    }],
    queryFn: async () => {
      const params = { 
        is_active: true, 
        search: regionSearchQuery || undefined,
        province: regionProvinceFilter === 'all' ? undefined : regionProvinceFilter,
        hierarchy: false,
        limit: 100,
        page: 1
      };
      
      console.log('서비스 지역 조회 파라미터:', params);
      
      const result = await getServiceRegions(params);
      
      console.log('서비스 지역 조회 결과:', result);
      
      // 계층 구조인 경우 평면화
      if (Array.isArray(result) && !('items' in result)) {
        // ServiceRegionHierarchyItem[]인 경우
        const flatItems: ServiceRegionListItem[] = [];
        (result as any[]).forEach((item: any) => {
          if (item.cities && Array.isArray(item.cities)) {
            flatItems.push(...item.cities);
          }
        });
        return { items: flatItems, total: flatItems.length, page: 1, limit: 100, total_pages: 1 } as ServiceRegionListResponse;
      }
      
      // ServiceRegionListResponse인 경우
      return result as ServiceRegionListResponse;
    },
    enabled: isInspector && isRegionModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: UserCreateRequest) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push('/admin/users');
    },
  });

  // 활동 지역 선택/해제 핸들러
  const handleRegionToggle = (region: ServiceRegionListItem) => {
    setSelectedRegions(prev => {
      const exists = prev.find(r => r.id === region.id);
      let newRegions: ServiceRegionListItem[];
      if (exists) {
        newRegions = prev.filter(r => r.id !== region.id);
      } else {
        newRegions = [...prev, region];
      }
      return newRegions;
    });
  };

  // 시/도 전체 선택 핸들러
  const handleProvinceSelectAll = (province: string) => {
    if (!regionsData || !('items' in regionsData)) return;
    
    const provinceRegions = regionsData.items.filter(r => r.province === province);
    const allSelected = provinceRegions.every(r => selectedRegions.find(sr => sr.id === r.id));
    
    let newRegions: ServiceRegionListItem[];
    if (allSelected) {
      // 모두 선택되어 있으면 해제
      newRegions = selectedRegions.filter(r => r.province !== province);
    } else {
      // 일부만 선택되어 있거나 선택 안 되어 있으면 모두 선택
      const newRegionsToAdd = provinceRegions.filter(r => !selectedRegions.find(sr => sr.id === r.id));
      newRegions = [...selectedRegions, ...newRegionsToAdd];
    }
    
    setSelectedRegions(newRegions);
    // 폼의 region_id 필드 업데이트 (첫 번째 선택된 지역의 ID)
    setValue('region_id', newRegions.length > 0 ? newRegions[0].id : '', { shouldValidate: true });
  };

  // 선택된 지역 제거 핸들러
  const handleRemoveRegion = (regionId: string) => {
    const newRegions = selectedRegions.filter(r => r.id !== regionId);
    setSelectedRegions(newRegions);
    // 폼의 region_id 필드 업데이트 (첫 번째 선택된 지역의 ID)
    setValue('region_id', newRegions.length > 0 ? newRegions[0].id : '', { shouldValidate: true });
  };

  const onSubmit = async (formData: UserCreateFormData) => {
    // 기사인 경우 활동 지역 필수 검증
    if (isInspector && selectedRegions.length === 0) {
      alert('활동 지역을 최소 1개 이상 선택해주세요');
      return;
    }

    try {
      // 선택된 모든 지역 ID를 배열로 전송
      const createData: UserCreateRequest = {
        role: formData.role,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        password: formData.password || null,
        region_ids: selectedRegions.length > 0 ? selectedRegions.map(r => r.id) : undefined,
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

  // 등급 설명
  const levelDescriptions: Record<number, string> = {
    1: '신입 기사 - 초보 기사',
    2: '주니어 기사 - 경험 있는 기사',
    3: '시니어 기사 - 숙련된 기사',
    4: '마스터 기사 - 전문 기사',
    5: '엘리트 기사 - 최고 전문 기사',
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
                />
                {watch('level') && (
                  <p className="mt-1 text-xs text-gray-500">
                    {levelDescriptions[watch('level') as number] || ''}
                  </p>
                )}
                {errors.level && <p className="mt-1 text-sm text-red-600">{errors.level.message}</p>}
                <div className="mt-2 text-xs text-gray-500">
                  <p className="font-medium mb-1">등급 안내:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>1등급: 신입 기사</li>
                    <li>2등급: 주니어 기사</li>
                    <li>3등급: 시니어 기사</li>
                    <li>4등급: 마스터 기사</li>
                    <li>5등급: 엘리트 기사</li>
                  </ul>
                </div>
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
                />
                {errors.commission_rate && (
                  <p className="mt-1 text-sm text-red-600">{errors.commission_rate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="region_id" className="block text-sm font-medium text-gray-700">
                  활동 지역 * ({selectedRegions.length}개 선택됨)
                </label>
                <input
                  {...register('region_id')}
                  type="hidden"
                  id="region_id"
                />
                <div className="mt-1 space-y-2">
                  {selectedRegions.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {selectedRegions.map((region) => (
                        <div
                          key={region.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {region.province} - {region.city}
                            </p>
                            <p className="text-xs text-gray-500">
                              추가 요금: {new Intl.NumberFormat('ko-KR').format(region.extra_fee)}원
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRegion(region.id)}
                            className="ml-2 text-sm text-red-600 hover:text-red-800"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsRegionModalOpen(true)}
                    className="w-full px-4 py-2 text-left border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {selectedRegions.length > 0 ? '활동 지역 추가/수정하기' : '활동 지역 선택하기'}
                  </button>
                </div>
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

      {/* 활동 지역 선택 모달 */}
      {isRegionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">활동 지역 선택</h2>
              <button
                onClick={() => setIsRegionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 검색 및 필터 */}
            <div className="mb-4 space-y-2">
              <input
                type="text"
                placeholder="지역 검색 (예: 서울, 강남구)"
                value={regionSearchQuery}
                onChange={(e) => setRegionSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
              />
              <select
                value={regionProvinceFilter}
                onChange={(e) => setRegionProvinceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
              >
                <option value="all">전체 지역</option>
                <option value="서울특별시">서울특별시</option>
                <option value="경기도">경기도</option>
                <option value="인천광역시">인천광역시</option>
                <option value="부산광역시">부산광역시</option>
                <option value="대구광역시">대구광역시</option>
                <option value="광주광역시">광주광역시</option>
                <option value="대전광역시">대전광역시</option>
                <option value="울산광역시">울산광역시</option>
                <option value="세종특별자치시">세종특별자치시</option>
                <option value="강원도">강원도</option>
                <option value="충청북도">충청북도</option>
                <option value="충청남도">충청남도</option>
                <option value="전라북도">전라북도</option>
                <option value="전라남도">전라남도</option>
                <option value="경상북도">경상북도</option>
                <option value="경상남도">경상남도</option>
                <option value="제주특별자치도">제주특별자치도</option>
              </select>
            </div>

            {/* 지역 목록 */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md">
              {isLoadingRegions ? (
                <div className="p-8 text-center text-gray-500">로딩 중...</div>
              ) : regionsError ? (
                <div className="p-8 text-center text-red-500">
                  <p>지역 목록을 불러오는 중 오류가 발생했습니다.</p>
                  <p className="text-xs mt-2">{(regionsError as Error).message}</p>
                </div>
              ) : regionsData && 'items' in regionsData && regionsData.items.length > 0 ? (
                (() => {
                  // 시/도별로 그룹화
                  const groupedByProvince = regionsData.items.reduce((acc, region) => {
                    if (!acc[region.province]) {
                      acc[region.province] = [];
                    }
                    acc[region.province].push(region);
                    return acc;
                  }, {} as Record<string, ServiceRegionListItem[]>);

                  return (
                    <div className="divide-y divide-gray-200">
                      {Object.entries(groupedByProvince).map(([province, regions]) => {
                        const allSelected = regions.every(r => selectedRegions.find(sr => sr.id === r.id));
                        const someSelected = regions.some(r => selectedRegions.find(sr => sr.id === r.id));
                        
                        return (
                          <div key={province} className="border-b border-gray-300">
                            {/* 시/도 헤더 */}
                            <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-900">{province}</span>
                              <button
                                type="button"
                                onClick={() => handleProvinceSelectAll(province)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                {allSelected ? '전체 해제' : '전체 선택'}
                              </button>
                            </div>
                            {/* 시/구 목록 */}
                            <div className="divide-y divide-gray-100">
                              {regions.map((region) => {
                                const isSelected = selectedRegions.find(sr => sr.id === region.id);
                                return (
                                  <label
                                    key={region.id}
                                    className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!isSelected}
                                      onChange={() => handleRegionToggle(region)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <div className="ml-3 flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {region.city}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        추가 요금: {new Intl.NumberFormat('ko-KR').format(region.extra_fee)}원
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="p-8 text-center text-gray-500">
                  {regionSearchQuery || regionProvinceFilter !== 'all' 
                    ? '검색 결과가 없습니다' 
                    : '등록된 활동 지역이 없습니다'}
                </div>
              )}
            </div>

            {/* 선택 완료 버튼 */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedRegions.length}개 지역 선택됨
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRegions([]);
                    setValue('region_id', '', { shouldValidate: true });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  전체 해제
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegionModalOpen(false)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  선택 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

