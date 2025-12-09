/**
 * 차량 관련 상수 정의
 * 국산/수입, 차량 등급 등의 한글명, 색상, 순서 등을 관리
 */

// 국산/수입 한글명 매핑
export const ORIGIN_NAMES: Record<string, string> = {
  domestic: '국산',
  imported: '수입',
};

// 국산/수입 순서
export const ORIGIN_ORDER: string[] = ['domestic', 'imported'];

// 국산/수입 색상 매핑
export const ORIGIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  domestic: {
    bg: 'bg-blue-100',
    text: 'text-blue-900',
    border: 'border-blue-300',
  },
  imported: {
    bg: 'bg-purple-100',
    text: 'text-purple-900',
    border: 'border-purple-300',
  },
};

// 차량 등급 한글명 매핑 (이미지 참고)
export const VEHICLE_CLASS_NAMES: Record<string, string> = {
  compact: '경차',
  small: '소형',
  mid: '중형',
  large: '대형',
  suv: 'SUV',
  sports: '스포츠',
  supercar: '슈퍼카',
};

// 차량 등급 순서 (이미지 참고: 경차, 소형, 준중형, 중형, 대형, 스포츠카, SUV, RV, 경승합차, 승합차, 화물차, 버스)
// 현재 시스템에 있는 등급만 포함
export const VEHICLE_CLASS_ORDER: string[] = [
  'compact',  // 경차
  'small',     // 소형
  'mid',       // 중형
  'large',     // 대형
  'suv',       // SUV
  'sports',     // 스포츠
  'supercar',   // 슈퍼카
];

// 차량 등급 색상 매핑
export const VEHICLE_CLASS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  compact: {
    bg: 'bg-green-100',
    text: 'text-green-900',
    border: 'border-green-300',
  },
  small: {
    bg: 'bg-blue-100',
    text: 'text-blue-900',
    border: 'border-blue-300',
  },
  mid: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-900',
    border: 'border-yellow-300',
  },
  large: {
    bg: 'bg-orange-100',
    text: 'text-orange-900',
    border: 'border-orange-300',
  },
  suv: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-900',
    border: 'border-indigo-300',
  },
  sports: {
    bg: 'bg-red-100',
    text: 'text-red-900',
    border: 'border-red-300',
  },
  supercar: {
    bg: 'bg-pink-100',
    text: 'text-pink-900',
    border: 'border-pink-300',
  },
};

// 헬퍼 함수들
export const getOriginName = (origin: string): string => {
  return ORIGIN_NAMES[origin] || origin;
};

export const getVehicleClassName = (vehicleClass: string): string => {
  return VEHICLE_CLASS_NAMES[vehicleClass] || vehicleClass;
};

export const getOriginColors = (origin: string): { bg: string; text: string; border: string } => {
  return ORIGIN_COLORS[origin] || { bg: 'bg-gray-100', text: 'text-gray-900', border: 'border-gray-300' };
};

export const getVehicleClassColors = (vehicleClass: string): { bg: string; text: string; border: string } => {
  return VEHICLE_CLASS_COLORS[vehicleClass] || { bg: 'bg-gray-100', text: 'text-gray-900', border: 'border-gray-300' };
};

