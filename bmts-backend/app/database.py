from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import ssl

from app.config import settings

connect_args = {}
if "railway.internal" not in settings.DATABASE_URL:
    ssl_context = ssl.create_default_context()
    connect_args = {"ssl": ssl_context}

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, connect_args=connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    """创建所有表（开发阶段用，生产环境用 Alembic 迁移）"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
