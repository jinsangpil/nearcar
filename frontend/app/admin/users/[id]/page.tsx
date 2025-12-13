'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getUserDetail, updateUser, UserDetail, UserUpdateRequest, getServiceRegions, ServiceRegionListItem, ServiceRegionListResponse } from '@/lib/api/admin';
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
  level: z.number().min(1).max(5).nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
}).refine((data) => {
  // 기사인 경우 등급, 수수료율 필수 (활동 지역은 selectedRegions로 검증)
  if (data.level !== null && data.level !== undefined) {
    return data.commission_rate !== null && data.commission_rate !== undefined;
  }
  return true;
}, {
  message: '기사는 등급, 수수료율이 모두 필요합니다',
  path: ['level'],
});

type UserUpdateFormData = z.infer<typeof userUpdateSchema>;

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  
  // 활동 지역 선택 모달 상태
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<ServiceRegionListItem[]>([]);
  const [regionSearchQuery, setRegionSearchQuery] = useState('');
  const [regionProvinceFilter, setRegionProvinceFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => getUserDetail(userId),
  });

  // 서비스 지역 목록 조회 (모달용)
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
      const result = await getServiceRegions(params);
      if (Array.isArray(result) && !('items' in result)) {
        const flatItems: ServiceRegionListItem[] = [];
        (result as any[]).forEach((item: any) => {
          if (item.cities && Array.isArray(item.cities)) {
            flatItems.push(...item.cities);
          }
        });
        return { items: flatItems, total: flatItems.length, page: 1, limit: 100, total_pages: 1 } as ServiceRegionListResponse;
      }
      return result as ServiceRegionListResponse;
    },
    enabled: isRegionModalOpen && data?.role === 'inspector',
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
    setValue,
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
  });

  // 데이터가 로드되면 폼 초기화 및 선택된 지역 설정
  useEffect(() => {
    if (data && !isEditing) {
      // commission_rate를 0~1 범위에서 0~100 범위로 변환
      const commissionRatePercent = data.commission_rate !== null && data.commission_rate !== undefined
        ? data.commission_rate * 100
        : null;

      reset({
        name: data.name,
        email: data.email || '',
        phone: data.phone,
        password: '',
        level: data.level || null,
        commission_rate: commissionRatePercent,
        status: data.status as 'active' | 'inactive' | 'suspended',
      });
      
      // region_ids가 있으면 해당 지역들을 조회하여 selectedRegions 설정
      if (data.region_ids && data.region_ids.length > 0) {
        // 모든 지역을 한 번에 조회
        getServiceRegions({ is_active: true, limit: 100, page: 1, hierarchy: false }).then(result => {
          if ('items' in result) {
            const matchedRegions = result.items.filter(r => data.region_ids!.includes(r.id));
            setSelectedRegions(matchedRegions);
          }
        }).catch(() => {
          setSelectedRegions([]);
        });
      } else {
        setSelectedRegions([]);
      }
    }
  }, [data, isEditing, reset]);

  // 활동 지역 선택/해제 핸들러
  const handleRegionToggle = (region: ServiceRegionListItem) => {
    setSelectedRegions(prev => {
      const exists = prev.find(r => r.id === region.id);
      if (exists) {
        return prev.filter(r => r.id !== region.id);
      } else {
        return [...prev, region];
      }
    });
  };

  // 시/도 전체 선택 핸들러
  const handleProvinceSelectAll = (province: string) => {
    if (!regionsData || !('items' in regionsData)) return;
    
    const provinceRegions = regionsData.items.filter(r => r.province === province);
    const allSelected = provinceRegions.every(r => selectedRegions.find(sr => sr.id === r.id));
    
    if (allSelected) {
      setSelectedRegions(prev => prev.filter(r => r.province !== province));
    } else {
      const newRegionsToAdd = provinceRegions.filter(r => !selectedRegions.find(sr => sr.id === r.id));
      setSelectedRegions(prev => [...prev, ...newRegionsToAdd]);
    }
  };

  // 선택된 지역 제거 핸들러
  const handleRemoveRegion = (regionId: string) => {
    setSelectedRegions(prev => prev.filter(r => r.id !== regionId));
  };

  const onSubmit = async (formData: UserUpdateFormData) => {
    // 기사인 경우 활동 지역 필수 검증
    if (data?.role === 'inspector' && selectedRegions.length === 0) {
      alert('활동 지역을 최소 1개 이상 선택해주세요');
      return;
    }

    // commission_rate를 0~100 범위에서 0~1 범위로 변환
    const commissionRateDecimal = formData.commission_rate !== null && formData.commission_rate !== undefined
      ? formData.commission_rate / 100
      : null;

    const updateData: UserUpdateRequest = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone,
      password: formData.password || null,
      region_ids: data?.role === 'inspector' ? selectedRegions.map(r => r.id) : undefined,
      level: formData.level || null,
      commission_rate: commissionRateDecimal,
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
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
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
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
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
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
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
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
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
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                  !isEditing ? 'bg-gray-50' : 'bg-white'
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
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 ${
                    !isEditing ? 'bg-gray-50' : 'bg-white'
                  }`}
                />
                {errors.level && <p className="mt-1 text-sm text-red-600">{errors.level.message}</p>}
              </div>

              <div>
                <label htmlFor="commission_rate" className="block text-sm font-medium text-gray-700">
                  수수료율 (0~100%) *
                </label>
                {isEditing ? (
                  <input
                    {...register('commission_rate', { valueAsNumber: true })}
                    type="number"
                    id="commission_rate"
                    min="0"
                    max="100"
                    step="0.1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base py-2.5 px-3 text-gray-900 bg-white"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900">
                    {data.commission_rate !== null && data.commission_rate !== undefined
                      ? `${(data.commission_rate * 100).toFixed(1)}%`
                      : '-'}
                  </div>
                )}
                {errors.commission_rate && (
                  <p className="mt-1 text-sm text-red-600">{errors.commission_rate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="region_ids" className="block text-sm font-medium text-gray-700">
                  활동 지역 * ({selectedRegions.length}개 선택됨)
                </label>
                <div className="mt-1 space-y-2">
                  {!isEditing ? (
                    // 읽기 모드: 선택된 모든 지역 표시
                    selectedRegions.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                        {selectedRegions.map((region) => (
                          <div
                            key={region.id}
                            className="p-2 bg-gray-50 rounded"
                          >
                            <p className="text-sm font-medium text-gray-900">
                              {region.province} - {region.city}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              추가 요금: {new Intl.NumberFormat('ko-KR').format(region.extra_fee)}원
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">선택된 지역이 없습니다</span>
                    )
                  ) : (
                    // 편집 모드: 선택된 지역 목록 및 선택 버튼
                    <>
                      {selectedRegions.length > 0 && (
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
                      )}
                      <button
                        type="button"
                        onClick={() => setIsRegionModalOpen(true)}
                        className="w-full px-4 py-2 text-left border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {selectedRegions.length > 0 ? '활동 지역 추가/수정하기' : '활동 지역 선택하기'}
                      </button>
                    </>
                  )}
                </div>
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

      {/* 활동 지역 선택 모달 */}
      {isEditing && isRegionModalOpen && (
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
                  onClick={() => setSelectedRegions([])}
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

