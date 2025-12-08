#!/usr/bin/env python3
"""
관리자 계정 생성 스크립트
사용법: python scripts/create_admin.py [email] [password] [name]
기본값: admin@nearcar.com / 12341234 / 관리자
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 환경 변수 로드 (.env.local 우선, 없으면 .env)
env_local = project_root / ".env.local"
env_file = project_root / ".env"
if env_local.exists():
    load_dotenv(env_local)
elif env_file.exists():
    load_dotenv(env_file)

from app.core.database import get_db
from app.models.user import User
from app.core.security import encrypt_phone, get_password_hash
from sqlalchemy import select
import uuid


async def create_admin(email: str = "admin@nearcar.com", password: str = "12341234", name: str = "관리자"):
    """관리자 계정 생성"""
    async for db in get_db():
        try:
            # 기존 관리자 계정 확인
            result = await db.execute(
                select(User).where(User.email == email)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                if existing.role == 'admin':
                    print(f"⚠️  관리자 계정이 이미 존재합니다: {email}")
                    print(f"   계정 정보를 업데이트하시겠습니까? (y/n): ", end='')
                    # 자동으로 업데이트
                    update = True
                else:
                    print(f"⚠️  해당 이메일로 다른 역할의 계정이 존재합니다: {existing.role}")
                    return
            else:
                update = False
            
            # 비밀번호 해싱 (passlib 사용 시도, 실패하면 직접 bcrypt 사용)
            try:
                password_hash = get_password_hash(password)
            except Exception as e:
                # passlib 오류 시 직접 bcrypt 사용
                import bcrypt
                password_bytes = password.encode('utf-8')
                if len(password_bytes) > 72:
                    password_bytes = password_bytes[:72]
                password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
                print(f"⚠️  passlib 오류로 직접 bcrypt 사용: {str(e)}")
            
            # 전화번호 암호화 (기본값)
            phone_encrypted = encrypt_phone("010-0000-0000")
            
            if update:
                # 기존 계정 업데이트
                existing.password_hash = password_hash
                existing.name = name
                existing.role = 'admin'
                existing.status = 'active'
                print(f"✅ 관리자 계정이 업데이트되었습니다!")
            else:
                # 새 계정 생성
                admin = User(
                    id=uuid.uuid4(),
                    email=email,
                    password_hash=password_hash,
                    name=name,
                    phone=phone_encrypted,
                    role="admin",
                    status="active"
                )
                db.add(admin)
                print(f"✅ 관리자 계정이 생성되었습니다!")
            
            await db.commit()
            
            print(f"\n📋 계정 정보:")
            print(f"   이메일: {email}")
            print(f"   비밀번호: {password}")
            print(f"   이름: {name}")
            print(f"   역할: admin")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ 오류 발생: {str(e)}")
            raise
        finally:
            break


if __name__ == "__main__":
    # 명령줄 인자 처리
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@nearcar.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "12341234"
    name = sys.argv[3] if len(sys.argv) > 3 else "관리자"
    
    print(f"🔧 관리자 계정 생성 중...")
    print(f"   이메일: {email}")
    print(f"   비밀번호: {'*' * len(password)}")
    print(f"   이름: {name}\n")
    
    asyncio.run(create_admin(email, password, name))

