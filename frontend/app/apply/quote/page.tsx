'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useInspectionStore } from '@/stores/inspectionStore';
import {
  getPackages,
  getRegions,
  calculateQuote,
  type Package,
  type RegionHierarchy,
  type QuoteCalculateResponse,
} from '@/lib/api/quotes';

export default function QuotePage() {
  const router = useRouter();
  const { vehicleInfo, quoteInfo, setQuoteInfo, setCurrentStep } = useInspectionStore();
  
  // 폼 상태
  const [selectedProvince, setSelectedProvince] = useState(quoteInfo.province || '');
  const [selectedCityId, setSelectedCityId] = useState(quoteInfo.region_id || '');
  const [selectedPackageId, setSelectedPackageId] = useState(quoteInfo.package_id || '');
  
  // 견적 정보
  const [quote, setQuote] = useState<QuoteCalculateResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // 패키지 목록 조회
  const { data: packages = [], isLoading: isLoadingPackages } = useQuery({
    queryKey: ['packages'],
    queryFn: getPackages,
  });
  
  // 지역 목록 조회
  const { data: regions = [], isLoading: isLoadingRegions } = useQuery({
    queryKey: ['regions'],
    queryFn: getRegions,
  });
  
  // 선택된 시/도의 시/구/군 목록
  const availableCities = useMemo(() => {
    if (!selectedProvince) return [];
    const provinceData = regions.find(r => r.province === selectedProvince);
    return provinceData?.cities.filter(city => city.extra_fee !== undefined) || [];
  }, [selectedProvince, regions]);
  
  // 견적 계산 Mutation
  const calculateQuoteMutation = useMutation({
    mutationFn: calculateQuote,
    onSuccess: (data) => {
      setQuote(data);
      setQuoteInfo({
        region_id: selectedCityId,
        province: selectedProvince,
        city: availableCities.find(c => c.id === selectedCityId)?.city,
        package_id: selectedPackageId,
        base_price: data.base_price,
        vehicle_surcharge: data.class_surcharge,
        region_surcharge: data.region_fee,
        total_amount: data.total_amount,
      });
    },
    onError: (error: any) => {
      alert(error.message || '견적 계산에 실패했습니다');
    },
  });
  
  // 선택된 옵션이 변경될 때마다 견적 자동 계산
  useEffect(() => {
    if (
      vehicleInfo.model_id &&
      selectedPackageId &&
      selectedCityId
    ) {
      // vehicle_master_id는 model_id를 사용 (실제로는 vehicle_master_id가 필요하지만, 
      // 현재 구조에서는 model_id를 사용)
      // TODO: vehicle_master_id를 올바르게 매핑하는 로직 필요
      const vehicleMasterId = vehicleInfo.model_id; // 임시로 model_id 사용
      
      setIsCalculating(true);
      calculateQuoteMutation.mutate(
        {
          vehicle_master_id: vehicleMasterId,
          package_id: selectedPackageId,
          region_id: selectedCityId,
        },
        {
          onSettled: () => {
            setIsCalculating(false);
          },
        }
      );
    } else {
      setQuote(null);
    }
  }, [vehicleInfo.model_id, selectedPackageId, selectedCityId]);
  
  // 시/도 선택 시 시/구/군 초기화
  useEffect(() => {
    if (selectedProvince) {
      setSelectedCityId('');
    }
  }, [selectedProvince]);
  
  // 이전 단계로 이동
  const handleBack = () => {
    setCurrentStep(1);
    router.push('/apply/vehicle');
  };
  
  // 다음 단계로 진행
  const handleNext = () => {
    // 유효성 검사
    if (!selectedProvince) {
      alert('시/도를 선택해주세요');
      return;
    }
    if (!selectedCityId) {
      alert('시/구/군을 선택해주세요');
      return;
    }
    if (!selectedPackageId) {
      alert('패키지를 선택해주세요');
      return;
    }
    if (!quote) {
      alert('견적을 계산해주세요');
      return;
    }
    
    // 다음 단계로 이동
    setCurrentStep(3);
    router.push('/apply/schedule');
  };
  
  // 선택된 패키지 정보
  const selectedPackage = packages.find(pkg => pkg.id === selectedPackageId);
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">견적 및 옵션 선택</h1>
          <p className="text-gray-600">지역과 패키지를 선택하고 견적을 확인해주세요</p>
        </div>
        
        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">차량 정보</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                2
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">견적 및 옵션</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-500 font-semibold">
                3
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">일정 선택</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 옵션 선택 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 지역 선택 */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">서비스 지역</h2>
              <div className="space-y-4">
                {/* 시/도 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시/도 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => setSelectedProvince(e.target.value)}
                    disabled={isLoadingRegions}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">시/도를 선택해주세요</option>
                    {regions.map((region) => (
                      <option key={region.province} value={region.province}>
                        {region.province}
                      </option>
                    ))}
                  </select>
                  {isLoadingRegions && (
                    <p className="mt-1 text-xs text-gray-500">지역 목록을 불러오는 중...</p>
                  )}
                </div>
                
                {/* 시/구/군 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시/구/군 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCityId}
                    onChange={(e) => setSelectedCityId(e.target.value)}
                    disabled={!selectedProvince || availableCities.length === 0}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">시/구/군을 선택해주세요</option>
                    {availableCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.city} {city.extra_fee > 0 && `(+${city.extra_fee.toLocaleString()}원)`}
                      </option>
                    ))}
                  </select>
                  {!selectedProvince && (
                    <p className="mt-1 text-xs text-gray-500">먼저 시/도를 선택해주세요</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* 패키지 선택 */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">진단 패키지</h2>
              {isLoadingPackages ? (
                <p className="text-sm text-gray-500">패키지 목록을 불러오는 중...</p>
              ) : (
                <div className="space-y-3">
                  {packages.map((pkg) => (
                    <label
                      key={pkg.id}
                      className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedPackageId === pkg.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="package"
                        value={pkg.id}
                        checked={selectedPackageId === pkg.id}
                        onChange={(e) => setSelectedPackageId(e.target.value)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium text-gray-900">
                            {pkg.name}
                          </span>
                          <span className="text-lg font-bold text-indigo-600">
                            {pkg.base_price.toLocaleString()}원
                          </span>
                        </div>
                        {pkg.included_items && Object.keys(pkg.included_items).length > 0 && (
                          <p className="mt-1 text-sm text-gray-500">
                            포함 항목: {Object.keys(pkg.included_items).join(', ')}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* 오른쪽: 견적 요약 */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-md rounded-lg p-6 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">견적 요약</h2>
              
              {isCalculating ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-sm text-gray-500">견적 계산 중...</p>
                </div>
              ) : quote ? (
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">기본 가격</span>
                      <span className="text-gray-900">{quote.base_price.toLocaleString()}원</span>
                    </div>
                    {quote.class_surcharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">차종 할증</span>
                        <span className="text-gray-900">+{quote.class_surcharge.toLocaleString()}원</span>
                      </div>
                    )}
                    {quote.region_fee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">지역 출장비</span>
                        <span className="text-gray-900">+{quote.region_fee.toLocaleString()}원</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">총액</span>
                        <span className="text-xl font-bold text-indigo-600">
                          {quote.total_amount.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedPackage && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">선택된 패키지</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPackage.name}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    지역과 패키지를 선택하면<br />견적이 자동으로 계산됩니다
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 버튼 */}
        <div className="flex justify-between gap-4 mt-8">
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            이전 단계
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!quote}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            다음 단계
          </button>
        </div>
      </div>
    </div>
  );
}

