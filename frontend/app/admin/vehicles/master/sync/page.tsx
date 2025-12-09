'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { syncVehicleMasters, VehicleMasterSyncRequest, VehicleMasterSyncResponse } from '@/lib/api/admin';
import { useState, useRef } from 'react';

export default function VehicleMasterSyncPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncData, setSyncData] = useState<string>('');
  const [syncResult, setSyncResult] = useState<VehicleMasterSyncResponse | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: (data: VehicleMasterSyncRequest) => syncVehicleMasters(data),
    onSuccess: (result) => {
      setSyncResult(result);
      setSyncData('');
      setJsonError(null);
    },
    onError: (error: any) => {
      console.error('차량 마스터 동기화 실패:', error);
      alert(error.response?.data?.detail || '차량 마스터 동기화에 실패했습니다');
    },
  });

  const handleSync = () => {
    setJsonError(null);
    setSyncResult(null);

    if (!syncData.trim()) {
      alert('동기화할 데이터를 입력해주세요');
      return;
    }

    try {
      const parsed = JSON.parse(syncData);
      
      // 배열인지 확인
      if (!Array.isArray(parsed)) {
        setJsonError('데이터는 배열 형식이어야 합니다');
        return;
      }

      // 각 항목의 필수 필드 확인
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.origin || !item.manufacturer || !item.model_group || !item.vehicle_class || !item.start_year) {
          setJsonError(`항목 ${i + 1}: 필수 필드(origin, manufacturer, model_group, vehicle_class, start_year)가 누락되었습니다`);
          return;
        }
      }

      const syncRequest: VehicleMasterSyncRequest = {
        data: parsed,
      };

      syncMutation.mutate(syncRequest);
    } catch (e) {
      setJsonError('올바른 JSON 형식이 아닙니다: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (!Array.isArray(parsed)) {
          setJsonError('파일 내용은 배열 형식이어야 합니다');
          return;
        }

        setSyncData(JSON.stringify(parsed, null, 2));
        setJsonError(null);
        setSyncResult(null);
      } catch (error) {
        setJsonError('파일을 읽는 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!syncData.trim()) {
      alert('다운로드할 데이터가 없습니다');
      return;
    }

    try {
      const parsed = JSON.parse(syncData);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehicle_masters_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('다운로드할 데이터 형식이 올바르지 않습니다');
    }
  };

  const exampleData = [
    {
      origin: 'domestic',
      manufacturer: 'Hyundai',
      model_group: 'Grandeur',
      model_detail: 'The New Grandeur',
      vehicle_class: 'large',
      start_year: 2019,
      end_year: null,
      is_active: true,
    },
    {
      origin: 'imported',
      manufacturer: 'BMW',
      model_group: '5 Series',
      model_detail: '520d',
      vehicle_class: 'mid',
      start_year: 2020,
      end_year: null,
      is_active: true,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차량 마스터 동기화</h1>
          <p className="mt-1 text-sm text-gray-500">스크래핑 데이터를 일괄 동기화합니다</p>
        </div>
        <button
          onClick={() => router.push('/admin/vehicles/master')}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        {/* 파일 업로드/다운로드 영역 */}
        <div className="mb-6 flex gap-4">
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
            >
              📁 JSON 파일 업로드
            </button>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!syncData.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💾 현재 데이터 다운로드
          </button>
        </div>

        {/* 데이터 입력 영역 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            동기화할 데이터 (JSON 배열 형식)
          </label>
          <textarea
            value={syncData}
            onChange={(e) => {
              setSyncData(e.target.value);
              setJsonError(null);
              setSyncResult(null);
            }}
            className="w-full h-64 px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder={`예시:\n${JSON.stringify(exampleData, null, 2)}`}
          />
          {jsonError && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">{jsonError}</p>
          )}
        </div>

        {/* 예시 데이터 표시 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">예시 데이터 형식:</h3>
          <pre className="text-xs text-gray-600 overflow-x-auto">
            {JSON.stringify(exampleData, null, 2)}
          </pre>
          <button
            type="button"
            onClick={() => setSyncData(JSON.stringify(exampleData, null, 2))}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
          >
            예시 데이터 사용
          </button>
        </div>

        {/* 동기화 버튼 */}
        <div className="mb-6">
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending || !syncData.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncMutation.isPending ? '동기화 중...' : '동기화 실행'}
          </button>
        </div>

        {/* 동기화 결과 */}
        {syncResult && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">동기화 결과:</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">생성된 건수:</span>
                <span className="text-sm font-medium text-green-700">{syncResult.created}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">업데이트된 건수:</span>
                <span className="text-sm font-medium text-blue-700">{syncResult.updated}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">실패한 건수:</span>
                <span className="text-sm font-medium text-red-700">{syncResult.failed}건</span>
              </div>
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">에러 목록:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {syncResult.errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-600">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

