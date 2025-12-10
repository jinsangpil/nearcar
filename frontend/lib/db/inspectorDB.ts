/**
 * 기사 대시보드용 IndexedDB (Dexie.js)
 */
import Dexie, { Table } from 'dexie';
import type { MyInspection } from '@/lib/api/inspector';

// 작업 데이터 인터페이스
export interface InspectionRecord {
  id: string;
  data: MyInspection;
  updatedAt: number; // timestamp
}

// 상태 변경 큐 인터페이스
export interface StatusChangeQueue {
  id?: number; // auto-increment
  inspectionId: string;
  newStatus: string;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// 대시보드 통계 캐시
export interface DashboardStatsCache {
  id: string; // 'stats'
  data: any;
  updatedAt: number;
}

// 배정 요청 캐시
export interface AssignmentCache {
  id: string;
  data: any;
  updatedAt: number;
}

class InspectorDatabase extends Dexie {
  inspections!: Table<InspectionRecord, string>;
  statusChangeQueue!: Table<StatusChangeQueue, number>;
  dashboardStats!: Table<DashboardStatsCache, string>;
  assignments!: Table<AssignmentCache, string>;

  constructor() {
    super('InspectorDatabase');
    
    this.version(1).stores({
      inspections: 'id, updatedAt',
      statusChangeQueue: '++id, inspectionId, timestamp',
      dashboardStats: 'id, updatedAt',
      assignments: 'id, updatedAt',
    });
  }
}

export const db = new InspectorDatabase();

/**
 * 작업 데이터 저장/업데이트
 */
export async function saveInspection(inspection: MyInspection): Promise<void> {
  await db.inspections.put({
    id: inspection.id,
    data: inspection,
    updatedAt: Date.now(),
  });
}

/**
 * 작업 데이터 일괄 저장
 */
export async function saveInspections(inspections: MyInspection[]): Promise<void> {
  const records = inspections.map((inspection) => ({
    id: inspection.id,
    data: inspection,
    updatedAt: Date.now(),
  }));
  await db.inspections.bulkPut(records);
}

/**
 * 작업 데이터 조회
 */
export async function getInspection(id: string): Promise<MyInspection | null> {
  const record = await db.inspections.get(id);
  return record?.data || null;
}

/**
 * 모든 작업 데이터 조회
 */
export async function getAllInspections(): Promise<MyInspection[]> {
  const records = await db.inspections.toArray();
  return records.map((record) => record.data);
}

/**
 * 상태 변경 큐에 추가
 */
export async function queueStatusChange(
  inspectionId: string,
  newStatus: string
): Promise<number> {
  const id = await db.statusChangeQueue.add({
    inspectionId,
    newStatus,
    timestamp: Date.now(),
    retryCount: 0,
  });
  return id as number;
}

/**
 * 상태 변경 큐 조회
 */
export async function getStatusChangeQueue(): Promise<StatusChangeQueue[]> {
  return await db.statusChangeQueue.toArray();
}

/**
 * 상태 변경 큐 항목 삭제
 */
export async function removeStatusChangeQueue(id: number): Promise<void> {
  await db.statusChangeQueue.delete(id);
}

/**
 * 상태 변경 큐 항목 업데이트 (재시도 카운트 증가)
 */
export async function updateStatusChangeQueue(
  id: number,
  retryCount: number,
  lastError?: string
): Promise<void> {
  await db.statusChangeQueue.update(id, {
    retryCount,
    lastError,
  });
}

/**
 * 대시보드 통계 캐시 저장
 */
export async function saveDashboardStats(data: any): Promise<void> {
  await db.dashboardStats.put({
    id: 'stats',
    data,
    updatedAt: Date.now(),
  });
}

/**
 * 대시보드 통계 캐시 조회
 */
export async function getDashboardStats(): Promise<any | null> {
  const record = await db.dashboardStats.get('stats');
  return record?.data || null;
}

/**
 * 배정 요청 캐시 저장
 */
export async function saveAssignments(assignments: any[]): Promise<void> {
  const records = assignments.map((assignment) => ({
    id: assignment.id,
    data: assignment,
    updatedAt: Date.now(),
  }));
  await db.assignments.bulkPut(records);
}

/**
 * 배정 요청 캐시 조회
 */
export async function getAssignments(): Promise<any[]> {
  const records = await db.assignments.toArray();
  return records.map((record) => record.data);
}

/**
 * 오래된 캐시 데이터 정리 (7일 이상)
 */
export async function cleanupOldCache(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  await db.inspections
    .where('updatedAt')
    .below(sevenDaysAgo)
    .delete();
  
  await db.assignments
    .where('updatedAt')
    .below(sevenDaysAgo)
    .delete();
}

