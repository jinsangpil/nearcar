/**
 * 유틸리티 함수
 */

/**
 * 숫자를 천 단위 콤마가 포함된 문자열로 변환
 */
export function formatNumberWithCommas(num: number): string {
  return num.toLocaleString('ko-KR');
}

