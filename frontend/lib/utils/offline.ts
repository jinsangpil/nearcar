/**
 * 오프라인 감지 및 동기화 유틸리티
 */
import { updateInspectionStatus } from '@/lib/api/inspector';
import {
  getStatusChangeQueue,
  removeStatusChangeQueue,
  updateStatusChangeQueue,
} from '@/lib/db/inspectorDB';

/**
 * 온라인 상태 확인
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

/**
 * 온라인 상태 변경 리스너 등록
 */
export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * 상태 변경 큐 동기화 (온라인 복귀 시 호출)
 */
export async function syncStatusChangeQueue(): Promise<void> {
  if (!isOnline()) return;
  
  const queue = await getStatusChangeQueue();
  
  for (const item of queue) {
    try {
      await updateInspectionStatus(item.inspectionId, item.newStatus as any);
      
      // 성공 시 큐에서 제거
      await removeStatusChangeQueue(item.id!);
    } catch (error: any) {
      // 실패 시 재시도 카운트 증가
      const retryCount = item.retryCount + 1;
      const lastError = error.message || '알 수 없는 오류';
      
      // 최대 3회 재시도
      if (retryCount >= 3) {
        // 최대 재시도 횟수 초과 시 큐에서 제거
        await removeStatusChangeQueue(item.id!);
        console.error(
          `상태 변경 큐 동기화 실패 (최대 재시도 초과): ${item.inspectionId}`,
          error
        );
      } else {
        await updateStatusChangeQueue(item.id!, retryCount, lastError);
      }
    }
  }
}

/**
 * 주기적으로 큐 동기화 (온라인 상태일 때만)
 */
export function startQueueSync(interval: number = 30000): () => void {
  if (typeof window === 'undefined') return () => {};
  
  // 즉시 한 번 실행
  syncStatusChangeQueue();
  
  // 주기적으로 실행
  const intervalId = setInterval(() => {
    if (isOnline()) {
      syncStatusChangeQueue();
    }
  }, interval);
  
  // 온라인 상태 변경 시에도 동기화
  const unsubscribe = onOnlineStatusChange((isOnline) => {
    if (isOnline) {
      syncStatusChangeQueue();
    }
  });
  
  return () => {
    clearInterval(intervalId);
    unsubscribe();
  };
}

