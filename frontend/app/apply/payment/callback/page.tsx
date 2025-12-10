'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { confirmPayment, type PaymentConfirmRequest } from '@/lib/api/payments';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'fail'>('processing');
  const [message, setMessage] = useState('결제를 처리하는 중입니다...');
  
  // 결제 확인 Mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: confirmPayment,
    onSuccess: (data) => {
      setStatus('success');
      setMessage('결제가 완료되었습니다.');
      
      // 3초 후 완료 페이지로 이동
      setTimeout(() => {
        router.push(`/apply/payment/success?paymentId=${data.payment_id}`);
      }, 3000);
    },
    onError: (error: any) => {
      setStatus('fail');
      setMessage(error.message || '결제 처리 중 오류가 발생했습니다.');
      
      // 3초 후 실패 페이지로 이동
      setTimeout(() => {
        router.push(`/apply/payment/fail?error=${encodeURIComponent(error.message || '알 수 없는 오류')}`);
      }, 3000);
    },
  });
  
  useEffect(() => {
    // KCP 결제창에서 전달된 파라미터 확인
    const orderId = searchParams.get('ordr_idxx') || searchParams.get('order_id');
    const resCd = searchParams.get('res_cd');
    const resMsg = searchParams.get('res_msg');
    const approvalKey = searchParams.get('approval_key');
    const tno = searchParams.get('tno');
    const amount = searchParams.get('amount');
    
    if (!orderId) {
      setStatus('fail');
      setMessage('주문 정보를 찾을 수 없습니다.');
      return;
    }
    
    // KCP 결제 결과 확인
    // res_cd가 "0000"이면 성공, 그 외는 실패
    if (resCd === '0000' && approvalKey) {
      // 결제 확인 요청
      const confirmRequest: PaymentConfirmRequest = {
        order_id: orderId,
        approval_key: approvalKey,
        kcp_result: resCd,
        res_cd: resCd,
        res_msg: resMsg || '',
        tno: tno || '',
        amount: amount || '',
      };
      
      confirmPaymentMutation.mutate(confirmRequest);
    } else {
      // 결제 실패
      setStatus('fail');
      setMessage(resMsg || '결제에 실패했습니다.');
      
      setTimeout(() => {
        router.push(`/apply/payment/fail?error=${encodeURIComponent(resMsg || '결제 실패')}`);
      }, 3000);
    }
  }, [searchParams]);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">결제 처리 중</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">결제 완료</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-2">잠시 후 완료 페이지로 이동합니다...</p>
          </>
        )}
        
        {status === 'fail' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">결제 실패</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-2">잠시 후 이전 페이지로 이동합니다...</p>
          </>
        )}
      </div>
    </div>
  );
}

