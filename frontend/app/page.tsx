'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicStats } from '@/lib/api/stats';
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerFooter from '@/components/customer/CustomerFooter';

export default function HomePage() {
  const router = useRouter();
  const [plateNumber, setPlateNumber] = useState('');

  // 공개 통계 조회
  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: getPublicStats,
  });

  const handlePlateNumberSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (plateNumber.trim()) {
      router.push(`/apply/vehicle?plate=${encodeURIComponent(plateNumber.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerNavbar />
      {/* 히어로 섹션 */}
      <section className="relative bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6">
              중고차 구매 전<br />
              전문 진단 서비스
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-indigo-100">
              검증된 전문 기사가 직접 방문하여<br />
              차량 상태를 정확하게 진단해드립니다
            </p>
            
            {/* 차량번호 조회 CTA */}
            <form onSubmit={handlePlateNumberSearch} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="차량번호를 입력하세요 (예: 12가3456)"
                  className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button
                  type="submit"
                  className="px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  진단 신청하기
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 서비스 특장점 섹션 */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            왜 NearCar를 선택해야 할까요?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">검증된 전문 기사</h3>
              <p className="text-gray-600">엄격한 검증을 통과한 전문 진단 기사만 배정됩니다</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">당일 예약 가능</h3>
              <p className="text-gray-600">원하시는 날짜와 시간에 맞춰 방문 진단이 가능합니다</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">상세 진단 레포트</h3>
              <p className="text-gray-600">체계적인 진단 결과를 PDF 레포트로 제공합니다</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">합리적인 가격</h3>
              <p className="text-gray-600">차종과 지역에 따라 투명한 가격으로 제공됩니다</p>
            </div>
          </div>
        </div>
      </section>

      {/* 누적 진단 수 섹션 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              누적 진단 수
            </h2>
            <div className="text-5xl sm:text-6xl font-extrabold text-indigo-600 mb-2">
              {stats ? new Intl.NumberFormat('ko-KR').format(stats.total_inspections) + '+' : '...'}
            </div>
            <p className="text-gray-600">고객들이 신뢰하는 NearCar 진단 서비스</p>
            {stats && stats.average_rating > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                평균 별점: {stats.average_rating.toFixed(1)}점 ({stats.total_reviews}개 후기)
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 후기 하이라이트 섹션 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            고객 후기
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* TODO: API 연동 필요 - 최근 후기 3-5개 표시 */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {'★'.repeat(5)}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">5.0</span>
                </div>
                <p className="text-gray-700 mb-4">
                  "전문 기사님이 꼼꼼하게 진단해주셔서 안심하고 구매할 수 있었습니다. 레포트도 상세해서 정말 도움이 되었어요!"
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-200 rounded-full mr-3"></div>
                  <div>
                    <p className="font-semibold text-gray-900">김○○님</p>
                    <p className="text-sm text-gray-500">2024.01.15</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/reviews"
              className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              더 많은 후기 보기
            </Link>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-16 bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            지금 바로 진단을 신청하세요
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            간단한 정보 입력만으로 전문 진단 서비스를 받을 수 있습니다
          </p>
          <Link
            href="/apply/vehicle"
            className="inline-block px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            진단 신청하기
          </Link>
        </div>
      </section>

      <CustomerFooter />
    </div>
  );
}

