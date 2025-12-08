'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { getInspectors, assignInspector, getInspectionDetail } from '@/lib/api/admin';
import { useState } from 'react';

export default function AssignInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inspectionId = params.id as string;
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const { data: inspection } = useQuery({
    queryKey: ['inspection-detail', inspectionId],
    queryFn: () => getInspectionDetail(inspectionId),
  });

  const { data: inspectors, isLoading } = useQuery({
    queryKey: ['inspectors'],
    queryFn: getInspectors,
  });

  const assignMutation = useMutation({
    mutationFn: () => assignInspector(inspectionId, { inspector_id: selectedInspectorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-detail', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      router.push(`/admin/inspections/${inspectionId}`);
    },
  });

  const sortedInspectors = inspectors
    ? [...inspectors].sort((a, b) => {
        if (sortBy === 'distance') {
          return (a.distance || Infinity) - (b.distance || Infinity);
        } else {
          return (b.rating || 0) - (a.rating || 0);
        }
      })
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          ← 돌아가기
        </button>
        <h1 className="text-2xl font-bold text-gray-900">기사 배정</h1>
        {inspection && (
          <p className="mt-1 text-sm text-gray-500">
            {inspection.customer?.name || '고객명 없음'} ({inspection.location_address || '주소 없음'})
          </p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">가용 기사 목록</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">정렬:</span>
            <button
              onClick={() => setSortBy('distance')}
              className={`px-3 py-1 text-sm rounded-md ${
                sortBy === 'distance'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              거리순
            </button>
            <button
              onClick={() => setSortBy('rating')}
              className={`px-3 py-1 text-sm rounded-md ${
                sortBy === 'rating'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              평점순
            </button>
          </div>
        </div>

        {sortedInspectors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">가용 기사가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {sortedInspectors.map((inspector) => (
              <label
                key={inspector.id}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedInspectorId === inspector.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="inspector"
                  value={inspector.id}
                  checked={selectedInspectorId === inspector.id}
                  onChange={(e) => setSelectedInspectorId(e.target.value)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{inspector.name}</div>
                      <div className="text-sm text-gray-500">{inspector.phone}</div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      {inspector.distance !== undefined && (
                        <div className="text-gray-600">
                          거리: <span className="font-medium">{inspector.distance.toFixed(1)}km</span>
                        </div>
                      )}
                      {inspector.rating !== undefined && (
                        <div className="text-gray-600">
                          평점: <span className="font-medium">{inspector.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {inspector.active_region && (
                        <div className="text-gray-500 text-xs">{inspector.active_region}</div>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={() => assignMutation.mutate()}
            disabled={!selectedInspectorId || assignMutation.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {assignMutation.isPending ? '배정 중...' : '배정 확정'}
          </button>
        </div>
      </div>
    </div>
  );
}

