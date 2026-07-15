import secrets
import warnings

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""

    APP_NAME: str = "BMTS"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # 数据库（PostgreSQL）
    DATABASE_URL: str = "postgresql+asyncpg://postgres:tf6y2l27@localhost:5432/bmts"

    # JWT — 生产环境务必通过环境变量设置SECRET_KEY
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30       # access token 30分钟
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # refresh token 7天

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"


settings = Settings()

# 兼容普通postgresql协议，自动转换为asyncpg异步驱动
if settings.DATABASE_URL.startswith("postgresql://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# 未设置SECRET_KEY时自动生成（仅限开发环境）
if not settings.SECRET_KEY:
    settings.SECRET_KEY = secrets.token_urlsafe(32)
    if settings.DEBUG:
        warnings.warn(
            "SECRET_KEY 未设置，已自动生成临时密钥。生产环境请通过环境变量 SECRET_KEY 设置固定密钥！",
            stacklevel=2,
        )
