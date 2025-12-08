#!/usr/bin/env python3
"""
HTTP API를 통한 패키지 생성 스크립트
"""
import requests
import json
import os

# 어드민 계정으로 로그인
API_BASE_URL = "http://localhost:8000/api/v1"

# 로그인
login_response = requests.post(
    f"{API_BASE_URL}/auth/login",
    json={
        "email": "admin@nearcar.com",
        "password": "12341234"
    }
)

if login_response.status_code != 200:
    print(f"❌ 로그인 실패: {login_response.status_code}")
    print(login_response.text)
    exit(1)

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("✅ 로그인 성공")

# 생성할 패키지 데이터
packages = [
    {
        "name": "라이트A",
        "base_price": 80000,
        "included_items": {
            "sections": [
                {
                    "name": "외관",
                    "items": ["전면 유리", "후면 유리", "운전석 도어", "조수석 도어", "전면 범퍼", "후면 범퍼"]
                },
                {
                    "name": "엔진룸",
                    "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터"]
                }
            ]
        }
    },
    {
        "name": "라이트B",
        "base_price": 120000,
        "included_items": {
            "sections": [
                {
                    "name": "외관",
                    "items": ["전면 유리", "후면 유리", "측면 유리", "운전석 도어", "조수석 도어", "후석 도어", "전면 범퍼", "후면 범퍼"]
                },
                {
                    "name": "엔진룸",
                    "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터", "브레이크 오일"]
                },
                {
                    "name": "실내",
                    "items": ["시트", "대시보드", "계기판", "에어백"]
                }
            ]
        }
    },
    {
        "name": "풀옵션",
        "base_price": 250000,
        "included_items": {
            "sections": [
                {
                    "name": "외관",
                    "items": ["전면 유리", "후면 유리", "측면 유리", "운전석 도어", "조수석 도어", "후석 도어", "전면 범퍼", "후면 범퍼", "트렁크", "루프", "사이드 미러", "와이퍼"]
                },
                {
                    "name": "엔진룸",
                    "items": ["엔진 오일", "냉각수", "배터리", "에어컨 필터", "브레이크 오일", "파워스티어링 오일", "벨트", "호스", "라디에이터", "점화 플러그"]
                },
                {
                    "name": "실내",
                    "items": ["시트", "대시보드", "계기판", "에어백", "안전벨트", "인포테인먼트", "에어컨", "오디오", "실내등"]
                },
                {
                    "name": "하부",
                    "items": ["서스펜션", "브레이크 패드", "타이어", "배기관", "연료 탱크", "변속기"]
                },
                {
                    "name": "전기전자",
                    "items": ["헤드라이트", "테일라이트", "방향지시등", "와이퍼 모터", "파워윈도우", "중앙 도어록"]
                }
            ]
        }
    }
]

# 패키지 생성
for pkg in packages:
    response = requests.post(
        f"{API_BASE_URL}/admin/packages",
        headers=headers,
        json=pkg
    )
    
    if response.status_code == 200:
        data = response.json()["data"]
        print(f"✅ 패키지 생성 성공: {data['name']} (ID: {data['id']}, 가격: {data['base_price']:,}원)")
    elif response.status_code == 400 and "이미 사용 중인" in response.text:
        print(f"⚠️  패키지 이미 존재: {pkg['name']}")
    else:
        print(f"❌ 패키지 생성 실패: {pkg['name']} (상태 코드: {response.status_code})")
        print(f"   응답: {response.text}")

print("\n✅ 패키지 생성 완료!")

