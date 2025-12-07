-- 니어카 데이터베이스 초기 데이터 시드 스크립트
-- PostgreSQL 15+ 버전 기준
-- 생성일: 2025-12-07

-- ============================================
-- 1. 서비스 지역 및 출장비 기본 데이터
-- ============================================

INSERT INTO service_regions (province, city, extra_fee, is_active) VALUES
-- 서울
('서울', '강남구', 0, true),
('서울', '서초구', 0, true),
('서울', '송파구', 0, true),
('서울', '강동구', 0, true),
('서울', '영등포구', 0, true),
('서울', '마포구', 0, true),
('서울', '용산구', 0, true),
('서울', '종로구', 0, true),
('서울', '중구', 0, true),
('서울', '성동구', 0, true),
('서울', '광진구', 0, true),
('서울', '강서구', 0, true),
('서울', '양천구', 0, true),
('서울', '구로구', 0, true),
('서울', '금천구', 0, true),
('서울', '관악구', 0, true),
('서울', '서대문구', 0, true),
('서울', '은평구', 0, true),
('서울', '노원구', 0, true),
('서울', '도봉구', 0, true),
('서울', '강북구', 0, true),
('서울', '성북구', 0, true),
('서울', '중랑구', 0, true),
('서울', '동대문구', 0, true),
('서울', '종로구', 0, true),

-- 경기
('경기', '수원시', 5000, true),
('경기', '성남시', 5000, true),
('경기', '고양시', 5000, true),
('경기', '용인시', 5000, true),
('경기', '부천시', 5000, true),
('경기', '안산시', 5000, true),
('경기', '안양시', 5000, true),
('경기', '평택시', 10000, true),
('경기', '시흥시', 5000, true),
('경기', '김포시', 5000, true),
('경기', '광명시', 5000, true),
('경기', '이천시', 10000, true),
('경기', '양주시', 10000, true),
('경기', '오산시', 10000, true),
('경기', '구리시', 5000, true),
('경기', '안성시', 10000, true),
('경기', '포천시', 15000, true),
('경기', '의정부시', 10000, true),
('경기', '하남시', 5000, true),
('경기', '여주시', 15000, true),

-- 인천
('인천', '남동구', 5000, true),
('인천', '연수구', 5000, true),
('인천', '미추홀구', 5000, true),
('인천', '부평구', 5000, true),
('인천', '계양구', 5000, true),
('인천', '서구', 5000, true),
('인천', '중구', 5000, true),
('인천', '동구', 5000, true),
('인천', '강화군', 15000, true),
('인천', '옹진군', 20000, true),

-- 기타 광역시
('부산', '해운대구', 10000, true),
('부산', '사하구', 10000, true),
('부산', '금정구', 10000, true),
('대구', '수성구', 10000, true),
('대구', '달서구', 10000, true),
('광주', '광산구', 10000, true),
('대전', '유성구', 10000, true),
('울산', '남구', 10000, true);

-- ============================================
-- 2. 차량 등급별 추가 요금 정책 기본 데이터
-- ============================================

INSERT INTO price_policies (origin, vehicle_class, add_amount) VALUES
-- 국산차
('domestic', 'compact', 0),
('domestic', 'small', 0),
('domestic', 'mid', 0),
('domestic', 'large', 10000),
('domestic', 'suv', 15000),
('domestic', 'sports', 30000),
('domestic', 'supercar', 50000),

-- 수입차
('imported', 'compact', 10000),
('imported', 'small', 10000),
('imported', 'mid', 20000),
('imported', 'large', 30000),
('imported', 'suv', 40000),
('imported', 'sports', 50000),
('imported', 'supercar', 100000);

-- ============================================
-- 3. 진단 패키지 기본 데이터
-- ============================================

INSERT INTO packages (name, base_price, included_items, is_active) VALUES
('라이트A', 50000, '{
  "sections": [
    {
      "name": "외관",
      "items": ["전면 유리", "운전석 도어", "후면 범퍼"]
    },
    {
      "name": "엔진룸",
      "items": ["엔진 오일", "냉각수", "배터리"]
    }
  ]
}'::jsonb, true),

('라이트B', 70000, '{
  "sections": [
    {
      "name": "외관",
      "items": ["전면 유리", "후면 유리", "운전석 도어", "조수석 도어", "전면 범퍼", "후면 범퍼"]
    },
    {
      "name": "엔진룸",
      "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터"]
    },
    {
      "name": "실내",
      "items": ["시트", "대시보드", "계기판"]
    }
  ]
}'::jsonb, true),

('스탠다드', 100000, '{
  "sections": [
    {
      "name": "외관",
      "items": ["전면 유리", "후면 유리", "측면 유리", "운전석 도어", "조수석 도어", "후석 도어", "전면 범퍼", "후면 범퍼", "트렁크"]
    },
    {
      "name": "엔진룸",
      "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터", "브레이크 오일", "파워스티어링 오일"]
    },
    {
      "name": "실내",
      "items": ["시트", "대시보드", "계기판", "에어백", "안전벨트"]
    },
    {
      "name": "하부",
      "items": ["서스펜션", "브레이크 패드", "타이어"]
    }
  ]
}'::jsonb, true),

('프리미엄', 150000, '{
  "sections": [
    {
      "name": "외관",
      "items": ["전면 유리", "후면 유리", "측면 유리", "모든 도어", "전면 범퍼", "후면 범퍼", "트렁크", "루프", "사이드 미러"]
    },
    {
      "name": "엔진룸",
      "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터", "브레이크 오일", "파워스티어링 오일", "와이퍼 블레이드", "라디에이터"]
    },
    {
      "name": "실내",
      "items": ["시트", "대시보드", "계기판", "에어백", "안전벨트", "인포테인먼트", "에어컨"]
    },
    {
      "name": "하부",
      "items": ["서스펜션", "브레이크 패드", "타이어", "배기관", "연료 탱크"]
    },
    {
      "name": "전기/전자",
      "items": ["헤드라이트", "테일라이트", "방향지시등", "와이퍼 모터"]
    }
  ]
}'::jsonb, true),

('풀패키지', 200000, '{
  "sections": [
    {
      "name": "외관",
      "items": ["전면 유리", "후면 유리", "측면 유리", "모든 도어", "전면 범퍼", "후면 범퍼", "트렁크", "루프", "사이드 미러", "휠", "타이어"]
    },
    {
      "name": "엔진룸",
      "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터", "브레이크 오일", "파워스티어링 오일", "와이퍼 블레이드", "라디에이터", "벨트", "호스"]
    },
    {
      "name": "실내",
      "items": ["시트", "대시보드", "계기판", "에어백", "안전벨트", "인포테인먼트", "에어컨", "히터", "선루프"]
    },
    {
      "name": "하부",
      "items": ["서스펜션", "브레이크 패드", "타이어", "배기관", "연료 탱크", "드라이브샤프트", "디퍼렌셜"]
    },
    {
      "name": "전기/전자",
      "items": ["헤드라이트", "테일라이트", "방향지시등", "와이퍼 모터", "파워 윈도우", "파워 도어락"]
    },
    {
      "name": "추가 검사",
      "items": ["침수 여부", "사고 이력", "도색 상태", "용접 상태"]
    }
  ]
}'::jsonb, true);

-- ============================================
-- 4. 차량 마스터 데이터 (국산차 주요 모델)
-- ============================================

INSERT INTO vehicle_master (origin, manufacturer, model_group, model_detail, vehicle_class, start_year, end_year, is_active) VALUES
-- 현대
('domestic', '현대', '아반떼', '아반떼', 'compact', 1990, NULL, true),
('domestic', '현대', '아반떼', '더 뉴 아반떼', 'compact', 2020, NULL, true),
('domestic', '현대', '소나타', '소나타', 'mid', 1985, NULL, true),
('domestic', '현대', '소나타', '더 뉴 소나타', 'mid', 2019, NULL, true),
('domestic', '현대', '그랜저', '그랜저', 'large', 1986, NULL, true),
('domestic', '현대', '그랜저', '더 뉴 그랜저 IG', 'large', 2020, NULL, true),
('domestic', '현대', '아이오닉', '아이오닉 5', 'suv', 2021, NULL, true),
('domestic', '현대', '투싼', '투싼', 'suv', 2004, NULL, true),
('domestic', '현대', '싼타페', '싼타페', 'suv', 2000, NULL, true),
('domestic', '현대', '팰리세이드', '팰리세이드', 'suv', 2018, NULL, true),
('domestic', '현대', '코나', '코나', 'suv', 2017, NULL, true),
('domestic', '현대', '벨로스터', '벨로스터 N', 'sports', 2018, NULL, true),

-- 기아
('domestic', '기아', 'K3', 'K3', 'compact', 2012, NULL, true),
('domestic', '기아', 'K5', 'K5', 'mid', 2010, NULL, true),
('domestic', '기아', 'K7', 'K7', 'large', 2009, NULL, true),
('domestic', '기아', 'K8', 'K8', 'large', 2021, NULL, true),
('domestic', '기아', '니로', '니로', 'suv', 2016, NULL, true),
('domestic', '기아', '스포티지', '스포티지', 'suv', 1993, NULL, true),
('domestic', '기아', '쏘렌토', '쏘렌토', 'suv', 2002, NULL, true),
('domestic', '기아', '모하비', '모하비', 'suv', 2008, NULL, true),
('domestic', '기아', '셀토스', '셀토스', 'suv', 2019, NULL, true),
('domestic', '기아', '스팅어', '스팅어', 'sports', 2017, NULL, true),

-- 쌍용
('domestic', '쌍용', '티볼리', '티볼리', 'suv', 2015, NULL, true),
('domestic', '쌍용', '코란도', '코란도', 'suv', 2011, NULL, true),
('domestic', '쌍용', '렉스턴', '렉스턴', 'suv', 2001, NULL, true),
('domestic', '쌍용', '무쏘', '무쏘', 'suv', 2002, NULL, true),

-- 제네시스
('domestic', '제네시스', 'G70', 'G70', 'mid', 2017, NULL, true),
('domestic', '제네시스', 'G80', 'G80', 'large', 2016, NULL, true),
('domestic', '제네시스', 'G90', 'G90', 'large', 2015, NULL, true),
('domestic', '제네시스', 'GV70', 'GV70', 'suv', 2020, NULL, true),
('domestic', '제네시스', 'GV80', 'GV80', 'suv', 2020, NULL, true),
('domestic', '제네시스', 'GV90', 'GV90', 'suv', 2023, NULL, true);

-- ============================================
-- 5. 차량 마스터 데이터 (수입차 주요 모델)
-- ============================================

INSERT INTO vehicle_master (origin, manufacturer, model_group, model_detail, vehicle_class, start_year, end_year, is_active) VALUES
-- BMW
('imported', 'BMW', '3시리즈', '320i', 'mid', 1975, NULL, true),
('imported', 'BMW', '3시리즈', '330i', 'mid', 1975, NULL, true),
('imported', 'BMW', '5시리즈', '520i', 'large', 1972, NULL, true),
('imported', 'BMW', '5시리즈', '530i', 'large', 1972, NULL, true),
('imported', 'BMW', '7시리즈', '730Li', 'large', 1977, NULL, true),
('imported', 'BMW', 'X3', 'X3', 'suv', 2003, NULL, true),
('imported', 'BMW', 'X5', 'X5', 'suv', 1999, NULL, true),
('imported', 'BMW', 'X7', 'X7', 'suv', 2018, NULL, true),
('imported', 'BMW', 'M3', 'M3', 'sports', 1986, NULL, true),
('imported', 'BMW', 'M5', 'M5', 'sports', 1984, NULL, true),

-- 벤츠
('imported', '벤츠', 'C클래스', 'C200', 'mid', 1993, NULL, true),
('imported', '벤츠', 'C클래스', 'C300', 'mid', 1993, NULL, true),
('imported', '벤츠', 'E클래스', 'E200', 'large', 1953, NULL, true),
('imported', '벤츠', 'E클래스', 'E300', 'large', 1953, NULL, true),
('imported', '벤츠', 'S클래스', 'S350', 'large', 1972, NULL, true),
('imported', '벤츠', 'S클래스', 'S500', 'large', 1972, NULL, true),
('imported', '벤츠', 'GLC', 'GLC', 'suv', 2015, NULL, true),
('imported', '벤츠', 'GLE', 'GLE', 'suv', 1997, NULL, true),
('imported', '벤츠', 'GLS', 'GLS', 'suv', 2006, NULL, true),
('imported', '벤츠', 'AMG GT', 'AMG GT', 'sports', 2014, NULL, true),

-- 아우디
('imported', '아우디', 'A4', 'A4', 'mid', 1994, NULL, true),
('imported', '아우디', 'A6', 'A6', 'large', 1994, NULL, true),
('imported', '아우디', 'A8', 'A8', 'large', 1994, NULL, true),
('imported', '아우디', 'Q5', 'Q5', 'suv', 2008, NULL, true),
('imported', '아우디', 'Q7', 'Q7', 'suv', 2005, NULL, true),
('imported', '아우디', 'R8', 'R8', 'supercar', 2006, NULL, true),

-- 포르쉐
('imported', '포르쉐', '911', '911', 'sports', 1963, NULL, true),
('imported', '포르쉐', '카이엔', '카이엔', 'suv', 2002, NULL, true),
('imported', '포르쉐', '마칸', '마칸', 'suv', 2013, NULL, true),
('imported', '포르쉐', '파나메라', '파나메라', 'sports', 2009, NULL, true),

-- 테슬라
('imported', '테슬라', '모델 3', '모델 3', 'mid', 2017, NULL, true),
('imported', '테슬라', '모델 S', '모델 S', 'large', 2012, NULL, true),
('imported', '테슬라', '모델 X', '모델 X', 'suv', 2015, NULL, true),
('imported', '테슬라', '모델 Y', '모델 Y', 'suv', 2020, NULL, true),

-- 렉서스
('imported', '렉서스', 'ES', 'ES250', 'mid', 1989, NULL, true),
('imported', '렉서스', 'ES', 'ES300h', 'mid', 1989, NULL, true),
('imported', '렉서스', 'LS', 'LS500', 'large', 1989, NULL, true),
('imported', '렉서스', 'RX', 'RX350', 'suv', 1998, NULL, true),
('imported', '렉서스', 'NX', 'NX300', 'suv', 2014, NULL, true),

-- 볼보
('imported', '볼보', 'S60', 'S60', 'mid', 2000, NULL, true),
('imported', '볼보', 'S90', 'S90', 'large', 2016, NULL, true),
('imported', '볼보', 'XC60', 'XC60', 'suv', 2008, NULL, true),
('imported', '볼보', 'XC90', 'XC90', 'suv', 2002, NULL, true);

-- ============================================
-- 6. 관리자 계정 초기 설정
-- ============================================

-- 주의: 실제 운영 시에는 비밀번호를 안전하게 해싱하여 저장해야 합니다.
-- 아래는 예시이며, 실제로는 애플리케이션에서 passlib 등을 사용하여 해싱해야 합니다.

-- 관리자 계정 (비밀번호: admin123! - 실제 운영 시 변경 필요)
-- 비밀번호 해시는 애플리케이션 레벨에서 생성하여 저장해야 합니다.
-- INSERT INTO users (role, name, phone, email, password_hash, status)
-- VALUES ('admin', '시스템 관리자', '010-0000-0000', 'admin@nearcar.com', 'hashed_password_here', 'active');

-- ============================================
-- 7. 데이터 검증 쿼리
-- ============================================

-- 데이터 삽입 확인
SELECT 'service_regions' AS table_name, COUNT(*) AS count FROM service_regions
UNION ALL
SELECT 'price_policies', COUNT(*) FROM price_policies
UNION ALL
SELECT 'packages', COUNT(*) FROM packages
UNION ALL
SELECT 'vehicle_master', COUNT(*) FROM vehicle_master;

-- 차량 마스터 데이터 통계
SELECT 
    origin,
    manufacturer,
    COUNT(*) AS model_count
FROM vehicle_master
GROUP BY origin, manufacturer
ORDER BY origin, manufacturer;

