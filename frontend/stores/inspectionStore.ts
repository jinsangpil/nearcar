/**
 * 고객 신청 플로우 상태 관리 스토어
 * Zustand를 사용하여 신청 폼 데이터를 관리합니다.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 차량 정보
export interface VehicleInfo {
  plate_number?: string;
  origin?: 'domestic' | 'imported';
  manufacturer?: string;
  model_group?: string;
  model_id?: string;
  model_detail?: string;
  vehicle_class?: string;
  year?: number;
  mileage?: number;
}

// 견적 정보
export interface QuoteInfo {
  region_id?: string;
  province?: string;
  city?: string;
  package_id?: string;
  base_price?: number;
  vehicle_surcharge?: number;
  region_surcharge?: number;
  total_amount?: number;
}

// 일정 정보
export interface ScheduleInfo {
  date?: string;
  time?: string;
}

// 본인 인증 정보
export interface AuthInfo {
  phone?: string;
  verification_code?: string;
  is_verified?: boolean;
  privacy_agreed?: boolean;
}

// 신청 폼 전체 상태
export interface InspectionFormState {
  // 단계 관리
  currentStep: number;
  setCurrentStep: (step: number) => void;
  
  // 차량 정보
  vehicleInfo: VehicleInfo;
  setVehicleInfo: (info: Partial<VehicleInfo>) => void;
  clearVehicleInfo: () => void;
  
  // 견적 정보
  quoteInfo: QuoteInfo;
  setQuoteInfo: (info: Partial<QuoteInfo>) => void;
  clearQuoteInfo: () => void;
  
  // 일정 정보
  scheduleInfo: ScheduleInfo;
  setScheduleInfo: (info: Partial<ScheduleInfo>) => void;
  clearScheduleInfo: () => void;
  
  // 본인 인증 정보
  authInfo: AuthInfo;
  setAuthInfo: (info: Partial<AuthInfo>) => void;
  clearAuthInfo: () => void;
  
  // 전체 초기화
  resetForm: () => void;
}

const initialVehicleInfo: VehicleInfo = {};
const initialQuoteInfo: QuoteInfo = {};
const initialScheduleInfo: ScheduleInfo = {};
const initialAuthInfo: AuthInfo = {};

export const useInspectionStore = create<InspectionFormState>()(
  persist(
    (set) => ({
      // 단계 관리
      currentStep: 1,
      setCurrentStep: (step) => set({ currentStep: step }),
      
      // 차량 정보
      vehicleInfo: initialVehicleInfo,
      setVehicleInfo: (info) =>
        set((state) => ({
          vehicleInfo: { ...state.vehicleInfo, ...info },
        })),
      clearVehicleInfo: () => set({ vehicleInfo: initialVehicleInfo }),
      
      // 견적 정보
      quoteInfo: initialQuoteInfo,
      setQuoteInfo: (info) =>
        set((state) => ({
          quoteInfo: { ...state.quoteInfo, ...info },
        })),
      clearQuoteInfo: () => set({ quoteInfo: initialQuoteInfo }),
      
      // 일정 정보
      scheduleInfo: initialScheduleInfo,
      setScheduleInfo: (info) =>
        set((state) => ({
          scheduleInfo: { ...state.scheduleInfo, ...info },
        })),
      clearScheduleInfo: () => set({ scheduleInfo: initialScheduleInfo }),
      
      // 본인 인증 정보
      authInfo: initialAuthInfo,
      setAuthInfo: (info) =>
        set((state) => ({
          authInfo: { ...state.authInfo, ...info },
        })),
      clearAuthInfo: () => set({ authInfo: initialAuthInfo }),
      
      // 전체 초기화
      resetForm: () =>
        set({
          currentStep: 1,
          vehicleInfo: initialVehicleInfo,
          quoteInfo: initialQuoteInfo,
          scheduleInfo: initialScheduleInfo,
          authInfo: initialAuthInfo,
        }),
    }),
    {
      name: 'inspection-form-storage',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage 사용
    }
  )
);

