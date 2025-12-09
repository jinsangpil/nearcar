-- 차량 마스터 구조 분리 마이그레이션
-- vehicle_master 테이블을 manufacturers와 vehicle_models로 분리
-- 생성일: 2025-12-09

-- ============================================
-- 1. manufacturers 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    origin VARCHAR(20) NOT NULL CHECK (origin IN ('domestic', 'imported')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, origin)
);

COMMENT ON TABLE manufacturers IS '제조사 마스터 데이터';
COMMENT ON COLUMN manufacturers.origin IS '국산/수입 구분';

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_manufacturers_updated_at
    BEFORE UPDATE ON manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. vehicle_models 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE RESTRICT,
    model_group VARCHAR(100) NOT NULL,
    model_detail VARCHAR(100),
    vehicle_class VARCHAR(20) NOT NULL CHECK (
        vehicle_class IN ('compact', 'small', 'mid', 'large', 'suv', 'sports', 'supercar')
    ),
    start_year INT NOT NULL CHECK (start_year >= 1900 AND start_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    end_year INT CHECK (end_year IS NULL OR (end_year >= start_year AND end_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1)),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manufacturer_id, model_group, model_detail)
);

COMMENT ON TABLE vehicle_models IS '차량 모델 마스터 데이터';
COMMENT ON COLUMN vehicle_models.manufacturer_id IS '제조사 ID (manufacturers 테이블 참조)';
COMMENT ON COLUMN vehicle_models.vehicle_class IS '차량 등급 (가격 정책 매핑용)';

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_vehicle_models_updated_at
    BEFORE UPDATE ON vehicle_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_models_manufacturer_id ON vehicle_models(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_model_group ON vehicle_models(model_group);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name_origin ON manufacturers(name, origin);

