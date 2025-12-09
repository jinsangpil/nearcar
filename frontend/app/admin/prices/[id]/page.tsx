'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPricePolicyDetail,
  updatePricePolicy,
  PricePolicyDetail,
  PricePolicyUpdateRequest,
} from '@/lib/api/admin';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  getOriginName,
  getVehicleClassName,
  getOriginColors,
  getVehicleClassColors,
} from '@/lib/constants/vehicle';

export default function PricePolicyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const policyId = params.id as string;

  const [addAmount, setAddAmount] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);

  // 가격 정책 상세 조회
  const { data: policy, isLoading, error } = useQuery({
    queryKey: ['pricePolicy', policyId],
    queryFn: () => getPricePolicyDetail(policyId),
    enabled: !!policyId,
  });

  // 폼 초기화
  useEffect(() => {
    if (policy) {
      setAddAmount(policy.add_amount);
    }
  }, [policy]);

  // 수정 뮤테이션
  const updateMutation = useMutation({
    mutationFn: (data: PricePolicyUpdateRequest) => updatePricePolicy(policyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricePolicy', policyId] });
      queryClient.invalidateQueries({ queryKey: ['pricePolicies'] });
      setIsEditing(false);
      alert('가격 정책이 수정되었습니다');
    },
    onError: (error: any) => {
      alert(error.message || '가격 정책 수정에 실패했습니다');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (addAmount < 0) {
      alert('추가 금액은 0 이상이어야 합니다');
      return;
    }

    updateMutation.mutate({ add_amount: addAmount });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            가격 정책을 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : '알 수 없는 오류'}
          </p>
          <Link
            href="/admin/prices"
            className="mt-2 inline-block px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/prices"
            className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">가격 정책 상세</h1>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            수정
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    국산/수입
                  </label>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-md">
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getOriginColors(policy.origin).bg} ${getOriginColors(policy.origin).text} border ${getOriginColors(policy.origin).border}`}>
                      {getOriginName(policy.origin)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    차량 등급
                  </label>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-md">
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${getVehicleClassColors(policy.vehicle_class).bg} ${getVehicleClassColors(policy.vehicle_class).text} border ${getVehicleClassColors(policy.vehicle_class).border}`}>
                      {getVehicleClassName(policy.vehicle_class)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 추가 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                추가 금액 (원)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(parseInt(e.target.value) || 0)}
                  min="0"
                  step="1000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  required
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-md">
                  <span className="font-semibold text-gray-900">
                    {policy.add_amount.toLocaleString()}원
                  </span>
                </div>
              )}
            </div>

            {/* 생성/수정 일시 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  생성일
                </label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-md">
                  {format(new Date(policy.created_at), 'yyyy-MM-dd HH:mm:ss')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  수정일
                </label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-md">
                  {format(new Date(policy.updated_at), 'yyyy-MM-dd HH:mm:ss')}
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            {isEditing && (
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={updateMutation.isLoading}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isLoading ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setAddAmount(policy.add_amount);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

