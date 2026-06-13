import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import bcrypt as _bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, update
from core.config import settings
from models.user import User

NEW_USERNAME = "admin"
NEW_PASSWORD = "admin1234"
NEW_NAME = "홍길동"


async def reset():
    engine = create_async_engine(settings.DATABASE_URL)

    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(User).where(User.deleted_at == None).limit(1)
        )
        user = result.scalar_one_or_none()

        if not user:
            print("❌ 계정이 없습니다. 앱에서 회원가입 먼저 해주세요.")
            return

        hashed = _bcrypt.hashpw(NEW_PASSWORD.encode('utf-8'), _bcrypt.gensalt(rounds=12)).decode('utf-8')
        await session.execute(
            update(User)
            .where(User.id == user.id)
            .values(username=NEW_USERNAME, password_hash=hashed, name=NEW_NAME)
        )
        await session.commit()

        print(f"✅ 완료! 이름: {NEW_NAME} / 아이디: {NEW_USERNAME} / 비번: {NEW_PASSWORD}")

    await engine.dispose()


asyncio.run(reset())
