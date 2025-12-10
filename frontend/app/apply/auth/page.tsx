'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useInspectionStore } from '@/stores/inspectionStore';
import {
  requestVerification,
  confirmVerification,
  sendVerificationCode,
  type VerificationRequestResponse,
  type VerificationConfirmResponse,
} from '@/lib/api/verification';

export default function AuthPage() {
  const router = useRouter();
  const { authInfo, setAuthInfo, setCurrentStep } = useInspectionStore();
  
  // 폼 상태
  const [phone, setPhone] = useState(authInfo.phone || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(authInfo.is_verified || false);
  
  // 동의 체크박스
  const [privacyAgreed, setPrivacyAgreed] = useState(authInfo.privacy_agreed || false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  
  // 타이머 상태
  const [timer, setTimer] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // KCP 본인인증 팝업 참조
  const kcpWindowRef = useRef<Window | null>(null);
  
  // 본인인증 요청 Mutation
  const requestVerificationMutation = useMutation({
    mutationFn: requestVerification,
    onSuccess: (data) => {
      setVerificationId(data.verification_id);
      
      // KCP 본인인증 팝업이 있는 경우
      if (data.redirect_url) {
        // 팝업 창 열기
        const width = 500;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        kcpWindowRef.current = window.open(
          data.redirect_url,
          'KCP본인인증',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        // 팝업 메시지 리스너 (KCP 본인인증 완료 후)
        const handleMessage = (event: MessageEvent) => {
          // 보안: origin 검증 필요 (실제 구현 시 KCP 도메인으로 제한)
          if (event.data && event.data.type === 'KCP_VERIFICATION_SUCCESS') {
            handleKcpVerificationSuccess(event.data);
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // 팝업이 닫혔는지 확인
        const checkClosed = setInterval(() => {
          if (kcpWindowRef.current?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
          }
        }, 1000);
      } else {
        // SMS 인증번호 발송 방식
        sendCodeMutation.mutate(phone);
      }
    },
    onError: (error: any) => {
      alert(error.message || '본인인증 요청에 실패했습니다');
    },
  });
  
  // SMS 인증번호 발송 Mutation
  const sendCodeMutation = useMutation({
    mutationFn: sendVerificationCode,
    onSuccess: () => {
      setTimer(180); // 3분 타이머 시작
      alert('인증번호가 발송되었습니다');
    },
    onError: (error: any) => {
      alert(error.message || '인증번호 발송에 실패했습니다');
    },
  });
  
  // 본인인증 확인 Mutation
  const confirmVerificationMutation = useMutation({
    mutationFn: confirmVerification,
    onSuccess: (data: VerificationConfirmResponse) => {
      setIsVerified(true);
      setAuthInfo({
        phone: data.phone,
        is_verified: true,
        privacy_agreed: privacyAgreed,
      });
      alert('본인인증이 완료되었습니다');
    },
    onError: (error: any) => {
      alert(error.message || '본인인증 확인에 실패했습니다');
    },
  });
  
  // KCP 본인인증 성공 처리
  const handleKcpVerificationSuccess = (data: any) => {
    if (verificationId) {
      confirmVerificationMutation.mutate({
        verification_id: verificationId,
        kcp_result: data.result,
      });
    }
    if (kcpWindowRef.current) {
      kcpWindowRef.current.close();
    }
  };
  
  // 인증번호 요청 버튼 클릭
  const handleRequestVerification = () => {
    // 휴대폰 번호 유효성 검사
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    const cleanPhone = phone.replace(/-/g, '');
    
    if (!phoneRegex.test(phone) && cleanPhone.length !== 11) {
      alert('올바른 휴대폰 번호를 입력해주세요');
      return;
    }
    
    requestVerificationMutation.mutate({ phone: cleanPhone });
  };
  
  // 인증번호 확인 버튼 클릭
  const handleConfirmCode = () => {
    if (!verificationCode.trim()) {
      alert('인증번호를 입력해주세요');
      return;
    }
    
    if (!verificationId) {
      alert('먼저 인증번호를 요청해주세요');
      return;
    }
    
    confirmVerificationMutation.mutate({
      verification_id: verificationId,
      auth_code: verificationCode,
    });
  };
  
  // 타이머 관리
  useEffect(() => {
    if (timer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timer]);
  
  // 다음 단계로 진행
  const handleNext = () => {
    if (!isVerified) {
      alert('본인인증을 완료해주세요');
      return;
    }
    if (!privacyAgreed) {
      alert('개인정보 수집 및 이용에 동의해주세요');
      return;
    }
    
    // 다음 단계로 이동
    setCurrentStep(5);
    router.push('/apply/payment');
  };
  
  // 이전 단계로 이동
  const handleBack = () => {
    setCurrentStep(3);
    router.push('/apply/schedule');
  };
  
  // 타이머 포맷 (MM:SS)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">본인 인증</h1>
          <p className="text-gray-600">휴대폰 번호로 본인인증을 진행해주세요</p>
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
            <div className="flex-1 h-0.5 bg-indigo-600 mx-2"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">견적 및 옵션</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-2"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">일정 선택</span>
            </div>
            <div className="flex-1 h-0.5 bg-indigo-600 mx-2"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold">
                4
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">본인 인증</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-500 font-semibold">
                5
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">결제</span>
            </div>
          </div>
        </div>
        
        {/* 본인인증 폼 */}
        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          {!isVerified ? (
            <div className="space-y-6">
              {/* 휴대폰 번호 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  휴대폰 번호 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9-]/g, '');
                      // 자동 하이픈 추가
                      const formatted = value.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
                      setPhone(formatted);
                    }}
                    placeholder="010-1234-5678"
                    maxLength={13}
                    disabled={isVerified}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleRequestVerification}
                    disabled={
                      !phone ||
                      requestVerificationMutation.isPending ||
                      sendCodeMutation.isPending
                    }
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                  >
                    {requestVerificationMutation.isPending || sendCodeMutation.isPending
                      ? '요청 중...'
                      : '인증 요청'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  KCP 본인인증 또는 SMS 인증번호를 통해 본인인증을 진행합니다
                </p>
              </div>
              
              {/* 인증번호 입력 (SMS 방식인 경우) */}
              {verificationId && !requestVerificationMutation.data?.redirect_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인증번호 <span className="text-red-500">*</span>
                    {timer > 0 && (
                      <span className="ml-2 text-sm text-red-600 font-medium">
                        ({formatTimer(timer)})
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setVerificationCode(value);
                      }}
                      placeholder="인증번호 6자리"
                      maxLength={6}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-base"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmCode}
                      disabled={
                        !verificationCode ||
                        verificationCode.length !== 6 ||
                        confirmVerificationMutation.isPending ||
                        timer === 0
                      }
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                    >
                      {confirmVerificationMutation.isPending ? '확인 중...' : '확인'}
                    </button>
                  </div>
                  {timer === 0 && timer > -1 && (
                    <p className="mt-1 text-xs text-red-600">
                      인증 시간이 만료되었습니다. 다시 요청해주세요.
                    </p>
                  )}
                </div>
              )}
              
              {/* KCP 본인인증 안내 */}
              {requestVerificationMutation.data?.redirect_url && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    KCP 본인인증 팝업이 열렸습니다. 팝업에서 본인인증을 완료해주세요.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">본인인증이 완료되었습니다</p>
              <p className="text-sm text-gray-600">인증된 휴대폰: {phone}</p>
            </div>
          )}
          
          {/* 개인정보 수집 동의 */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-4">개인정보 수집 및 이용 동의</h3>
            
            <div className="space-y-3">
              {/* 필수 동의 */}
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-700">
                  <span className="font-medium">[필수]</span> 개인정보 수집 및 이용에 동의합니다
                  <button
                    type="button"
                    onClick={() => {
                      // 약관 모달 표시 (추후 구현)
                      alert('개인정보 수집 및 이용 약관');
                    }}
                    className="ml-1 text-indigo-600 underline"
                  >
                    자세히 보기
                  </button>
                </span>
              </label>
              
              {/* 선택 동의 */}
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingAgreed}
                  onChange={(e) => setMarketingAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-700">
                  <span className="font-medium">[선택]</span> 마케팅 정보 수신에 동의합니다
                  <button
                    type="button"
                    onClick={() => {
                      // 약관 모달 표시 (추후 구현)
                      alert('마케팅 정보 수신 약관');
                    }}
                    className="ml-1 text-indigo-600 underline"
                  >
                    자세히 보기
                  </button>
                </span>
              </label>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">
                <strong>수집 항목:</strong> 이름, 휴대폰 번호, 이메일(선택)
              </p>
              <p className="text-xs text-gray-600 mb-2">
                <strong>수집 목적:</strong> 진단 서비스 제공, 고객 문의 응대
              </p>
              <p className="text-xs text-gray-600">
                <strong>보유 기간:</strong> 서비스 이용 종료 후 1년
              </p>
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
            disabled={!isVerified || !privacyAgreed}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            다음 단계
          </button>
        </div>
      </div>
    </div>
  );
}

