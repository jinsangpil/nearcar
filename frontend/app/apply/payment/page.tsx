'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useInspectionStore } from '@/stores/inspectionStore';
import { createInspection, type InspectionCreateRequest } from '@/lib/api/inspections';
import { requestPayment, type PaymentRequestResponse } from '@/lib/api/payments';
import { format } from 'date-fns';

export default function PaymentPage() {
  const router = useRouter();
  const {
    vehicleInfo,
    quoteInfo,
    scheduleInfo,
    authInfo,
    resetForm,
  } = useInspectionStore();
  
  // 상태
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentFormRef = useRef<HTMLFormElement>(null);
  
  // 진단 신청 생성 Mutation
  const createInspectionMutation = useMutation({
    mutationFn: createInspection,
    onError: (error: any) => {
      setError(error.message || '진단 신청 생성에 실패했습니다');
      setIsProcessing(false);
    },
  });
  
  // 결제 요청 Mutation
  const requestPaymentMutation = useMutation({
    mutationFn: requestPayment,
    onSuccess: (data: PaymentRequestResponse) => {
      // KCP 결제창 호출을 위한 form 생성 및 submit
      handleKcpPayment(data);
    },
    onError: (error: any) => {
      setError(error.message || '결제 요청에 실패했습니다');
      setIsProcessing(false);
    },
  });
  
  // KCP 결제창 호출
  const handleKcpPayment = (paymentData: PaymentRequestResponse) => {
    // KCP 결제창 호출을 위한 form 생성
    // KCP는 form submit 방식으로 결제창을 호출합니다
    // Mobile 버전: PayUrl로 form submit
    // PC 버전: PayUrl/jsp/encodingFilter/encodingFilter.jsp로 form submit
    
    if (!paymentFormRef.current) {
      setError('결제창을 호출할 수 없습니다.');
      setIsProcessing(false);
      return;
    }
    
    const form = paymentFormRef.current;
    
    // form action 설정 (KCP PayUrl 사용)
    // Mobile: PayUrl 그대로 사용
    // PC: PayUrl/jsp/encodingFilter/encodingFilter.jsp 사용
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    
    if (isMobile) {
      form.action = paymentData.pay_url;
    } else {
      // PC 버전: encodingFilter.jsp 사용
      const baseUrl = paymentData.pay_url.substring(0, paymentData.pay_url.lastIndexOf('/'));
      form.action = `${baseUrl}/jsp/encodingFilter/encodingFilter.jsp`;
    }
    
    form.method = 'POST';
    form.target = '_blank'; // 새 창에서 열기
    
    // 기존 input 제거
    while (form.firstChild) {
      form.removeChild(form.firstChild);
    }
    
    // KCP 결제창에 필요한 파라미터 추가
    const params: Record<string, string> = {
      site_cd: paymentData.site_cd || '',
      pay_method: paymentData.pay_method || 'CARD',
      currency: paymentData.currency || '410', // 원화
      shop_name: paymentData.shop_name || '중고차 진단 서비스',
      Ret_URL: `${window.location.origin}/apply/payment/callback`,
      approval_key: paymentData.approval_key,
      PayUrl: paymentData.pay_url,
      ordr_idxx: paymentData.order_id,
      good_name: '중고차 진단 서비스',
      good_cd: '00',
      good_mny: paymentData.amount.toString(),
      buyr_name: authInfo.phone || '고객',
    };
    
    // form에 hidden input 추가
    Object.entries(params).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });
    
    // form submit
    form.submit();
    
    // 결제 진행 완료 (실제 결제는 KCP 결제창에서 처리)
    setIsProcessing(false);
  };
  
  // 결제 진행 버튼 클릭
  const handlePayment = async () => {
    // 유효성 검사
    if (!vehicleInfo.model_id) {
      alert('차량 정보가 없습니다. 처음부터 다시 진행해주세요.');
      router.push('/apply/vehicle');
      return;
    }
    if (!quoteInfo.package_id || !quoteInfo.region_id || !quoteInfo.total_amount) {
      alert('견적 정보가 없습니다. 처음부터 다시 진행해주세요.');
      router.push('/apply/quote');
      return;
    }
    if (!scheduleInfo.date || !scheduleInfo.time) {
      alert('일정 정보가 없습니다. 처음부터 다시 진행해주세요.');
      router.push('/apply/schedule');
      return;
    }
    if (!authInfo.is_verified || !authInfo.phone) {
      alert('본인인증이 완료되지 않았습니다. 처음부터 다시 진행해주세요.');
      router.push('/apply/auth');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // 1. 진단 신청 생성
      const scheduleDateTime = new Date(`${scheduleInfo.date}T${scheduleInfo.time}`);
      
      const inspectionData: InspectionCreateRequest = {
        vehicle_master_id: vehicleInfo.model_id, // TODO: vehicle_master_id로 올바르게 매핑 필요
        plate_number: vehicleInfo.plate_number,
        year: vehicleInfo.year || new Date().getFullYear(),
        fuel_type: 'gasoline', // 기본값
        location_address: quoteInfo.city || '', // TODO: 실제 주소 입력 필요
        region_id: quoteInfo.region_id,
        preferred_schedule: scheduleDateTime.toISOString(),
        package_id: quoteInfo.package_id,
        total_amount: quoteInfo.total_amount || 0,
        mileage: vehicleInfo.mileage,
      };
      
      const inspectionResult = await createInspectionMutation.mutateAsync(inspectionData);
      
      // 2. 결제 요청
      await requestPaymentMutation.mutateAsync({
        inspection_id: inspectionResult.inspection_id,
        amount: quoteInfo.total_amount || 0,
        customer_info: {
          phone: authInfo.phone,
        },
      });
    } catch (err: any) {
      setError(err.message || '결제 진행 중 오류가 발생했습니다');
      setIsProcessing(false);
    }
  };
  
  // 이전 단계로 이동
  const handleBack = () => {
    router.push('/apply/auth');
  };
  
  // 최종 금액 계산
  const finalAmount = quoteInfo.total_amount || 0;
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">결제</h1>
          <p className="text-gray-600">최종 금액을 확인하고 결제를 진행해주세요</p>
        </div>
        
        {/* 진행 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-xs font-medium text-gray-500">차량 정보</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-1"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-xs font-medium text-gray-500">견적 및 옵션</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-1"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-xs font-medium text-gray-500">일정 선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-1"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-sm">
                ✓
              </div>
              <span className="ml-2 text-xs font-medium text-gray-500">본인 인증</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-1"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-sm">
                5
              </div>
              <span className="ml-2 text-xs font-medium text-gray-900">결제</span>
            </div>
          </div>
        </div>
        
        {/* 주문 요약 */}
        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 요약</h2>
          
          <div className="space-y-4">
            {/* 차량 정보 */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">차량 정보</h3>
              <div className="text-sm text-gray-600 space-y-1">
                {vehicleInfo.manufacturer && vehicleInfo.model_group && (
                  <p>
                    {vehicleInfo.manufacturer} {vehicleInfo.model_group}
                    {vehicleInfo.model_detail && ` ${vehicleInfo.model_detail}`}
                  </p>
                )}
                {vehicleInfo.year && <p>연식: {vehicleInfo.year}년</p>}
                {vehicleInfo.plate_number && <p>차량번호: {vehicleInfo.plate_number}</p>}
              </div>
            </div>
            
            {/* 서비스 정보 */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">서비스 정보</h3>
              <div className="text-sm text-gray-600 space-y-1">
                {quoteInfo.city && <p>지역: {quoteInfo.province} {quoteInfo.city}</p>}
                {scheduleInfo.date && scheduleInfo.time && (
                  <p>
                    일정: {format(new Date(scheduleInfo.date), 'yyyy년 MM월 dd일')} {scheduleInfo.time}
                  </p>
                )}
              </div>
            </div>
            
            {/* 결제 금액 */}
            <div className="pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">기본 가격</span>
                <span className="text-sm text-gray-900">
                  {quoteInfo.base_price?.toLocaleString() || 0}원
                </span>
              </div>
              {quoteInfo.vehicle_surcharge && quoteInfo.vehicle_surcharge > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">차종 할증</span>
                  <span className="text-sm text-gray-900">
                    +{quoteInfo.vehicle_surcharge.toLocaleString()}원
                  </span>
                </div>
              )}
              {quoteInfo.region_surcharge && quoteInfo.region_surcharge > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">지역 출장비</span>
                  <span className="text-sm text-gray-900">
                    +{quoteInfo.region_surcharge.toLocaleString()}원
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">총 결제 금액</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {finalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 결제 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            결제 버튼을 클릭하시면 KCP 결제창이 새 창에서 열립니다.
            결제 완료 후 자동으로 완료 페이지로 이동합니다.
          </p>
        </div>
        
        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        
        {/* 버튼 */}
        <div className="flex justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={isProcessing}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
          >
            이전 단계
          </button>
          <button
            type="button"
            onClick={handlePayment}
            disabled={isProcessing || finalAmount === 0}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                결제 진행 중...
              </span>
            ) : (
              `${finalAmount.toLocaleString()}원 결제하기`
            )}
          </button>
        </div>
        
        {/* KCP 결제창 호출을 위한 숨겨진 form */}
        <form ref={paymentFormRef} method="POST" target="_blank" style={{ display: 'none' }}>
          {/* 동적으로 파라미터가 추가됩니다 */}
        </form>
      </div>
    </div>
  );
}

