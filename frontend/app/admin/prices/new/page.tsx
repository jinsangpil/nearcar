'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPricePolicy,
  PricePolicyCreateRequest,
} from '@/lib/api/admin';
import Link from 'next/link';
import {
  VEHICLE_CLASS_ORDER,
  ORIGIN_ORDER,
  getOriginName,
  getVehicleClassName,
  getOriginColors,
  getVehicleClassColors,
} from '@/lib/constants/vehicle';

export default function NewPricePolicyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [origin, setOrigin] = useState<string>('domestic');
  const [vehicleClass, setVehicleClass] = useState<string>('mid');
  const [addAmount, setAddAmount] = useState<number>(0);

  // 생성 뮤테이션
  const createMutation = useMutation({
    mutationFn: (data: PricePolicyCreateRequest) => createPricePolicy(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pricePolicies'] });
      alert('가격 정책이 생성되었습니다');
      router.push(`/admin/prices/${data.id}`);
    },
    onError: (error: any) => {
      alert(error.message || '가격 정책 생성에 실패했습니다');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (addAmount < 0) {
      alert('추가 금액은 0 이상이어야 합니다');
      return;
    }

    createMutation.mutate({
      origin,
      vehicle_class: vehicleClass,
      add_amount: addAmount,
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin/prices"
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">새 가격 정책 추가</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* 국산/수입 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                국산/수입 <span className="text-red-500">*</span>
              </label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              >
                <option value="domestic">국산</option>
                <option value="imported">수입</option>
              </select>
            </div>

            {/* 차량 등급 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                차량 등급 <span className="text-red-500">*</span>
              </label>
              <select
                value={vehicleClass}
                onChange={(e) => setVehicleClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              >
                {VEHICLE_CLASS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {getVehicleClassName(value)}
                  </option>
                ))}
              </select>
            </div>

            {/* 추가 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                추가 금액 (원) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(parseInt(e.target.value) || 0)}
                min="0"
                step="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="0"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                기본 패키지 가격에 추가되는 할증 금액입니다.
              </p>
            </div>

            {/* 미리보기 */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">미리보기</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">구분:</span>{' '}
                  <span className={`px-2 py-1 rounded text-sm font-semibold ${getOriginColors(origin).bg} ${getOriginColors(origin).text} border ${getOriginColors(origin).border}`}>
                    {getOriginName(origin)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">차량 등급:</span>{' '}
                  <span className={`px-2 py-1 rounded text-sm font-semibold ${getVehicleClassColors(vehicleClass).bg} ${getVehicleClassColors(vehicleClass).text} border ${getVehicleClassColors(vehicleClass).border}`}>
                    {getVehicleClassName(vehicleClass)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">추가 금액:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {addAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={createMutation.isLoading}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isLoading ? '생성 중...' : '생성'}
              </button>
              <Link
                href="/admin/prices"
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                취소
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

