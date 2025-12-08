'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { getReport, getInspectionDetail, InspectionReport } from '@/lib/api/reports';
import { format } from 'date-fns';

const SECTIONS = [
  { id: '외관', name: '외관', icon: '🚗' },
  { id: '엔진룸', name: '엔진룸', icon: '⚙️' },
  { id: '하부', name: '하부', icon: '🔧' },
  { id: '실내', name: '실내', icon: '🪑' },
  { id: '전장품', name: '전장품', icon: '💡' },
];

export default function ReportViewPage() {
  const params = useParams();
  const inspectionId = params.inspection_id as string;
  const [activeSection, setActiveSection] = useState<string>('외관');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // 레포트 데이터 조회
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['report', inspectionId],
    queryFn: () => getReport(inspectionId),
  });

  // 신청 상세 정보 조회 (PDF URL 등)
  const { data: inspectionDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['inspection-detail', inspectionId],
    queryFn: () => getInspectionDetail(inspectionId),
  });

  const isLoading = reportLoading || detailLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">레포트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">레포트를 찾을 수 없습니다</h1>
          <p className="text-gray-600">요청하신 진단 레포트가 존재하지 않거나 접근 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  // 현재 섹션의 체크리스트 데이터
  const currentSectionData = report.checklist_data[activeSection] || [];
  
  // 현재 섹션의 이미지 필터링
  const currentSectionImages = report.images?.filter(
    (img) => img.section === activeSection || !img.section
  ) || [];

  // 모든 이미지 배열 (갤러리용)
  const allImages = report.images?.map((img: any) => {
    // s3_url 우선, 없으면 url, 없으면 s3_key 기반 URL 생성
    if (img.s3_url) return img.s3_url;
    if (img.url) return img.url;
    if (img.s3_key || img.file_key) {
      const s3Key = img.s3_key || img.file_key;
      // S3 파일 키인 경우 URL 생성 (실제 환경에 맞게 수정 필요)
      return `https://${process.env.NEXT_PUBLIC_S3_BUCKET || 'nearcar-media'}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${s3Key}`;
    }
    return '';
  }).filter((url) => url !== '') || [];

  // 키보드 네비게이션 (이미지 갤러리)
  useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
        setSelectedImageIndex(selectedImageIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedImageIndex < allImages.length - 1) {
        setSelectedImageIndex(selectedImageIndex + 1);
      } else if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, allImages.length]);

  const handleDownloadPDF = () => {
    if (inspectionDetail?.report_summary?.pdf_url) {
      window.open(inspectionDetail.report_summary.pdf_url, '_blank');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '진단 레포트',
          text: '중고차 진단 레포트를 확인하세요',
          url: url,
        });
      } catch (err) {
        // 사용자가 공유를 취소한 경우 무시
      }
    } else {
      // Fallback: 클립보드에 복사
      await navigator.clipboard.writeText(url);
      alert('링크가 클립보드에 복사되었습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">진단 레포트</h1>
              <p className="text-sm text-gray-500 mt-1">
                {inspectionDetail?.customer_name && (
                  <>
                    {inspectionDetail.customer_name} ·{' '}
                  </>
                )}
                {report.created_at && format(new Date(report.created_at), 'yyyy년 MM월 dd일')}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {inspectionDetail?.report_summary?.pdf_url && (
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                  PDF 다운로드
                </button>
              )}
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                공유하기
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 섹션 탭 */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto" aria-label="Tabs">
              {SECTIONS.map((section) => {
                const hasData = report.checklist_data[section.id]?.length > 0;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      flex-shrink-0 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                      ${
                        activeSection === section.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <span className="mr-2">{section.icon}</span>
                    {section.name}
                    {hasData && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-600 rounded-full">
                        {report.checklist_data[section.id]?.length || 0}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 체크리스트 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{activeSection} 체크리스트</h2>
              {currentSectionData.length === 0 ? (
                <p className="text-gray-500 text-center py-8">해당 섹션에 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {currentSectionData.map((item: any, index: number) => {
                    const status = item.status || 'normal';
                    const statusColors: Record<string, string> = {
                      normal: 'bg-green-100 text-green-800',
                      warning: 'bg-yellow-100 text-yellow-800',
                      defect: 'bg-red-100 text-red-800',
                      good: 'bg-blue-100 text-blue-800',
                      warn: 'bg-yellow-100 text-yellow-800',
                      bad: 'bg-red-100 text-red-800',
                    };
                    const statusLabels: Record<string, string> = {
                      normal: '정상',
                      warning: '주의',
                      defect: '결함',
                      good: '양호',
                      warn: '주의',
                      bad: '불량',
                    };

                    return (
                      <div
                        key={index}
                        className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {item.name || item.id || `항목 ${index + 1}`}
                            </span>
                            {status && (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  statusColors[status] || 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {statusLabels[status] || status}
                              </span>
                            )}
                          </div>
                          {item.note && (
                            <p className="mt-2 text-sm text-gray-600">{item.note}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 이미지 갤러리 */}
            {currentSectionImages.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{activeSection} 이미지</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {currentSectionImages.map((img: any, index: number) => {
                    // s3_url 우선, 없으면 url, 없으면 s3_key 기반 URL 생성
                    const imageUrl = img.s3_url || img.url || (img.s3_key || img.file_key ? 
                      `https://${process.env.NEXT_PUBLIC_S3_BUCKET || 'nearcar-media'}.s3.${process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${img.s3_key || img.file_key}` 
                      : '');
                    const globalIndex = report.images?.findIndex((i: any) => i === img) || index;
                    
                    if (!imageUrl) return null;
                    
                    return (
                      <div
                        key={index}
                        className="relative aspect-square cursor-pointer group"
                        onClick={() => setSelectedImageIndex(globalIndex)}
                      >
                        <Image
                          src={imageUrl}
                          alt={`${activeSection} 이미지 ${index + 1}`}
                          fill
                          className="object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                          loading="lazy"
                          sizes="(max-width: 640px) 50vw, 33vw"
                          unoptimized={imageUrl.startsWith('http')}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded-lg flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                            />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 종합 의견 */}
            {report.inspector_comment && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">종합 의견</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{report.inspector_comment}</p>
              </div>
            )}

            {/* 예상 수리비 */}
            {report.repair_cost_est !== undefined && report.repair_cost_est > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">예상 수리비</h2>
                <p className="text-2xl font-bold text-red-600">
                  {report.repair_cost_est.toLocaleString()}원
                </p>
              </div>
            )}

            {/* 레포트 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">레포트 정보</h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-gray-500">상태</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {report.status === 'submitted' && '제출됨'}
                    {report.status === 'reviewed' && '검토 완료'}
                    {report.status === 'rejected' && '반려됨'}
                    {!['submitted', 'reviewed', 'rejected'].includes(report.status) && report.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">생성일</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {report.created_at && format(new Date(report.created_at), 'yyyy년 MM월 dd일 HH:mm')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* 이미지 확대 모달 */}
      {selectedImageIndex !== null && allImages[selectedImageIndex] && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedImageIndex(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          
          {/* 이전 이미지 버튼 */}
          {selectedImageIndex > 0 && (
            <button
              className="absolute left-4 text-white hover:text-gray-300 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(selectedImageIndex - 1);
              }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* 다음 이미지 버튼 */}
          {selectedImageIndex < allImages.length - 1 && (
            <button
              className="absolute right-4 text-white hover:text-gray-300 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(selectedImageIndex + 1);
              }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* 이미지 */}
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={allImages[selectedImageIndex]}
              alt={`이미지 ${selectedImageIndex + 1}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              priority
              unoptimized={allImages[selectedImageIndex]?.startsWith('http')}
            />
          </div>

          {/* 이미지 인덱스 표시 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
            {selectedImageIndex + 1} / {allImages.length}
          </div>
        </div>
      )}
    </div>
  );
}

