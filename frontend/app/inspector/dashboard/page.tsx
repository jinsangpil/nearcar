'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getMyInspections, getAssignments } from '@/lib/api/inspector';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  saveInspections,
  saveDashboardStats,
  saveAssignments,
  getAllInspections,
  getDashboardStats as getCachedStats,
  getAssignments as getCachedAssignments,
} from '@/lib/db/inspectorDB';
import { isOnline, onOnlineStatusChange, startQueueSync } from '@/lib/utils/offline';

export default function InspectorDashboardPage() {
  const router = useRouter();
  const [isOffline, setIsOffline] = useState(!isOnline());

  // 오프라인 상태 감지 및 큐 동기화
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOffline(!online);
    });

    // 큐 동기화 시작
    const stopSync = startQueueSync(30000);

    return () => {
      unsubscribe();
      stopSync();
    };
  }, []);

  // 대시보드 통계 조회 (오프라인 시 캐시 사용)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['inspector-dashboard-stats'],
    queryFn: async () => {
      try {
        const data = await getDashboardStats();
        if (isOnline()) {
          await saveDashboardStats(data);
        }
        return data;
      } catch (err) {
        if (isOffline || !isOnline()) {
          return await getCachedStats();
        }
        throw err;
      }
    },
    refetchInterval: isOffline ? false : 30000,
    staleTime: 10000,
  });

  // 진행 중인 작업 목록 조회 (오프라인 시 캐시 사용)
  const { data: myInspections, isLoading: inspectionsLoading } = useQuery({
    queryKey: ['inspector-my-inspections'],
    queryFn: async () => {
      try {
        const data = await getMyInspections();
        if (isOnline()) {
          await saveInspections(data);
        }
        return data;
      } catch (err) {
        if (isOffline || !isOnline()) {
          return await getAllInspections();
        }
        throw err;
      }
    },
    refetchInterval: isOffline ? false : 30000,
    staleTime: 10000,
  });

  // 신규 배정 요청 조회 (오프라인 시 캐시 사용)
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['inspector-assignments'],
    queryFn: async () => {
      try {
        const data = await getAssignments();
        if (isOnline()) {
          await saveAssignments(data);
        }
        return data;
      } catch (err) {
        if (isOffline || !isOnline()) {
          return await getCachedAssignments();
        }
        throw err;
      }
    },
    refetchInterval: isOffline ? false : 30000,
    staleTime: 10000,
  });

  // 주간 캘린더 데이터 생성
  const weekStart = startOfWeek(new Date(), { locale: ko });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getWeeklyScheduleData = () => {
    if (!stats?.weekly_schedule) return {};
    return stats.weekly_schedule;
  };

  const weeklySchedule = getWeeklyScheduleData();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'report_submitted':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'assigned':
        return '배정됨';
      case 'scheduled':
        return '예정';
      case 'in_progress':
        return '진행 중';
      case 'report_submitted':
        return '레포트 제출';
      default:
        return status;
    }
  };

  if (statsLoading || inspectionsLoading || assignmentsLoading) {
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
        <h1 className="text-2xl font-bold text-gray-900">기사 대시보드</h1>
        <div className="flex items-center gap-3">
          {isOffline && (
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              <span>오프라인</span>
            </div>
          )}
          <div className="text-sm text-gray-500">
            {format(new Date(), 'yyyy년 MM월 dd일', { locale: ko })}
          </div>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 오늘의 일정 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">오늘의 일정</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.today_count || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 신규 배정 요청 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">신규 배정 요청</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.new_assignments_count || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
          </div>
          {stats && stats.new_assignments_count > 0 && (
            <Link
              href="/inspector/assignments"
              className="mt-4 block text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              배정 요청 확인하기 →
            </Link>
          )}
        </div>

        {/* 진행 중인 작업 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">진행 중인 작업</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.in_progress_count || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 주간 캘린더 뷰 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주간 일정</h2>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const count = weeklySchedule[dayKey] || 0;
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={index}
                className={`p-3 rounded-lg text-center ${
                  isToday ? 'bg-indigo-50 border-2 border-indigo-500' : 'bg-gray-50'
                }`}
              >
                <p className={`text-xs font-medium ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {format(day, 'EEE', { locale: ko })}
                </p>
                <p className={`text-lg font-bold mt-1 ${isToday ? 'text-indigo-900' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </p>
                {count > 0 && (
                  <div className="mt-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                      {count}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 진행 중인 작업 목록 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">진행 중인 작업</h2>
          <Link
            href="/inspector/inspections"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            전체 보기 →
          </Link>
        </div>

        {!myInspections || myInspections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            진행 중인 작업이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {myInspections.slice(0, 5).map((inspection) => (
              <div
                key={inspection.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/inspector/inspections/${inspection.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(inspection.status)}`}>
                        {getStatusText(inspection.status)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {inspection.vehicle}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium mb-1">
                      {inspection.location}
                    </p>
                    {inspection.schedule_date && inspection.schedule_time && (
                      <p className="text-xs text-gray-500">
                        {format(parseISO(inspection.schedule_date), 'yyyy년 MM월 dd일', { locale: ko })}{' '}
                        {inspection.schedule_time.substring(0, 5)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {inspection.total_amount.toLocaleString()}원
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 신규 배정 요청 알림 배너 */}
      {assignments && assignments.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-900">
                  새로운 배정 요청이 {assignments.length}건 있습니다
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  배정 요청을 확인하고 수락하세요
                </p>
              </div>
            </div>
            <Link
              href="/inspector/assignments"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              확인하기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

