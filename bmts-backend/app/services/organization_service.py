"""组织服务层"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Organization, OrganizationMember
from app.schemas.schemas import OrganizationCreate


async def get_orgs_by_user(db: AsyncSession, user_id: UUID) -> Sequence[Organization]:
    """获取用户加入的所有组织"""
    stmt = (
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == user_id)
        .order_by(Organization.name)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_org(db: AsyncSession, org_id: UUID) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    return result.scalar_one_or_none()


async def get_org_by_slug(db: AsyncSession, slug: str) -> Organization | None:
    result = await db.execute(select(Organization).where(Organization.slug == slug))
    return result.scalar_one_or_none()


async def create_org(db: AsyncSession, data: OrganizationCreate, owner_id: UUID) -> Organization:
    """创建组织，并自动将创建者设为owner"""
    org = Organization(
        name=data.name,
        slug=data.slug,
        org_type=data.org_type,
        description=data.description,
        invite_code=data.invite_code,
        base_attrs=data.base_attrs,
        ext_attrs=data.ext_attrs,
    )
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        org_id=org.id,
        user_id=owner_id,
        role="owner",
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)
    return org
