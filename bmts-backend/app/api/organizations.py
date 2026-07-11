"""组织API"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import OrganizationCreate, OrganizationRead
from app.services.organization_service import create_org, get_org, get_org_by_slug

router = APIRouter()


@router.get("", response_model=list[OrganizationRead])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """列出所有组织（简化版，后续加权限过滤）"""
    from sqlalchemy import select
    from app.models.models import Organization
    result = await db.execute(select(Organization).order_by(Organization.name))
    return result.scalars().all()


@router.get("/{slug}", response_model=OrganizationRead)
async def get_organization(slug: str, db: AsyncSession = Depends(get_db)):
    org = await get_org_by_slug(db, slug)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")
    return org


@router.post("", response_model=OrganizationRead, status_code=201)
async def create_organization(data: OrganizationCreate, db: AsyncSession = Depends(get_db)):
    # 简化版，后续从JWT获取owner_id
    from app.services.auth_service import get_user_by_username
    user = await get_user_by_username(db, "admin")
    if not user:
        raise HTTPException(status_code=400, detail="请先注册用户")

    existing = await get_org_by_slug(db, data.slug)
    if existing:
        raise HTTPException(status_code=400, detail="组织slug已存在")

    org = await create_org(db, data, user.id)
    return org
