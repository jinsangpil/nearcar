'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicReviews, type Review } from '@/lib/api/reviews';
import Link from 'next/link';
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerFooter from '@/components/customer/CustomerFooter';

export default function ReviewsPage() {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 12;

  // 후기 목록 조회
  const { data: reviewsData, isLoading, error } = useQuery({
    queryKey: ['reviews', selectedRating, currentPage],
    queryFn: () => getPublicReviews({ rating: selectedRating || undefined, page: currentPage, limit }),
  });

  // 별점 렌더링 함수
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-2 text-sm text-gray-600">{rating}.0</span>
      </div>
    );
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerNavbar />
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
              고객 후기
            </h1>
            <p className="text-xl sm:text-2xl text-indigo-100">
              실제 이용 고객들의 생생한 후기를 확인하세요
            </p>
          </div>
        </div>
      </section>

      {/* 필터링 및 후기 목록 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 필터링 */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSelectedRating(null);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedRating === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체
              </button>
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  onClick={() => {
                    setSelectedRating(rating);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedRating === rating
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {rating}점
                </button>
              ))}
            </div>
          </div>

          {/* 후기 목록 */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">후기를 불러오는 중 오류가 발생했습니다.</p>
            </div>
          ) : reviewsData && reviewsData.items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {reviewsData.items.map((review: Review) => (
                  <div
                    key={review.id}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    {/* 별점 및 날짜 */}
                    <div className="flex items-center justify-between mb-4">
                      {renderStars(review.rating)}
                      <span className="text-sm text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>

                    {/* 후기 내용 */}
                    {review.content && (
                      <p className="text-gray-700 mb-4 line-clamp-3">{review.content}</p>
                    )}

                    {/* 사진 */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="mb-4">
                        <div className="grid grid-cols-2 gap-2">
                          {review.photos.slice(0, 4).map((photo, index) => (
                            <div
                              key={index}
                              className="aspect-square bg-gray-200 rounded-lg overflow-hidden"
                            >
                              <img
                                src={photo}
                                alt={`후기 사진 ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 작성자 정보 */}
                    <div className="flex items-center mt-4 pt-4 border-t border-gray-200">
                      <div className="w-10 h-10 bg-gray-200 rounded-full mr-3"></div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {review.user_name || '고객님'}
                        </p>
                        {review.vehicle_info && (
                          <p className="text-sm text-gray-500">{review.vehicle_info}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {reviewsData.total_pages > 1 && (
                <div className="flex justify-center items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    {currentPage} / {reviewsData.total_pages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(reviewsData.total_pages, prev + 1))}
                    disabled={currentPage === reviewsData.total_pages}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">등록된 후기가 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-16 bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            진단 서비스를 이용해보세요
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            전문 기사가 직접 방문하여 정확하게 진단해드립니다
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

