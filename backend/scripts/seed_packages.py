"""
패키지 시드 데이터 생성 스크립트
"""
import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_db_session
from app.services.package_service import PackageService


async def seed_packages():
    """패키지 기본 데이터 생성"""
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
    
    async with get_db_session() as db:
        for pkg_data in packages:
            try:
                result = await PackageService.create_package(
                    db=db,
                    name=pkg_data["name"],
                    base_price=pkg_data["base_price"],
                    included_items=pkg_data["included_items"]
                )
                print(f"✅ 패키지 생성 성공: {result['name']} ({result['id']})")
            except ValueError as e:
                if "이미 사용 중인" in str(e):
                    print(f"⚠️  패키지 이미 존재: {pkg_data['name']}")
                else:
                    print(f"❌ 패키지 생성 실패: {pkg_data['name']} - {e}")
            except Exception as e:
                print(f"❌ 패키지 생성 실패: {pkg_data['name']} - {e}")


if __name__ == "__main__":
    print("패키지 시드 데이터 생성 시작...")
    asyncio.run(seed_packages())
    print("완료!")

