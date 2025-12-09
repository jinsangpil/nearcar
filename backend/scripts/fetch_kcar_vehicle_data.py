#!/usr/bin/env python3
"""
KCar 웹사이트 API를 사용하여 차량 정보를 수집하여 차량 마스터 데이터를 생성하는 스크립트

주의사항:
1. 이 스크립트는 KCar 웹사이트의 공개 API를 사용합니다
2. 웹사이트의 이용약관을 준수해야 합니다
3. 과도한 요청은 서버에 부하를 줄 수 있으므로 적절한 딜레이를 두세요
4. 수집한 데이터는 검증 후 사용하세요

사용법:
    python scripts/fetch_kcar_vehicle_data.py
"""
import httpx
import asyncio
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

# KCar API 엔드포인트
KCAR_API_BASE = "https://api.kcar.com"

# 차량 등급 매핑 (KCar의 차량 분류를 우리 시스템의 vehicle_class로 매핑)
VEHICLE_CLASS_MAPPING = {
    "경차": "compact",
    "소형차": "small",
    "준중형차": "small",
    "중형차": "mid",
    "대형차": "large",
    "SUV": "suv",
    "RV": "suv",
    "스포츠카": "sports",
    "경승합차": "suv",
    "승합차": "suv",
    "화물차": "suv",
    "버스": "suv",
    "미지정": "mid",  # 기본값
    "기타": "mid",  # 기본값
}

# 제조사명 정규화 (KCar 표기 -> 우리 시스템 표기)
MANUFACTURER_MAPPING = {
    "현대": "현대",
    "기아": "기아",
    "KG모빌리티(쌍용)": "쌍용",
    "쌍용": "쌍용",
    "제네시스": "제네시스",
    "BMW": "BMW",
    "벤츠": "벤츠",
    "Mercedes-Benz": "벤츠",
    "아우디": "아우디",
    "Audi": "아우디",
    "포르쉐": "포르쉐",
    "Porsche": "포르쉐",
    "테슬라": "테슬라",
    "Tesla": "테슬라",
    "렉서스": "렉서스",
    "Lexus": "렉서스",
    "볼보": "볼보",
    "Volvo": "볼보",
    "도요타": "도요타",
    "Toyota": "도요타",
    "혼다": "혼다",
    "Honda": "혼다",
    "닛산": "닛산",
    "Nissan": "닛산",
    "인피니티": "인피니티",
    "Infinity": "인피니티",
    "캐딜락": "캐딜락",
    "Cadillac": "캐딜락",
    "링컨": "링컨",
    "Lincoln": "링컨",
    "재규어": "재규어",
    "Jaguar": "재규어",
    "랜드로버": "랜드로버",
    "Land Rover": "랜드로버",
    "미니": "미니",
    "Mini": "미니",
    "폭스바겐": "폭스바겐",
    "Volkswagen": "폭스바겐",
    "포드": "포드",
    "Ford": "포드",
    "지프": "지프",
    "Jeep": "지프",
    "쉐보레(GM대우)": "쉐보레",
    "쉐보레": "쉐보레",
    "Chevrolet": "쉐보레",
    "르노코리아(삼성)": "르노삼성",
    "마세라티": "마세라티",
    "Maserati": "마세라티",
    "푸조": "푸조",
    "Peugeot": "푸조",
    "시트로엥": "시트로엥",
    "Citroen": "시트로엥",
    "피아트": "피아트",
    "Fiat": "피아트",
    "스마트": "스마트",
    "Smart": "스마트",
    "스바루": "스바루",
    "Subaru": "스바루",
    "마쯔다": "마쯔다",
    "Mazda": "마쯔다",
    "스즈키": "스즈키",
    "Suzuki": "스즈키",
    "다이하쯔": "다이하쯔",
    "Daihatsu": "다이하쯔",
    "어큐라": "어큐라",
    "Acura": "어큐라",
    "BYD": "BYD",
    "폴스타": "폴스타",
    "Polestar": "폴스타",
}


async def fetch_manufacturers() -> List[Dict[str, Any]]:
    """
    KCar API에서 제조사 목록을 가져옵니다
    
    Returns:
        제조사 정보 리스트
    """
    url = f"{KCAR_API_BASE}/bc/search/group/mnuftr"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json={})
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data"):
                    return data["data"]
                else:
                    print(f"⚠️ API 응답에 데이터가 없습니다: {data}")
                    return []
            else:
                print(f"⚠️ API 호출 실패: {response.status_code}")
                print(f"   응답: {response.text[:200]}")
                return []
                
    except httpx.TimeoutException:
        print(f"⚠️ 요청 타임아웃: {url}")
        return []
    except Exception as e:
        print(f"⚠️ 오류 발생: {str(e)}")
        return []


async def fetch_vehicle_categories() -> Dict[str, str]:
    """
    KCar API에서 차량 카테고리 정보를 가져옵니다
    
    Returns:
        카테고리 코드 -> 이름 매핑 딕셔너리
    """
    url = f"{KCAR_API_BASE}/bc/sub-code"
    params = {"sMstCode": "CAR_CATEGORY"}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data") and data["data"].get("list"):
                    categories = {}
                    for item in data["data"]["list"]:
                        categories[item["subCd"]] = item["subCdNm"]
                    return categories
                else:
                    print(f"⚠️ API 응답에 데이터가 없습니다: {data}")
                    return {}
            else:
                print(f"⚠️ API 호출 실패: {response.status_code}")
                return {}
                
    except Exception as e:
        print(f"⚠️ 오류 발생: {str(e)}")
        return {}


async def fetch_model_groups(mnuftr_cd: str, car_type: str) -> List[Dict[str, Any]]:
    """
    특정 제조사의 모델 그룹 목록을 가져옵니다
    
    Args:
        mnuftr_cd: 제조사 코드
        car_type: 차량 타입 (KOR 또는 IMP)
    
    Returns:
        모델 그룹 정보 리스트
    """
    url = f"{KCAR_API_BASE}/bc/search/group/model"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json={"mnuftrCd": mnuftr_cd, "carType": car_type})
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data"):
                    return data["data"]
            
            return []
                
    except Exception as e:
        print(f"⚠️ 모델 그룹 조회 오류 (제조사 코드: {mnuftr_cd}): {str(e)}")
        return []


async def fetch_vehicle_category_for_model(mnuftr_cd: str, model_grp_cd: str, car_type: str) -> Optional[str]:
    """
    특정 모델 그룹의 카테고리 정보를 실제 차량 검색을 통해 가져옵니다
    
    Args:
        mnuftr_cd: 제조사 코드
        model_grp_cd: 모델 그룹 코드
        car_type: 차량 타입 (KOR 또는 IMP)
    
    Returns:
        카테고리 코드 (예: "001", "002" 등) 또는 None
    """
    url = f"{KCAR_API_BASE}/bc/search"
    
    try:
        search_cond = {
            "mnuftrCd": mnuftr_cd,
            "modelGrpCd": model_grp_cd,
            "carType": car_type
        }
        
        params = {
            "searchCond": json.dumps(search_cond),
            "page": 1,
            "pageSize": 1
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data") and data["data"].get("list"):
                    vehicle = data["data"]["list"][0]
                    # carctgrCd 또는 categoryCd 필드 확인
                    category_cd = vehicle.get("carctgrCd") or vehicle.get("categoryCd") or vehicle.get("wr_in_carctgr_cd")
                    if category_cd:
                        return str(category_cd)
            
            return None
                
    except Exception as e:
        # 오류 발생 시 None 반환 (조용히 실패)
        return None


def parse_production_year(prdcn_year_str: str) -> tuple[Optional[int], Optional[int]]:
    """
    생산 연도 문자열을 파싱하여 시작 연도와 종료 연도를 반환합니다
    
    예시:
        "(24년~현재)" -> (2024, None)
        "(16~20년)" -> (2016, 2020)
        "(15~19년)" -> (2015, 2019)
    
    Args:
        prdcn_year_str: 생산 연도 문자열
    
    Returns:
        (start_year, end_year) 튜플
    """
    if not prdcn_year_str:
        return (None, None)
    
    import re
    
    # 현재 연도 가져오기
    current_year = datetime.now().year
    
    # "(24년~현재)" 형식 처리
    if "현재" in prdcn_year_str or "~" in prdcn_year_str:
        match = re.search(r'\((\d+)년', prdcn_year_str)
        if match:
            year = int(match.group(1))
            # 2자리 연도는 2000년대로 변환
            if year < 100:
                start_year = 2000 + year if year < 50 else 1900 + year
            else:
                start_year = year
            return (start_year, None)
    
    # "(16~20년)" 형식 처리
    match = re.search(r'\((\d+)~(\d+)년\)', prdcn_year_str)
    if match:
        start = int(match.group(1))
        end = int(match.group(2))
        # 2자리 연도는 2000년대로 변환
        if start < 100:
            start_year = 2000 + start if start < 50 else 1900 + start
        else:
            start_year = start
        if end < 100:
            end_year = 2000 + end if end < 50 else 1900 + end
        else:
            end_year = end
        return (start_year, end_year)
    
    # 단일 연도 처리
    match = re.search(r'(\d+)년', prdcn_year_str)
    if match:
        year = int(match.group(1))
        if year < 100:
            year = 2000 + year if year < 50 else 1900 + year
        return (year, None)
    
    return (None, None)


def parse_manufacturer_data(manufacturer: Dict[str, Any]) -> Dict[str, Any]:
    """
    KCar 제조사 데이터를 우리 시스템 형식으로 변환합니다
    
    Args:
        manufacturer: KCar에서 가져온 제조사 데이터
    
    Returns:
        변환된 제조사 정보
    """
    mnuftr_nm = manufacturer.get("mnuftrNm", "")
    car_type = manufacturer.get("carType", "")
    
    # 제조사명 정규화
    normalized_name = MANUFACTURER_MAPPING.get(mnuftr_nm, mnuftr_nm)
    
    # 국산/수입 판단
    origin = "domestic" if car_type == "KOR" else "imported"
    
    return {
        "mnuftr_cd": manufacturer.get("mnuftrCd", ""),
        "mnuftr_nm": normalized_name,
        "origin": origin,
        "count": manufacturer.get("count", 0),
    }


def determine_vehicle_class(model_name: str, model_group_name: str, categories: Dict[str, str] = None) -> str:
    """
    모델명과 모델 그룹명을 기반으로 차량 등급을 결정합니다
    
    Args:
        model_name: 모델명
        model_group_name: 모델 그룹명
        categories: KCar 카테고리 매핑 (선택사항)
    
    Returns:
        vehicle_class 값
    """
    # 모델명과 모델 그룹명을 합쳐서 검색 (대소문자 구분 없이)
    search_text = f"{model_name} {model_group_name}".lower()
    
    # 슈퍼카 관련 키워드 (가장 먼저 체크)
    supercar_keywords = ["라페라리", "ferrari", "맥라렌", "mclaren", "부가티", "bugatti", "코닉세그", "koenigsegg",
                        "파가니", "pagani", "람보르기니", "lamborghini", "아벤타도르", "aventador", "우라칸", "huracan",
                        "베네온", "veneno", "센테나리오", "centenario"]
    
    # 스포츠카 관련 키워드
    sports_keywords = ["코벳", "corvette", "카마로", "camaro", "머스탱", "mustang", "챌린저", "challenger",
                      "911", "박스터", "boxster", "카이맨", "cayman", "아벤타도르", "우라칸",
                      "458", "488", "f8", "amg gt", "gt", "m3", "m4", "m5", "m8", "rs3", "rs4", "rs5", "rs6", "rs7",
                      "gtr", "gt-r", "supra", "수프라", "nsx", "r8", "i8", "lc", "rc f", "rcf"]
    
    # SUV 관련 키워드 (더 많은 키워드 추가)
    suv_keywords = ["suv", "캠리", "camry", "캠퍼", "팰리세이드", "palisade", "싼타페", "santafe", "투싼", "tucson",
                    "스포티지", "sportage", "셀토스", "seltos", "니로", "niro", "코나", "kona", "티구안", "tiguan",
                    "투아렉", "touareg", "카이엔", "cayenne", "마칸", "macan", "렉서스 nx", "lexus nx", "렉서스 rx", "lexus rx",
                    "렉서스 gx", "lexus gx", "렉서스 lx", "lexus lx", "bmw x1", "bmw x2", "bmw x3", "bmw x4", "bmw x5",
                    "bmw x6", "bmw x7", "벤츠 gl", "벤츠 gle", "벤츠 glc", "벤츠 gla", "벤츠 glb", "벤츠 gls",
                    "아우디 q3", "아우디 q5", "아우디 q7", "아우디 q8", "볼보 xc40", "볼보 xc60", "볼보 xc90",
                    "랜드로버", "land rover", "레인지로버", "range rover", "지프", "jeep", "랭글러", "wrangler",
                    "하이랜더", "highlander", "rav4", "크루즈", "cruze", "트레일블레이저", "trailblazer",
                    "탐조", "tamzo", "코란도", "korando", "렉스턴", "rexton", "티볼리", "tivoli", "qm6", "qm5",
                    "qm3", "캡티바", "captiva", "트래버스", "traverse", "타호", "tahoe", "서버댠", "suburban",
                    "익스플로러", "explorer", "익스페디션", "expedition", "에스컬레이드", "escalade", "네비게이터", "navigator"]
    
    # 경차 관련 키워드
    compact_keywords = ["레이", "ray", "모닝", "morning", "스파크", "spark", "아토스", "atos", "마티즈", "matiz",
                       "프라이드", "pride", "엑센트", "accent", "i10", "i20", "픽업", "pickup"]
    
    # 소형차 관련 키워드
    small_keywords = ["아반떼", "avante", "엘란트라", "elantra", "포르테", "forte", "K3", "소나타", "sonata",
                     "말리부", "malibu", "크루즈", "cruze", "i30", "i40", "벨로스터", "veloster", "K5", "K7",
                     "옵티마", "optima", "K9", "K8", "캠리", "camry", "코롤라", "corolla", "시빅", "civic",
                     "센트리", "century", "임팔라", "impala", "a3", "a4", "c-클래스", "c-class", "1시리즈", "1 series",
                     "2시리즈", "2 series", "3시리즈", "3 series", "cla", "clb"]
    
    # 중형차 관련 키워드 (명시적으로 중형차인 모델들)
    mid_keywords = ["K5", "k5", "소나타", "sonata", "말리부", "malibu", "옵티마", "optima", "a4", "a5",
                   "4시리즈", "4 series", "c-클래스", "c-class", "e-클래스", "e-class", "cla", "clb", "cle",
                   "bmw 3", "벤츠 c", "아우디 a4", "아우디 a5", "볼보 s60", "볼보 v60", "인피니티 q50", "q50",
                   "혼다 어코드", "accord", "닛산 알티마", "altima", "도요타 캠리", "캠리"]
    
    # 대형차 관련 키워드
    large_keywords = ["그랜저", "grandeur", "제네시스", "genesis", "K9", "K8", "K7", "아슬란", "aslan",
                     "아벤티스", "aventis", "렉서스 es", "lexus es", "렉서스 ls", "lexus ls", "렉서스 gs", "lexus gs",
                     "bmw 5", "bmw 7", "bmw 8", "5시리즈", "5 series", "7시리즈", "7 series", "8시리즈", "8 series",
                     "벤츠 e", "벤츠 s", "e-클래스", "e-class", "s-클래스", "s-class", "벤츠 cls", "벤츠 cla", "벤츠 cle",
                     "아우디 a6", "아우디 a8", "아우디 a7", "a6", "a7", "a8", "a6 e-트론", "a6 e-tron",
                     "볼보 s90", "볼보 s80", "s90", "s80", "캐딜락 cts", "캐딜락 cts-v", "캐딜락 xts", "cts", "xts",
                     "링컨 컨티넨탈", "continental", "mkz", "재규어 xf", "jaguar xf", "재규어 xj", "jaguar xj",
                     "xf", "xj", "인피니티 q70", "q70", "혼다 레전드", "legend", "닛산 맥시마", "maxima"]
    
    # 키워드 기반 분류 (우선순위: 슈퍼카 > 스포츠카 > SUV > 경차 > 대형차 > 중형차 > 소형차 > 기본값)
    if any(keyword in search_text for keyword in supercar_keywords):
        return "supercar"
    elif any(keyword in search_text for keyword in sports_keywords):
        return "sports"
    elif any(keyword in search_text for keyword in suv_keywords):
        return "suv"
    elif any(keyword in search_text for keyword in compact_keywords):
        return "compact"
    elif any(keyword in search_text for keyword in large_keywords):
        return "large"
    elif any(keyword in search_text for keyword in mid_keywords):
        return "mid"
    elif any(keyword in search_text for keyword in small_keywords):
        return "small"
    
    # 기본값은 중형차 (키워드 매칭 실패 시)
    return "mid"


async def generate_vehicle_masters_with_models(
    manufacturers: List[Dict[str, Any]], 
    categories: Dict[str, str] = None
) -> List[Dict[str, Any]]:
    """
    제조사 정보와 실제 모델 정보를 기반으로 차량 마스터 데이터를 생성합니다
    
    Args:
        manufacturers: 제조사 정보 리스트
        categories: KCar 카테고리 매핑 (선택사항)
    
    Returns:
        차량 마스터 데이터 리스트
    """
    vehicles = []
    
    # 차량 등급 기본값
    default_vehicle_class = "mid"
    
    for mfr in manufacturers:
        mnuftr_cd = mfr.get("mnuftr_cd", "")
        mnuftr_nm = mfr.get("mnuftr_nm", "")
        origin = mfr.get("origin", "domestic")
        count = mfr.get("count", 0)
        
        # 차량이 없는 제조사는 스킵
        if count == 0:
            continue
        
        car_type = "KOR" if origin == "domestic" else "IMP"
        
        print(f"  📦 {mnuftr_nm} 모델 정보 수집 중...")
        
        # 모델 그룹 가져오기
        model_groups = await fetch_model_groups(mnuftr_cd, car_type)
        
        if not model_groups:
            print(f"    ⚠️ {mnuftr_nm}에 대한 모델 정보 없음. 기본 모델 그룹 추가.")
            # 모델 정보가 없는 경우 기본 모델 그룹 추가
            vehicle = {
                "origin": origin,
                "manufacturer": mnuftr_nm,
                "model_group": mnuftr_nm,
                "model_detail": None,
                "vehicle_class": default_vehicle_class,
                "start_year": 2000,
                "end_year": None,
                "is_active": True,
            }
            vehicles.append(vehicle)
            continue
        
        # 모델 그룹별로 그룹화 (modelGrpCd 기준)
        # API 응답에 다른 제조사의 모델이 포함될 수 있으므로 필터링
        model_groups_dict = {}
        for model in model_groups:
            # 해당 제조사의 모델만 필터링
            model_mnuftr_cd = model.get("mnuftrCd", "")
            if model_mnuftr_cd != mnuftr_cd:
                continue
            
            model_grp_cd = model.get("modelGrpCd", "")
            model_nm = model.get("modelNm", "")
            path_nm = model.get("pathNm", "")
            
            if not model_grp_cd:
                continue
            
            # pathNm 파싱: "제조사명,모델그룹명,세부모델명" 형식
            # 예: "현대,i30,i30 (PD)" -> 제조사: "현대", 모델그룹: "i30", 세부모델: "i30 (PD)"
            path_manufacturer = None
            path_model_group = None
            path_model_detail = None
            
            if path_nm:
                parts = [p.strip() for p in path_nm.split(",")]
                if len(parts) >= 1:
                    path_manufacturer = parts[0]  # pathNm에서 제조사명 추출
                if len(parts) >= 2:
                    path_model_group = parts[1]
                if len(parts) >= 3:
                    path_model_detail = parts[2]
            
            # 제조사명 결정: pathNm에서 추출한 제조사명 우선, 없으면 mnuftr_nm 사용
            # pathNm의 제조사명이 더 정확하므로 우선 사용
            actual_manufacturer = path_manufacturer or mnuftr_nm
            # 제조사명 정규화 적용
            actual_manufacturer = MANUFACTURER_MAPPING.get(actual_manufacturer, actual_manufacturer)
            
            # 모델 그룹명 결정: pathNm의 두 번째 부분 우선, 없으면 modelNm 사용
            model_group_name = path_model_group or model_nm
            
            # modelGrpCd를 키로 사용하여 그룹화
            if model_grp_cd not in model_groups_dict:
                # 실제 차량 검색을 통해 카테고리 정보 가져오기
                vehicle_category_cd = await fetch_vehicle_category_for_model(mnuftr_cd, model_grp_cd, car_type)
                category_nm = None
                if vehicle_category_cd and categories:
                    category_nm = categories.get(vehicle_category_cd, "")
                
                model_groups_dict[model_grp_cd] = {
                    "model_group_name": model_group_name,
                    "models": [],
                    "category_cd": vehicle_category_cd or model.get("categoryCd", ""),  # 실제 검색으로 가져온 카테고리 코드 우선
                    "category_nm": category_nm or model.get("categoryNm", ""),  # 카테고리명 저장
                }
            
            # 생산 연도 파싱
            prdcn_year = model.get("prdcnYear", "")
            start_year, end_year = parse_production_year(prdcn_year)
            
            # 세부 모델명 결정: pathNm의 세 번째 부분 우선, 없으면 modelNm 사용
            # 단, 세부 모델명이 모델 그룹명과 같으면 None으로 설정
            model_detail_name = path_model_detail or model_nm
            if model_detail_name == model_group_name:
                model_detail_name = None
            
            model_groups_dict[model_grp_cd]["models"].append({
                "model_nm": model_nm,
                "model_detail_name": model_detail_name,  # 정확한 세부 모델명
                "path_manufacturer": actual_manufacturer,  # pathNm에서 추출한 정규화된 제조사명
                "model_cd": model.get("modelCd", ""),
                "start_year": start_year,
                "end_year": end_year,
                "count": model.get("count", 0),
                "category_cd": model.get("categoryCd", ""),  # 개별 모델의 카테고리 코드
                "category_nm": model.get("categoryNm", ""),  # 개별 모델의 카테고리명
            })
        
        # 모델 그룹별로 차량 마스터 데이터 생성
        for model_grp_cd, group_data in model_groups_dict.items():
            model_group_name = group_data["model_group_name"]
            models = group_data["models"]
            category_cd = group_data.get("category_cd", "")
            category_nm = group_data.get("category_nm", "")
            
            # 활성 모델만 필터링 (count > 0)
            active_models = [m for m in models if m.get("count", 0) > 0]
            
            if not active_models:
                # 활성 모델이 없으면 모델 그룹 자체를 추가
                # 카테고리 정보 우선, 없으면 모델명 기반 추론
                vehicle_class = default_vehicle_class
                
                if category_nm and category_nm in VEHICLE_CLASS_MAPPING:
                    vehicle_class = VEHICLE_CLASS_MAPPING[category_nm]
                elif category_cd and categories and category_cd in categories:
                    category_name = categories[category_cd]
                    vehicle_class = VEHICLE_CLASS_MAPPING.get(category_name, default_vehicle_class)
                
                if vehicle_class == default_vehicle_class:
                    vehicle_class = determine_vehicle_class(model_group_name, model_group_name, categories)
                
                vehicle = {
                    "origin": origin,
                    "manufacturer": actual_manufacturer,  # pathNm에서 추출한 정규화된 제조사명 사용
                    "model_group": model_group_name,
                    "model_detail": None,
                    "vehicle_class": vehicle_class,
                    "start_year": 2000,
                    "end_year": None,
                    "is_active": True,
                }
                vehicles.append(vehicle)
                continue
            
            # 각 모델별로 차량 마스터 데이터 생성
            for model in active_models:
                model_nm = model["model_nm"]
                model_detail_name = model.get("model_detail_name")  # pathNm에서 추출한 정확한 세부 모델명
                model_category_cd = model.get("category_cd", category_cd)
                model_category_nm = model.get("category_nm", category_nm)
                # pathNm에서 추출한 제조사명 (이미 정규화됨)
                model_manufacturer = model.get("path_manufacturer") or actual_manufacturer
                
                # 차량 등급 결정: 카테고리명 -> 카테고리 코드 -> 모델명 기반 추론
                vehicle_class = default_vehicle_class
                if model_category_nm and model_category_nm in VEHICLE_CLASS_MAPPING:
                    vehicle_class = VEHICLE_CLASS_MAPPING[model_category_nm]
                elif model_category_cd and categories and model_category_cd in categories:
                    category_name = categories[model_category_cd]
                    vehicle_class = VEHICLE_CLASS_MAPPING.get(category_name, default_vehicle_class)
                else:
                    # 모델명 기반 추론 (세부 모델명이 있으면 세부 모델명 사용)
                    search_text = model_detail_name or model_nm
                    vehicle_class = determine_vehicle_class(search_text, model_group_name, categories)
                
                vehicle = {
                    "origin": origin,
                    "manufacturer": model_manufacturer,  # pathNm에서 추출한 정규화된 제조사명 사용
                    "model_group": model_group_name,
                    "model_detail": model_detail_name,  # pathNm에서 추출한 정확한 세부 모델명 사용
                    "vehicle_class": vehicle_class,
                    "start_year": model["start_year"] or 2000,
                    "end_year": model["end_year"],
                    "is_active": True,
                }
                vehicles.append(vehicle)
        
        # 현재 제조사에 대한 차량 마스터 개수 계산
        current_mfr_vehicles = [v for v in vehicles if v['manufacturer'] == mnuftr_nm]
        print(f"    ✅ {mnuftr_nm}: {len(model_groups_dict)}개 모델 그룹, {len(current_mfr_vehicles)}개 차량 마스터 생성")
        
        # API 부하 방지를 위한 딜레이
        await asyncio.sleep(0.5)
    
    return vehicles


async def save_to_database(vehicles: List[Dict[str, Any]]):
    """
    수집한 차량 정보를 데이터베이스에 저장합니다 (API를 통해)
    새로운 구조(manufacturers, vehicle_models)에 맞게 저장
    
    Args:
        vehicles: 차량 정보 리스트
    """
    API_BASE_URL = "http://localhost:8000/api/v1"
    
    # 관리자 로그인
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            login_response = await client.post(
                f"{API_BASE_URL}/auth/login",
                json={
                    "email": "admin@nearcar.com",
                    "password": "12341234"
                }
            )
            
            if login_response.status_code != 200:
                print(f"❌ 로그인 실패: {login_response.status_code}")
                return
            
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            print("✅ 로그인 성공")
            
            # 1. 제조사 중복 제거 및 생성
            print("\n📦 제조사 데이터 처리 중...")
            manufacturer_map: Dict[Tuple[str, str], str] = {}  # (name, origin) -> id
            
            # 고유한 제조사 목록 추출 (제조사명 정규화 적용)
            unique_manufacturers = {}
            for vehicle in vehicles:
                # 제조사명 정규화
                raw_manufacturer = vehicle["manufacturer"]
                normalized_manufacturer = MANUFACTURER_MAPPING.get(raw_manufacturer, raw_manufacturer)
                
                key = (normalized_manufacturer, vehicle["origin"])
                if key not in unique_manufacturers:
                    unique_manufacturers[key] = {
                        "name": normalized_manufacturer,
                        "origin": vehicle["origin"],
                        "is_active": True
                    }
            
            print(f"   발견된 고유 제조사: {len(unique_manufacturers)}개")
            
            # 각 제조사 생성 또는 조회
            for (name, origin), data in unique_manufacturers.items():
                # 기존 제조사 조회
                list_response = await client.get(
                    f"{API_BASE_URL}/admin/manufacturers",
                    params={"name": name, "origin": origin, "limit": 1},
                    headers=headers
                )
                
                if list_response.status_code == 200:
                    existing_manufacturers = list_response.json().get("data", {}).get("items", [])
                    if existing_manufacturers:
                        manufacturer_map[(name, origin)] = existing_manufacturers[0]["id"]
                        print(f"   ✓ {name} ({origin}) - 기존 데이터 사용")
                        continue
                
                # 새 제조사 생성
                create_response = await client.post(
                    f"{API_BASE_URL}/admin/manufacturers",
                    json=data,
                    headers=headers
                )
                
                if create_response.status_code == 200:
                    new_manufacturer = create_response.json().get("data", {})
                    manufacturer_map[(name, origin)] = new_manufacturer["id"]
                    print(f"   ✓ {name} ({origin}) - 새로 생성")
                else:
                    print(f"   ⚠️ {name} ({origin}) - 생성 실패: {create_response.status_code}")
                    if create_response.status_code == 400:
                        # 이미 존재하는 경우 (중복 에러)
                        error_detail = create_response.json().get("detail", "")
                        if "이미 존재" in error_detail:
                            # 다시 조회 시도
                            list_response = await client.get(
                                f"{API_BASE_URL}/admin/manufacturers",
                                params={"search": name, "origin": origin, "limit": 100},
                                headers=headers
                            )
                            if list_response.status_code == 200:
                                items = list_response.json().get("data", {}).get("items", [])
                                for item in items:
                                    if item["name"] == name and item["origin"] == origin:
                                        manufacturer_map[(name, origin)] = item["id"]
                                        print(f"   ✓ {name} ({origin}) - 기존 데이터 사용 (재조회)")
                                        break
            
            print(f"✅ {len(manufacturer_map)}개 제조사 처리 완료")
            
            # 2. 차량 모델 데이터 변환 및 동기화
            print("\n📦 차량 모델 데이터 처리 중...")
            vehicle_models = []
            for vehicle in vehicles:
                # 제조사명 정규화 (데이터베이스 저장 시에도 동일하게 적용)
                raw_manufacturer = vehicle["manufacturer"]
                normalized_manufacturer = MANUFACTURER_MAPPING.get(raw_manufacturer, raw_manufacturer)
                
                manufacturer_id = manufacturer_map.get((normalized_manufacturer, vehicle["origin"]))
                if not manufacturer_id:
                    print(f"   ⚠️ 제조사 ID를 찾을 수 없음: {normalized_manufacturer} ({vehicle['origin']}) [원본: {raw_manufacturer}]")
                    continue
                
                vehicle_models.append({
                    "manufacturer_id": manufacturer_id,
                    "model_group": vehicle["model_group"],
                    "model_detail": vehicle.get("model_detail"),
                    "vehicle_class": vehicle["vehicle_class"],
                    "start_year": vehicle["start_year"],
                    "end_year": vehicle.get("end_year"),
                    "is_active": vehicle.get("is_active", True)
                })
            
            # 일괄 동기화 API 호출
            sync_response = await client.post(
                f"{API_BASE_URL}/admin/vehicle-models/sync",
                json={"items": vehicle_models},
                headers=headers
            )
            
            if sync_response.status_code == 200:
                result = sync_response.json()["data"]
                print(f"✅ 동기화 완료:")
                print(f"   - 생성: {result.get('created', 0)}건")
                print(f"   - 업데이트: {result.get('updated', 0)}건")
                print(f"   - 실패: {result.get('failed', 0)}건")
                if result.get('errors'):
                    print(f"   - 에러 목록:")
                    for error in result['errors'][:10]:  # 최대 10개만 표시
                        print(f"     * {error}")
                    if len(result['errors']) > 10:
                        print(f"     ... 외 {len(result['errors']) - 10}개 에러")
            else:
                print(f"❌ 동기화 실패: {sync_response.status_code}")
                print(sync_response.text)
                
        except httpx.TimeoutException:
            print("❌ 요청 타임아웃: 서버가 응답하지 않습니다")
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")
            import traceback
            traceback.print_exc()


async def save_to_json_file(vehicles: List[Dict[str, Any]], filename: str = "kcar_vehicles.json"):
    """
    수집한 차량 정보를 JSON 파일로 저장합니다
    
    Args:
        vehicles: 차량 정보 리스트
        filename: 저장할 파일명
    """
    import os
    
    # 스크립트가 있는 디렉토리 기준으로 경로 설정
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, filename)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(vehicles, f, ensure_ascii=False, indent=2)
    
    print(f"✅ JSON 파일 저장 완료: {output_path}")
    print(f"   총 {len(vehicles)}개 차량 정보")


async def main(choice: Optional[str] = None):
    """
    메인 함수
    
    Args:
        choice: 선택 옵션 ("1", "2", "3", "4" 또는 None)
    """
    print("=" * 60)
    print("KCar 차량 정보 수집 스크립트")
    print("=" * 60)
    print()
    print("⚠️  주의사항:")
    print("   1. 이 스크립트는 KCar 웹사이트의 공개 API를 사용합니다")
    print("   2. 웹사이트의 이용약관을 준수해야 합니다")
    print("   3. 과도한 요청은 서버에 부하를 줄 수 있으므로 적절한 딜레이를 두세요")
    print("   4. 수집한 데이터는 검증 후 사용하세요")
    print()
    
    # 제조사 목록 가져오기
    print("📦 KCar에서 제조사 정보 수집 중...")
    manufacturers_raw = await fetch_manufacturers()
    
    if not manufacturers_raw:
        print("❌ 제조사 정보를 가져올 수 없습니다")
        return
    
    print(f"✅ {len(manufacturers_raw)}개 제조사 정보 수집 완료")
    
    # 제조사 데이터 파싱
    manufacturers = [parse_manufacturer_data(mfr) for mfr in manufacturers_raw]
    
    # 차량 카테고리 정보 가져오기
    print("📦 차량 카테고리 정보 수집 중...")
    categories = await fetch_vehicle_categories()
    if categories:
        print(f"✅ {len(categories)}개 차량 카테고리 정보 수집 완료")
    
    # 실제 모델 정보를 포함한 차량 마스터 데이터 생성
    print("📝 차량 마스터 데이터 생성 중 (실제 모델 정보 포함)...")
    vehicles = await generate_vehicle_masters_with_models(manufacturers, categories)
    
    print(f"✅ {len(vehicles)}개 차량 마스터 데이터 생성 완료")
    print()
    
    # 제조사별 통계 출력
    print("📊 제조사별 통계:")
    for mfr in manufacturers:
        if mfr["count"] > 0:
            print(f"   - {mfr['mnuftr_nm']} ({mfr['origin']}): {mfr['count']}대")
    print()
    
    # 사용자에게 선택권 제공 (인자가 없을 경우만)
    if choice is None:
        print("선택:")
        print("1. JSON 파일로 저장")
        print("2. 데이터베이스에 저장")
        print("3. 둘 다 저장")
        print("4. 종료")
        
        try:
            choice = input("\n선택 (1-4, 기본값: 3): ").strip() or "3"
        except (EOFError, KeyboardInterrupt):
            print("\n⚠️ 입력이 중단되었습니다. 기본값(3: 둘 다 저장)으로 진행합니다.")
            choice = "3"
    else:
        print(f"선택된 옵션: {choice}")
    
    if choice == "1" or choice == "3":
        await save_to_json_file(vehicles)
    
    if choice == "2" or choice == "3":
        await save_to_database(vehicles)
    
    if choice == "4":
        print("종료합니다.")
        return
    
    print()
    print("=" * 60)
    print("✅ 작업 완료!")
    print("=" * 60)
    print()
    print("💡 참고:")
    print("   - 생성된 데이터는 기본 모델 그룹만 포함합니다")
    print("   - 실제 모델명은 KCar 웹사이트에서 확인하여 수동으로 업데이트하거나")
    print("   - 추가 API 엔드포인트를 찾아서 자동화할 수 있습니다")
    print("   - JSON 파일을 수정하여 더 정확한 데이터를 추가할 수 있습니다")


if __name__ == "__main__":
    import sys
    
    # 필요한 패키지 확인
    try:
        import httpx
    except ImportError:
        print("❌ 필요한 패키지가 설치되지 않았습니다.")
        print("   설치: pip install httpx")
        exit(1)
    
    # 명령줄 인자 처리
    choice = None
    if len(sys.argv) > 1:
        choice = sys.argv[1]
        if choice not in ["1", "2", "3", "4"]:
            print(f"⚠️ 잘못된 옵션: {choice}")
            print("사용법: python fetch_kcar_vehicle_data.py [1|2|3|4]")
            print("  1: JSON 파일로 저장")
            print("  2: 데이터베이스에 저장")
            print("  3: 둘 다 저장 (기본값)")
            print("  4: 종료")
            exit(1)
    
    asyncio.run(main(choice))
