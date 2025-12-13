'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicFAQs, type FAQ } from '@/lib/api/faqs';
import Link from 'next/link';
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerFooter from '@/components/customer/CustomerFooter';

const FAQ_CATEGORIES = [
  { id: 'all', name: '전체' },
  { id: 'payment', name: '결제' },
  { id: 'refund', name: '환불' },
  { id: 'reservation', name: '예약' },
  { id: 'service', name: '서비스 이용' },
  { id: 'other', name: '기타' },
];

export default function FAQPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  // FAQ 목록 조회
  const { data: faqsData, isLoading, error } = useQuery({
    queryKey: ['faqs', selectedCategory],
    queryFn: () => getPublicFAQs(selectedCategory === 'all' ? undefined : selectedCategory),
  });

  // 아코디언 토글
  const toggleItem = (faqId: string) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(faqId)) {
        newSet.delete(faqId);
      } else {
        newSet.add(faqId);
      }
      return newSet;
    });
  };

  // 카테고리별로 FAQ 그룹화
  const groupedFAQs = faqsData?.items.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQ[]>) || {};

  return (
    <div className="min-h-screen bg-white">
      <CustomerNavbar />
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
              자주 묻는 질문
            </h1>
            <p className="text-xl sm:text-2xl text-indigo-100">
              궁금하신 사항을 빠르게 확인하세요
            </p>
          </div>
        </div>
      </section>

      {/* FAQ 섹션 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 카테고리 필터 */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3">
              {FAQ_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ 목록 */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">FAQ를 불러오는 중 오류가 발생했습니다.</p>
            </div>
          ) : faqsData && faqsData.items.length > 0 ? (
            <div className="space-y-4">
              {selectedCategory === 'all' ? (
                // 카테고리별로 그룹화하여 표시
                Object.entries(groupedFAQs).map(([category, faqs]) => (
                  <div key={category} className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      {FAQ_CATEGORIES.find((c) => c.id === category)?.name || category}
                    </h2>
                    <div className="space-y-3">
                      {faqs.map((faq) => (
                        <div
                          key={faq.id}
                          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                        >
                          <button
                            onClick={() => toggleItem(faq.id)}
                            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium text-gray-900 pr-4">
                              {faq.question}
                            </span>
                            <svg
                              className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                                openItems.has(faq.id) ? 'transform rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                          {openItems.has(faq.id) && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                              <p className="text-gray-700 whitespace-pre-line">
                                {faq.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // 선택된 카테고리의 FAQ만 표시
                <div className="space-y-3">
                  {faqsData.items.map((faq) => (
                    <div
                      key={faq.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(faq.id)}
                        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900 pr-4">
                          {faq.question}
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                            openItems.has(faq.id) ? 'transform rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {openItems.has(faq.id) && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                          <p className="text-gray-700 whitespace-pre-line">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">등록된 FAQ가 없습니다.</p>
            </div>
          )}

          {/* 추가 문의 안내 */}
          <div className="mt-12 bg-indigo-50 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              원하는 답변을 찾지 못하셨나요?
            </h3>
            <p className="text-gray-600 mb-4">
              추가 문의사항이 있으시면 고객센터로 연락해주세요.
            </p>
            <Link
              href="/apply/vehicle"
              className="inline-block px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              진단 신청하기
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

