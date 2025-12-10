/**
 * Geolocation API 유틸리티
 */
export interface Position {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

/**
 * 현재 위치 조회
 */
export async function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API를 지원하지 않습니다'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0, // 캐시 사용 안 함
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(new Error(`위치 조회 실패: ${error.message}`));
      },
      options
    );
  });
}

/**
 * 위치 변경 감지 (watchPosition)
 */
export function watchPosition(
  callback: (position: Position) => void,
  errorCallback?: (error: Error) => void
): number {
  if (!navigator.geolocation) {
    if (errorCallback) {
      errorCallback(new Error('Geolocation API를 지원하지 않습니다'));
    }
    return -1;
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000, // 1분 캐시
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      if (errorCallback) {
        errorCallback(new Error(`위치 감지 실패: ${error.message}`));
      }
    },
    options
  );
}

/**
 * 위치 감지 중지
 */
export function clearWatch(watchId: number): void {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * 네비게이션 앱 딥링크 생성 (현재 위치 포함)
 */
export async function createNavigationLink(
  destination: string,
  includeCurrentLocation: boolean = false
): Promise<string> {
  let link = '';

  if (includeCurrentLocation) {
    try {
      const position = await getCurrentPosition();
      // 카카오맵: 현재 위치와 목적지 모두 포함
      link = `kakaomap://route?sp=${position.latitude},${position.longitude}&ep=${encodeURIComponent(destination)}`;
    } catch (error) {
      // 위치 조회 실패 시 목적지만 포함
      link = `kakaomap://route?ep=${encodeURIComponent(destination)}`;
    }
  } else {
    link = `kakaomap://route?ep=${encodeURIComponent(destination)}`;
  }

  return link;
}

