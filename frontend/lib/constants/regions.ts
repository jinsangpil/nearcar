/**
 * 지역 관련 상수 정의
 * 공공데이터포털 기준 광역시도 코드 및 명칭
 */

// 광역시도 코드 및 명칭 매핑
export const PROVINCE_CODES: Record<string, { code: string; name: string }> = {
  '11': { code: '11', name: '서울특별시' },
  '21': { code: '21', name: '부산광역시' },
  '22': { code: '22', name: '대구광역시' },
  '23': { code: '23', name: '인천광역시' },
  '24': { code: '24', name: '광주광역시' },
  '25': { code: '25', name: '대전광역시' },
  '26': { code: '26', name: '울산광역시' },
  '31': { code: '31', name: '경기도' },
  '33': { code: '33', name: '강원특별자치도' },
  '34': { code: '34', name: '충청북도' },
  '35': { code: '35', name: '충청남도' },
  '36': { code: '36', name: '전라북도' },
  '37': { code: '37', name: '전라남도' },
  '38': { code: '38', name: '경상북도' },
  '39': { code: '39', name: '경상남도' },
  '41': { code: '41', name: '제주특별자치도' },
  '43': { code: '43', name: '세종특별자치시' },
};

// 광역시도 목록 (정렬된 순서)
export const PROVINCE_LIST = Object.values(PROVINCE_CODES).sort((a, b) => 
  parseInt(a.code) - parseInt(b.code)
);

// 코드로 이름 조회
export const getProvinceName = (code: string): string => {
  return PROVINCE_CODES[code]?.name || code;
};

// 이름으로 코드 조회
export const getProvinceCode = (name: string): string | undefined => {
  const entry = Object.entries(PROVINCE_CODES).find(([_, value]) => value.name === name);
  return entry ? entry[0] : undefined;
};

