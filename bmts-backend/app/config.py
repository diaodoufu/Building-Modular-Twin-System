from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""

    APP_NAME: str = "BMTS"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # 数据库（PostgreSQL）
    DATABASE_URL: str = "postgresql+asyncpg://postgres:tf6y2l27@localhost:5432/bmts"

    # JWT
    SECRET_KEY: str = "bmts-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
