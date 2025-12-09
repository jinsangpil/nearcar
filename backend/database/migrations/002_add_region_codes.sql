-- 서비스 지역 테이블에 코드 필드 추가
-- province_code: 광역시도 코드 (11, 21, 22 등)
-- city_code: 시군구 코드

ALTER TABLE service_regions 
ADD COLUMN IF NOT EXISTS province_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS city_code VARCHAR(5);

-- 기존 데이터에 대한 코드 업데이트는 수동으로 진행 필요
-- UNIQUE 제약조건에 코드 추가 고려 (선택사항)
-- ALTER TABLE service_regions ADD CONSTRAINT unique_province_city_code UNIQUE (province_code, city_code);

COMMENT ON COLUMN service_regions.province_code IS '광역시도 코드 (11: 서울, 21: 부산 등)';
COMMENT ON COLUMN service_regions.city_code IS '시군구 코드 (공공데이터포털 API에서 제공)';

