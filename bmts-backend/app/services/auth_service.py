"""认证服务层"""

import random
import string
from uuid import UUID

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, Organization, OrganizationMember

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, username: str, password: str, display_name: str) -> User:
    hashed = hash_password(password)
    user = User(username=username, password=hashed, display_name=display_name)
    db.add(user)
    await db.flush()

    org_name = f"{display_name}的组织"
    org_slug = f"user-{user.id.hex[:8]}"
    invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    org = Organization(
        name=org_name,
        slug=org_slug,
        org_type="campus",
        invite_code=invite_code,
        base_attrs={},
        ext_attrs={},
    )
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        org_id=org.id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    user = await get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user
