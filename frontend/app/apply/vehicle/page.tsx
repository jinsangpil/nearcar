'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useInspectionStore } from '@/stores/inspectionStore';
import {
  getManufacturers,
  getModelGroups,
  getVehicleModels,
  getVehicleModelDetail,
  lookupVehicleByPlate,
  type Manufacturer,
  type ModelGroup,
  type VehicleModel,
} from '@/lib/api/vehicles';

export default function VehicleInfoPage() {
  const router = useRouter();
  const { vehicleInfo, setVehicleInfo, setCurrentStep } = useInspectionStore();
  
  // 폼 상태
  const [plateNumber, setPlateNumber] = useState(vehicleInfo.plate_number || '');
  const [origin, setOrigin] = useState<'domestic' | 'imported' | ''>(vehicleInfo.origin || '');
  const [selectedManufacturer, setSelectedManufacturer] = useState(vehicleInfo.manufacturer || '');
  const [selectedModelGroup, setSelectedModelGroup] = useState(vehicleInfo.model_group || '');
  const [selectedModelId, setSelectedModelId] = useState(vehicleInfo.model_id || '');
  const [year, setYear] = useState(vehicleInfo.year?.toString() || '');
  const [mileage, setMileage] = useState(vehicleInfo.mileage?.toString() || '');
  
  // 로딩 상태
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  
  // 제조사 목록 조회
  const { data: manufacturers = [], isLoading: isLoadingManufacturers } = useQuery({
    queryKey: ['manufacturers', origin],
    queryFn: () => getManufacturers(origin || undefined),
    enabled: !!origin,
  });
  
  // 모델 그룹 목록 조회
  const { data: modelGroups = [], isLoading: isLoadingModelGroups } = useQuery({
    queryKey: ['modelGroups', selectedManufacturer, origin],
    queryFn: () => getModelGroups(selectedManufacturer, origin || undefined),
    enabled: !!selectedManufacturer && !!origin,
  });
  
  // 차량 모델 목록 조회
  const { data: vehicleModels = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ['vehicleModels', selectedManufacturer, selectedModelGroup, origin],
    queryFn: () => getVehicleModels(selectedManufacturer, selectedModelGroup, origin || undefined),
    enabled: !!selectedManufacturer && !!selectedModelGroup && !!origin,
  });
  
  // 선택된 모델 상세 정보 조회
  const { data: modelDetail, isLoading: isLoadingModelDetail } = useQuery({
    queryKey: ['vehicleModelDetail', selectedModelId],
    queryFn: () => getVehicleModelDetail(selectedModelId),
    enabled: !!selectedModelId,
  });
  
  // 차량번호 조회
  const handleLookupPlate = async () => {
    if (!plateNumber.trim()) {
      setLookupError('차량번호를 입력해주세요');
      return;
    }
    
    setIsLookingUp(true);
    setLookupError(null);
    
    try {
      const result = await lookupVehicleByPlate(plateNumber.trim());
      // TODO: 국토교통부 API 연동 후 실제 차량 정보로 폼 자동 채우기
      // 현재는 메시지만 표시
      alert('차량번호 조회 기능은 추후 구현 예정입니다. 수동으로 입력해주세요.');
    } catch (error: any) {
      setLookupError(error.message || '차량번호 조회에 실패했습니다');
    } finally {
      setIsLookingUp(false);
    }
  };
  
  // 제조사 변경 시 하위 선택 초기화
  useEffect(() => {
    if (!selectedManufacturer) {
      setSelectedModelGroup('');
      setSelectedModelId('');
    }
  }, [selectedManufacturer]);
  
  // 모델 그룹 변경 시 모델 초기화
  useEffect(() => {
    if (!selectedModelGroup) {
      setSelectedModelId('');
    }
  }, [selectedModelGroup]);
  
  // 모델 선택 시 상세 정보 업데이트
  useEffect(() => {
    if (modelDetail) {
      setYear(modelDetail.start_year.toString());
    }
  }, [modelDetail]);
  
  // 다음 단계로 진행
  const handleNext = () => {
    // 유효성 검사
    if (!origin) {
      alert('국산/수입을 선택해주세요');
      return;
    }
    if (!selectedManufacturer) {
      alert('제조사를 선택해주세요');
      return;
    }
    if (!selectedModelGroup) {
      alert('모델 그룹을 선택해주세요');
      return;
    }
    if (!selectedModelId) {
      alert('모델을 선택해주세요');
      return;
    }
    if (!year) {
      alert('연식을 입력해주세요');
      return;
    }
    
    // 상태 저장
    setVehicleInfo({
      plate_number: plateNumber.trim() || undefined,
      origin: origin as 'domestic' | 'imported',
      manufacturer: selectedManufacturer,
      model_group: selectedModelGroup,
      model_id: selectedModelId,
      model_detail: vehicleModels.find(m => m.id === selectedModelId)?.model_detail,
      vehicle_class: modelDetail?.vehicle_class,
      year: parseInt(year),
      mileage: mileage ? parseInt(mileage) : undefined,
    });
    
    // 다음 단계로 이동
    setCurrentStep(2);
    router.push('/apply/quote');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">차량 정보 입력</h1>
          <p className="text-gray-600">진단을 받을 차량의 정보를 입력해주세요</p>
        </div>
        
        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                1
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">차량 정보</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-500 font-semibold">
                2
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">견적 및 옵션</span>
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
        
        {/* 폼 */}
        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          <div className="space-y-6">
            {/* 차량번호 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                차량번호 (선택)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="예: 12가3456"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base"
                />
                <button
                  type="button"
                  onClick={handleLookupPlate}
                  disabled={isLookingUp || !plateNumber.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  {isLookingUp ? '조회 중...' : '조회'}
                </button>
              </div>
              {lookupError && (
                <p className="mt-1 text-sm text-red-600">{lookupError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                차량번호를 입력하면 자동으로 차량 정보를 불러올 수 있습니다 (추후 구현 예정)
              </p>
            </div>
            
            {/* 국산/수입 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                국산/수입 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('domestic');
                    setSelectedManufacturer('');
                    setSelectedModelGroup('');
                    setSelectedModelId('');
                  }}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                    origin === 'domestic'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  국산차
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('imported');
                    setSelectedManufacturer('');
                    setSelectedModelGroup('');
                    setSelectedModelId('');
                  }}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                    origin === 'imported'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  수입차
                </button>
              </div>
            </div>
            
            {/* 제조사 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제조사 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedManufacturer}
                onChange={(e) => {
                  setSelectedManufacturer(e.target.value);
                  setSelectedModelGroup('');
                  setSelectedModelId('');
                }}
                disabled={!origin || isLoadingManufacturers}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">제조사를 선택해주세요</option>
                {manufacturers.map((mfg) => (
                  <option key={mfg.name} value={mfg.name}>
                    {mfg.name}
                  </option>
                ))}
              </select>
              {isLoadingManufacturers && (
                <p className="mt-1 text-xs text-gray-500">제조사 목록을 불러오는 중...</p>
              )}
            </div>
            
            {/* 모델 그룹 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                모델 그룹 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedModelGroup}
                onChange={(e) => {
                  setSelectedModelGroup(e.target.value);
                  setSelectedModelId('');
                }}
                disabled={!selectedManufacturer || isLoadingModelGroups}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">모델 그룹을 선택해주세요</option>
                {modelGroups.map((group) => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
              {isLoadingModelGroups && (
                <p className="mt-1 text-xs text-gray-500">모델 그룹 목록을 불러오는 중...</p>
              )}
            </div>
            
            {/* 모델 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                모델 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                disabled={!selectedModelGroup || isLoadingModels}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">모델을 선택해주세요</option>
                {vehicleModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model_detail || model.model_group}
                  </option>
                ))}
              </select>
              {isLoadingModels && (
                <p className="mt-1 text-xs text-gray-500">모델 목록을 불러오는 중...</p>
              )}
            </div>
            
            {/* 연식 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                연식 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="예: 2020"
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base"
              />
              {modelDetail && (
                <p className="mt-1 text-xs text-gray-500">
                  출시 연도: {modelDetail.start_year}년
                  {modelDetail.end_year && ` ~ ${modelDetail.end_year}년`}
                </p>
              )}
            </div>
            
            {/* 주행거리 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주행거리 (선택)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="예: 50000"
                  min="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  km
                </span>
              </div>
            </div>
            
            {/* 버튼 */}
            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                다음 단계
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

