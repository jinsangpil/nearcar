-- 알림 템플릿 테이블 생성
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('alimtalk', 'sms', 'email')),
    template_id VARCHAR(50),  -- 외부 서비스 템플릿 ID (카카오 알림톡 등)
    subject VARCHAR(200),  -- 이메일 제목 (이메일 채널용)
    content TEXT NOT NULL,  -- Jinja2 템플릿 형식
    variables TEXT[],  -- 사용 가능한 변수 목록
    is_active VARCHAR(10) NOT NULL DEFAULT 'true' CHECK (is_active IN ('true', 'false')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notification_templates IS '알림 템플릿 관리';
COMMENT ON COLUMN notification_templates.template_id IS '외부 서비스 템플릿 ID (카카오 알림톡 등)';
COMMENT ON COLUMN notification_templates.content IS 'Jinja2 템플릿 형식의 내용';
COMMENT ON COLUMN notification_templates.variables IS '템플릿에서 사용 가능한 변수 목록';

-- 인덱스 생성
CREATE INDEX idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX idx_notification_templates_is_active ON notification_templates(is_active);
CREATE INDEX idx_notification_templates_name ON notification_templates(name);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

