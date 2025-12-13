'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getPackages, getRegions, type Package, type RegionHierarchy } from '@/lib/api/quotes';
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerFooter from '@/components/customer/CustomerFooter';

export default function PricingPage() {
  // 패키지 목록 조회
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: getPackages,
  });

  // 지역 목록 조회
  const { data: regions, isLoading: regionsLoading } = useQuery({
    queryKey: ['regions'],
    queryFn: getRegions,
  });

  // 금액 포맷팅 함수
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerNavbar />
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
              이용 요금
            </h1>
            <p className="text-xl sm:text-2xl text-indigo-100">
              투명한 가격 정책으로 합리적인 진단 서비스를 제공합니다
            </p>
          </div>
        </div>
      </section>

      {/* 패키지별 기본 가격 섹션 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              진단 패키지
            </h2>
            <p className="text-lg text-gray-600">
              원하시는 진단 범위에 맞는 패키지를 선택하세요
            </p>
          </div>

          {packagesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : packages && packages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {packages.map((pkg: Package) => (
                <div
                  key={pkg.id}
                  className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-indigo-500 hover:shadow-lg transition-all"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {pkg.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-4xl font-extrabold text-indigo-600">
                      {formatPrice(pkg.base_price)}
                    </span>
                    <span className="text-gray-600 ml-2">원</span>
                  </div>
                  {pkg.included_items && typeof pkg.included_items === 'object' && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">포함 항목:</p>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {pkg.included_items.sections && Array.isArray(pkg.included_items.sections) && (
                          pkg.included_items.sections.map((section: any, index: number) => (
                            <li key={index} className="flex items-start">
                              <span className="text-indigo-600 mr-2">✓</span>
                              <span>{section.name || section}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              패키지 정보를 불러올 수 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 지역별 출장비 섹션 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              지역별 출장비
            </h2>
            <p className="text-lg text-gray-600">
              서비스 지역에 따라 추가 출장비가 발생할 수 있습니다
            </p>
          </div>

          {regionsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : regions && regions.length > 0 ? (
            <div className="space-y-6">
              {regions.map((region: RegionHierarchy, index: number) => (
                <div key={index} className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {region.province}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {region.cities.map((city) => (
                      <div
                        key={city.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-gray-700">{city.city}</span>
                        {city.extra_fee > 0 && (
                          <span className="text-indigo-600 font-semibold">
                            +{formatPrice(city.extra_fee)}원
                          </span>
                        )}
                        {city.extra_fee === 0 && (
                          <span className="text-gray-500 text-sm">무료</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              지역 정보를 불러올 수 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 차종별 할증 안내 섹션 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              차종별 추가 요금
            </h2>
            <p className="text-lg text-gray-600">
              차량 등급에 따라 추가 요금이 발생할 수 있습니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 국산차 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                국산차
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">경차</span>
                  <span className="text-gray-500 text-sm">할증 없음</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">소형</span>
                  <span className="text-indigo-600 font-semibold">+10,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">중형</span>
                  <span className="text-indigo-600 font-semibold">+20,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">대형A</span>
                  <span className="text-indigo-600 font-semibold">+30,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">대형B</span>
                  <span className="text-indigo-600 font-semibold">+40,000원</span>
                </div>
              </div>
            </div>

            {/* 수입차 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                수입차
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">소형</span>
                  <span className="text-indigo-600 font-semibold">+20,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">준준형</span>
                  <span className="text-indigo-600 font-semibold">+30,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">중형</span>
                  <span className="text-indigo-600 font-semibold">+40,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">대형</span>
                  <span className="text-indigo-600 font-semibold">+50,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">고성능</span>
                  <span className="text-indigo-600 font-semibold">+70,000원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">슈퍼카</span>
                  <span className="text-indigo-600 font-semibold">+100,000원</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-indigo-50 rounded-lg p-6">
            <p className="text-sm text-gray-700">
              <strong>참고:</strong> 차종별 할증 금액은 차량 등급에 따라 자동으로 계산됩니다.
              정확한 견적은 진단 신청 시 차량 정보를 입력하시면 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 견적 계산기 섹션 (선택적) */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              간편 견적 계산기
            </h2>
            <p className="text-center text-gray-600 mb-8">
              차량 정보를 입력하시면 예상 견적을 확인하실 수 있습니다
            </p>
            <div className="text-center">
              <Link
                href="/apply/vehicle"
                className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                견적 계산하기
              </Link>
            </div>
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
            투명한 가격으로 전문 진단 서비스를 받아보세요
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

