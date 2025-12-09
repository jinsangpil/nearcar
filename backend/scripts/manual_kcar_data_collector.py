#!/usr/bin/env python3
"""
KCar 웹사이트에서 수동으로 수집한 차량 정보를 데이터베이스에 저장하는 스크립트

사용법:
1. KCar 웹사이트(https://www.kcar.com)에서 차량 정보를 확인합니다
2. 아래 형식에 맞춰 JSON 파일을 작성합니다
3. 이 스크립트를 실행하여 데이터베이스에 저장합니다

JSON 파일 형식:
[
  {
    "origin": "domestic",
    "manufacturer": "현대",
    "model_group": "아반떼",
    "model_detail": "더 뉴 아반떼",
    "vehicle_class": "compact",
    "start_year": 2020,
    "end_year": null,
    "is_active": true
  },
  ...
]
"""
import httpx
import asyncio
import json
import sys
from pathlib import Path

API_BASE_URL = "http://localhost:8000/api/v1"

# 차량 등급 매핑
VEHICLE_CLASS_MAP = {
    "경차": "compact",
    "소형": "small",
    "준중형": "small",
    "중형": "mid",
    "준대형": "mid",
    "대형": "large",
    "SUV": "suv",
    "스포츠카": "sports",
    "슈퍼카": "supercar",
}


def validate_vehicle_data(vehicle: dict) -> tuple:
    """
    차량 데이터 유효성 검증
    
    Returns:
        (is_valid, error_message)
    """
    required_fields = ["origin", "manufacturer", "model_group", "vehicle_class", "start_year"]
    
    for field in required_fields:
        if field not in vehicle:
            return False, f"필수 필드 누락: {field}"
    
    if vehicle["origin"] not in ["domestic", "imported"]:
        return False, "origin은 'domestic' 또는 'imported'여야 합니다"
    
    if vehicle["vehicle_class"] not in ["compact", "small", "mid", "large", "suv", "sports", "supercar"]:
        return False, f"유효하지 않은 vehicle_class: {vehicle['vehicle_class']}"
    
    if not isinstance(vehicle["start_year"], int) or vehicle["start_year"] < 1900 or vehicle["start_year"] > 2100:
        return False, "start_year는 1900~2100 사이의 정수여야 합니다"
    
    if vehicle.get("end_year") is not None:
        if not isinstance(vehicle["end_year"], int) or vehicle["end_year"] < 1900 or vehicle["end_year"] > 2100:
            return False, "end_year는 1900~2100 사이의 정수이거나 null이어야 합니다"
    
    return True, ""


async def load_and_save_vehicles(json_file_path: str):
    """
    JSON 파일에서 차량 정보를 읽어서 데이터베이스에 저장합니다
    
    Args:
        json_file_path: JSON 파일 경로
    """
    # JSON 파일 읽기
    try:
        with open(json_file_path, "r", encoding="utf-8") as f:
            vehicles = json.load(f)
    except FileNotFoundError:
        print(f"❌ 파일을 찾을 수 없습니다: {json_file_path}")
        return
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {str(e)}")
        return
    
    if not isinstance(vehicles, list):
        print("❌ JSON 파일은 배열 형식이어야 합니다")
        return
    
    print(f"📦 JSON 파일에서 {len(vehicles)}개 차량 정보 로드 완료")
    
    # 데이터 유효성 검증
    valid_vehicles = []
    invalid_count = 0
    
    for i, vehicle in enumerate(vehicles, 1):
        is_valid, error_msg = validate_vehicle_data(vehicle)
        if is_valid:
            valid_vehicles.append(vehicle)
        else:
            print(f"⚠️ 항목 {i} 유효성 검증 실패: {error_msg}")
            invalid_count += 1
    
    if invalid_count > 0:
        print(f"⚠️ {invalid_count}개 항목이 유효성 검증에 실패했습니다")
    
    if not valid_vehicles:
        print("❌ 유효한 차량 데이터가 없습니다")
        return
    
    print(f"✅ {len(valid_vehicles)}개 유효한 차량 데이터 확인")
    
    # 관리자 로그인
    async with httpx.AsyncClient(timeout=30.0) as client:
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
                print(login_response.text)
                return
            
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            print("✅ 로그인 성공")
            
            # 일괄 동기화 API 호출
            print("📤 데이터베이스에 저장 중...")
            sync_response = await client.post(
                f"{API_BASE_URL}/admin/vehicles/master/sync",
                json={"data": valid_vehicles},
                headers=headers
            )
            
            if sync_response.status_code == 200:
                result = sync_response.json()["data"]
                print()
                print("=" * 60)
                print("✅ 동기화 완료!")
                print("=" * 60)
                print(f"생성된 건수: {result['created']}건")
                print(f"업데이트된 건수: {result['updated']}건")
                print(f"실패한 건수: {result['failed']}건")
                
                if result.get("errors") and len(result["errors"]) > 0:
                    print()
                    print("에러 목록:")
                    for error in result["errors"]:
                        print(f"  - {error}")
            else:
                print(f"❌ 동기화 실패: {sync_response.status_code}")
                print(sync_response.text)
                
        except httpx.TimeoutException:
            print("❌ 요청 타임아웃: 서버가 응답하지 않습니다")
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")


def create_example_json():
    """
    예시 JSON 파일을 생성합니다
    """
    example_data = [
        {
            "origin": "domestic",
            "manufacturer": "현대",
            "model_group": "아반떼",
            "model_detail": "더 뉴 아반떼",
            "vehicle_class": "compact",
            "start_year": 2020,
            "end_year": None,
            "is_active": True,
        },
        {
            "origin": "domestic",
            "manufacturer": "현대",
            "model_group": "소나타",
            "model_detail": "더 뉴 소나타",
            "vehicle_class": "mid",
            "start_year": 2019,
            "end_year": None,
            "is_active": True,
        },
        {
            "origin": "domestic",
            "manufacturer": "기아",
            "model_group": "K5",
            "model_detail": "더 뉴 K5",
            "vehicle_class": "mid",
            "start_year": 2020,
            "end_year": None,
            "is_active": True,
        },
        {
            "origin": "imported",
            "manufacturer": "BMW",
            "model_group": "3시리즈",
            "model_detail": "320i",
            "vehicle_class": "mid",
            "start_year": 2019,
            "end_year": None,
            "is_active": True,
        },
        {
            "origin": "imported",
            "manufacturer": "벤츠",
            "model_group": "C클래스",
            "model_detail": "C200",
            "vehicle_class": "mid",
            "start_year": 2019,
            "end_year": None,
            "is_active": True,
        },
    ]
    
    output_file = "backend/scripts/kcar_vehicles_example.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(example_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 예시 JSON 파일 생성 완료: {output_file}")
    print(f"   총 {len(example_data)}개 차량 정보")
    print()
    print("이 파일을 수정하여 실제 KCar 데이터를 추가하세요.")


async def main():
    """
    메인 함수
    """
    print("=" * 60)
    print("KCar 차량 정보 수집 및 저장 스크립트")
    print("=" * 60)
    print()
    
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    else:
        print("사용법:")
        print("  python scripts/manual_kcar_data_collector.py <json_file>")
        print()
        print("또는")
        print("  python scripts/manual_kcar_data_collector.py --create-example")
        print("  (예시 JSON 파일 생성)")
        print()
        
        if "--create-example" in sys.argv:
            create_example_json()
            return
        
        json_file = input("JSON 파일 경로 (기본값: kcar_vehicles_example.json): ").strip()
        if not json_file:
            json_file = "backend/scripts/kcar_vehicles_example.json"
    
    if json_file == "--create-example":
        create_example_json()
        return
    
    # 파일 경로 확인
    if not Path(json_file).exists():
        print(f"❌ 파일을 찾을 수 없습니다: {json_file}")
        print()
        print("예시 파일을 생성하시겠습니까? (y/n): ", end="")
        if input().strip().lower() == "y":
            create_example_json()
        return
    
    await load_and_save_vehicles(json_file)


if __name__ == "__main__":
    asyncio.run(main())

