'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  getChecklistTemplates,
  saveChecklist,
  getChecklist,
  type ChecklistTemplate,
  type ChecklistItemData,
  type ChecklistSaveRequest,
} from '@/lib/api/checklists';
import {
  generatePresignedUrl,
  uploadCallback,
  type PresignedUrlRequest,
} from '@/lib/api/uploads';
import { isOnline, onOnlineStatusChange } from '@/lib/utils/offline';
import { saveInspections, getAllInspections } from '@/lib/db/inspectorDB';

const SECTIONS = ['외관', '엔진룸', '하부', '실내', '전장품'];

const STATUS_OPTIONS = [
  { value: 'normal', label: '정상', color: 'bg-green-100 text-green-800' },
  { value: 'warning', label: '경미한 결함', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'defect', label: '중대한 결함', color: 'bg-red-100 text-red-800' },
];

export default function ChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inspectionId = params.id as string;
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0]);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [checklistData, setChecklistData] = useState<Record<string, Record<string, ChecklistItemData>>>({});
  const [images, setImages] = useState<Record<string, string[]>>({});
  const [inspectorComment, setInspectorComment] = useState('');
  const [repairCostEst, setRepairCostEst] = useState<number | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});

  // 오프라인 상태 감지
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOffline(!online);
    });
    return () => unsubscribe();
  }, []);

  // 체크리스트 템플릿 조회
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: getChecklistTemplates,
  });

  // 기존 체크리스트 조회
  const { data: existingChecklist } = useQuery({
    queryKey: ['checklist', inspectionId],
    queryFn: () => getChecklist(inspectionId),
    enabled: !!inspectionId,
  });

  // 기존 체크리스트 데이터 로드
  useEffect(() => {
    if (existingChecklist) {
      setChecklistData(existingChecklist.checklist_data || {});
      setInspectorComment(existingChecklist.inspector_comment || '');
      setRepairCostEst(existingChecklist.repair_cost_est);
      
      // 이미지 데이터 변환
      const imageMap: Record<string, string[]> = {};
      existingChecklist.images?.forEach((img) => {
        if (!imageMap[img.section]) {
          imageMap[img.section] = [];
        }
        imageMap[img.section].push(img.url);
      });
      setImages(imageMap);
    }
  }, [existingChecklist]);

  // 체크리스트 저장 mutation
  const saveMutation = useMutation({
    mutationFn: (data: ChecklistSaveRequest) => saveChecklist(inspectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['inspector-inspection-detail', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['inspector-my-inspections'] });
      alert('체크리스트가 저장되었습니다.');
      router.push(`/inspector/inspections/${inspectionId}`);
    },
    onError: (error: any) => {
      alert(`체크리스트 저장에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    },
  });

  // 체크리스트 항목 상태 변경
  const handleItemStatusChange = (section: string, itemId: string, status: string) => {
    setChecklistData((prev) => {
      const newData = { ...prev };
      if (!newData[section]) {
        newData[section] = {};
      }
      if (!newData[section][itemId]) {
        newData[section][itemId] = { item_id: itemId, status: status as any };
      } else {
        newData[section][itemId] = { ...newData[section][itemId], status: status as any };
      }
      return newData;
    });
  };

  // 특이사항 변경
  const handleItemNoteChange = (section: string, itemId: string, note: string) => {
    setChecklistData((prev) => {
      const newData = { ...prev };
      if (!newData[section]) {
        newData[section] = {};
      }
      if (!newData[section][itemId]) {
        newData[section][itemId] = { item_id: itemId, status: 'normal' };
      }
      newData[section][itemId] = { ...newData[section][itemId], note };
      return newData;
    });
  };

  // 이미지 업로드 처리
  const handleImageUpload = async (section: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (isOffline || !isOnline()) {
      alert('오프라인 상태에서는 이미지를 업로드할 수 없습니다.');
      return;
    }

    setUploadingImages((prev) => ({ ...prev, [section]: true }));

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${Date.now()}_${file.name}`;

        // Presigned URL 생성
        const presignedRequest: PresignedUrlRequest = {
          inspection_id: inspectionId,
          section,
          file_name: fileName,
          content_type: file.type || 'image/jpeg',
        };

        const { presigned_url, metadata } = await generatePresignedUrl(presignedRequest);

        // S3에 직접 업로드
        const uploadResponse = await fetch(presigned_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'image/jpeg',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`이미지 업로드 실패: ${uploadResponse.statusText}`);
        }

        // 업로드 완료 콜백
        await uploadCallback({
          inspection_id: inspectionId,
          s3_key: metadata.s3_key,
          section,
        });

        uploadedUrls.push(metadata.s3_url); // 실제 S3 URL 사용
      }

      // 이미지 목록 업데이트
      setImages((prev) => ({
        ...prev,
        [section]: [...(prev[section] || []), ...uploadedUrls],
      }));
    } catch (error: any) {
      alert(`이미지 업로드에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setUploadingImages((prev) => ({ ...prev, [section]: false }));
    }
  };

  // 이미지 삭제
  const handleImageDelete = (section: string, index: number) => {
    setImages((prev) => {
      const newImages = { ...prev };
      if (newImages[section]) {
        newImages[section] = newImages[section].filter((_, i) => i !== index);
      }
      return newImages;
    });
  };

  // 카메라 열기
  const handleCameraOpen = (section: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.setAttribute('accept', 'image/*');
      fileInputRef.current.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        handleImageUpload(section, target.files);
      };
      fileInputRef.current.click();
    }
  };

  // 갤러리 열기
  const handleGalleryOpen = (section: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.setAttribute('accept', 'image/*');
      fileInputRef.current.setAttribute('multiple', 'multiple');
      fileInputRef.current.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        handleImageUpload(section, target.files);
      };
      fileInputRef.current.click();
    }
  };

  // 체크리스트 저장
  const handleSave = () => {
    // 체크리스트 데이터 변환
    const formattedData: Record<string, ChecklistItemData[]> = {};
    Object.keys(checklistData).forEach((section) => {
      formattedData[section] = Object.values(checklistData[section]);
    });

    // 이미지 데이터 변환
    const formattedImages = Object.keys(images).flatMap((section) =>
      images[section].map((url) => ({
        section,
        url,
      }))
    );

    const saveData: ChecklistSaveRequest = {
      checklist_data: formattedData,
      images: formattedImages,
      inspector_comment: inspectorComment || undefined,
      repair_cost_est: repairCostEst,
    };

    saveMutation.mutate(saveData);
  };

  const activeTemplate = templates?.find((t) => t.section === activeSection);
  const activeItems = activeTemplate?.items || [];

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>뒤로</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">체크리스트 작성</h1>
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <span>오프라인</span>
          </div>
        )}
      </div>

      {/* 섹션 탭 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                activeSection === section
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {section}
            </button>
          ))}
        </div>
      </div>

      {/* 체크리스트 항목 */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {activeItems.map((item) => {
          const itemData = checklistData[activeSection]?.[item.id];
          const currentStatus = itemData?.status || 'normal';
          const currentNote = itemData?.note || '';

          return (
            <div key={item.id} className="border-b border-gray-200 pb-6 last:border-0">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
              </div>

              {/* 상태 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상태
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleItemStatusChange(activeSection, item.id, option.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        currentStatus === option.value
                          ? option.color
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 특이사항 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  특이사항
                </label>
                <textarea
                  value={currentNote}
                  onChange={(e) => handleItemNoteChange(activeSection, item.id, e.target.value)}
                  placeholder="특이사항을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                  rows={3}
                />
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 ({images[activeSection]?.length || 0}장)
                </label>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleCameraOpen(activeSection)}
                    disabled={isOffline || uploadingImages[activeSection]}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    📷 카메라
                  </button>
                  <button
                    onClick={() => handleGalleryOpen(activeSection)}
                    disabled={isOffline || uploadingImages[activeSection]}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    🖼️ 갤러리
                  </button>
                </div>

                {/* 이미지 미리보기 */}
                {images[activeSection] && images[activeSection].length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {images[activeSection].map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`${item.name} ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleImageDelete(activeSection, index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadingImages[activeSection] && (
                  <div className="mt-4 text-center text-gray-600">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2">업로드 중...</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 종합 의견 및 예상 수리비 */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            종합 의견
          </label>
          <textarea
            value={inspectorComment}
            onChange={(e) => setInspectorComment(e.target.value)}
            placeholder="종합 의견을 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
            rows={5}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            예상 수리비 (원)
          </label>
          <input
            type="number"
            value={repairCostEst || ''}
            onChange={(e) => setRepairCostEst(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="예상 수리비를 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
            min={0}
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={() => router.back()}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors min-h-[56px]"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || isOffline}
          className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[56px]"
        >
          {saveMutation.isPending ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
      />
    </div>
  );
}

