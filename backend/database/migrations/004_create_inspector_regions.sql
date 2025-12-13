-- 004_create_inspector_regions.sql
-- 기사 활동 지역 다중 선택 지원을 위한 마이그레이션
-- users 테이블의 region_id를 제거하고 inspector_regions 테이블을 생성

-- ============================================
-- 1. inspector_regions 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS inspector_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES service_regions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inspector_region UNIQUE (user_id, region_id)
);

-- 인덱스 생성
CREATE INDEX idx_inspector_regions_user_id ON inspector_regions(user_id);
CREATE INDEX idx_inspector_regions_region_id ON inspector_regions(region_id);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_inspector_regions_updated_at
    BEFORE UPDATE ON inspector_regions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE inspector_regions IS '기사 활동 지역 매핑 테이블 (다대다 관계)';
COMMENT ON COLUMN inspector_regions.user_id IS '기사 ID';
COMMENT ON COLUMN inspector_regions.region_id IS '활동 지역 ID';

-- ============================================
-- 2. 기존 데이터 마이그레이션
-- ============================================

-- users 테이블에서 role='inspector'이고 region_id가 있는 모든 레코드를
-- inspector_regions 테이블로 복사
INSERT INTO inspector_regions (user_id, region_id, created_at, updated_at)
SELECT 
    id AS user_id,
    region_id,
    created_at,
    updated_at
FROM users
WHERE role = 'inspector' 
  AND region_id IS NOT NULL
ON CONFLICT (user_id, region_id) DO NOTHING;

-- ============================================
-- 3. users 테이블 수정
-- ============================================

-- inspector_region_check 제약 조건 제거
ALTER TABLE users DROP CONSTRAINT IF EXISTS inspector_region_check;

-- region_id 컬럼 제거
ALTER TABLE users DROP COLUMN IF EXISTS region_id;

-- inspector_level_check 제약 조건은 유지 (등급은 여전히 필수)

COMMENT ON TABLE users IS '사용자 통합 테이블 (고객/기사/운영자) - 활동 지역은 inspector_regions 테이블에서 관리';

