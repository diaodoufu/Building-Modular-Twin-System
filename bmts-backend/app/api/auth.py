"""认证API"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

import re

from app.config import settings
from app.database import get_db
from app.models.models import OrganizationMember, User
from app.schemas.schemas import LoginRequest, Token, TokenData, UserCreate, UserRead
from app.services.auth_service import authenticate_user, create_user, get_user_by_id, get_user_by_username

router = APIRouter()

security = HTTPBearer(auto_error=False)

# 速率限制存储
# 注意：当前基于进程内存，多进程/多实例部署时各进程不共享，速率限制会被绕过。
# 生产环境应替换为 Redis 实现（见 _RateLimiter 抽象类），确保跨进程/跨实例共享计数。
RATE_LIMIT_MAX = 5       # 登录最大尝试次数
RATE_LIMIT_WINDOW = 300  # 登录时间窗口（秒）
REGISTER_LIMIT_MAX = 3   # 注册最大尝试次数
REGISTER_LIMIT_WINDOW = 3600  # 注册时间窗口（秒）


class _RateLimiter:
    """速率限制器抽象 — 当前为内存实现，生产环境可替换为Redis"""

    def __init__(self) -> None:
        self._store: dict[str, list[datetime]] = {}

    def check(self, key: str, max_attempts: int, window: int, error_msg: str) -> None:
        now = datetime.now(timezone.utc)
        attempts = self._store.get(key, [])
        attempts = [t for t in attempts if (now - t).total_seconds() < window]
        if not attempts:
            self._store.pop(key, None)
        else:
            self._store[key] = attempts
        if len(attempts) >= max_attempts:
            raise HTTPException(status_code=429, detail=error_msg)

    def record(self, key: str) -> None:
        now = datetime.now(timezone.utc)
        self._store.setdefault(key, []).append(now)


login_limiter = _RateLimiter()
register_limiter = _RateLimiter()


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """从Authorization Bearer token获取当前用户"""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供认证信息")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的认证信息")
    user = await get_user_by_id(db, UUID(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user


def _validate_password(password: str) -> None:
    """密码强度校验：至少8位，包含字母和数字"""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="密码长度至少8位")
    if not re.search(r'[a-zA-Z]', password):
        raise HTTPException(status_code=400, detail="密码需包含至少一个字母")
    if not re.search(r'[0-9]', password):
        raise HTTPException(status_code=400, detail="密码需包含至少一个数字")


@router.post("/register", response_model=UserRead)
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    # 注册速率限制
    client_ip = request.client.host if request.client else "unknown"
    register_limiter.check(client_ip, REGISTER_LIMIT_MAX, REGISTER_LIMIT_WINDOW,
                       f"注册尝试过于频繁，请{REGISTER_LIMIT_WINDOW // 60}分钟后再试")
    register_limiter.record(client_ip)

    # 密码强度校验
    _validate_password(data.password)

    existing = await get_user_by_username(db, data.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = await create_user(db, data.username, data.password, data.display_name)
    return user


@router.post("/login", response_model=Token)
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    # 速率限制
    client_ip = request.client.host if request.client else "unknown"
    login_limiter.check(client_ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW,
                       f"登录尝试过于频繁，请{RATE_LIMIT_WINDOW // 60}分钟后再试")
    login_limiter.record(client_ip)

    user = await authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
async def refresh_token_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """使用refresh token换取新的access token"""
    body = await request.json()
    refresh_token_str = body.get("refresh_token")
    if not refresh_token_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少refresh_token")

    try:
        payload = jwt.decode(refresh_token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的refresh token")
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="refresh token已过期")

    user = await get_user_by_id(db, UUID(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))
    return Token(access_token=new_access, refresh_token=new_refresh)


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/my-role")
async def get_my_role(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户在所有组织中的角色（支持多组织）"""
    result = await db.execute(
        select(OrganizationMember).where(OrganizationMember.user_id == current_user.id)
    )
    memberships = result.scalars().all()
    if not memberships:
        return {"organizations": [], "current_org_id": None, "current_role": None}

    organizations = [
        {"org_id": str(m.org_id), "role": m.role}
        for m in memberships
    ]
    # 默认返回第一个组织（后续前端可切换）
    first = memberships[0]
    return {
        "organizations": organizations,
        "current_org_id": str(first.org_id),
        "current_role": first.role,
    }


@router.delete("/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除当前用户账户及相关数据"""
    from app.models.models import Organization, OrganizationMember, Reservation
    
    await db.execute(
        delete(Reservation).where(Reservation.user_id == current_user.id)
    )
    
    await db.execute(
        update(Reservation).where(Reservation.reviewed_by == current_user.id).values(reviewed_by=None)
    )
    
    org_result = await db.execute(
        select(Organization).join(OrganizationMember).where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role == 'owner'
        )
    )
    orgs = org_result.scalars().all()
    for org in orgs:
        await db.delete(org)
    
    await db.delete(current_user)
    await db.commit()
    return {"message": "账户已删除"}
