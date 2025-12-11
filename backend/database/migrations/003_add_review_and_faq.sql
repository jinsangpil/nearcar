-- 003_add_review_and_faq.sql
-- 리뷰 및 FAQ 테이블 생성

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    photos JSONB,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inspection_review UNIQUE (inspection_id)
);

CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

COMMENT ON TABLE reviews IS '서비스 이용 후기';
COMMENT ON COLUMN reviews.user_id IS '작성자 ID';
COMMENT ON COLUMN reviews.inspection_id IS '관련 진단 ID';
COMMENT ON COLUMN reviews.rating IS '별점 (1-5)';
COMMENT ON COLUMN reviews.photos IS '사진 URL 목록 (JSON 배열)';
COMMENT ON COLUMN reviews.is_hidden IS '블라인드 처리 여부';

-- FAQs Table
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_faqs_category ON faqs(category);
CREATE INDEX idx_faqs_display_order ON faqs(display_order);

COMMENT ON TABLE faqs IS '자주 묻는 질문';
COMMENT ON COLUMN faqs.category IS '카테고리 (payment, refund, etc)';
COMMENT ON COLUMN faqs.display_order IS '표시 순서';
