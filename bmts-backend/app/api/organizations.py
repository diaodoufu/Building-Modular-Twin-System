"""组织API"""

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.models import Organization, OrganizationMember, User
from app.schemas.schemas import OrganizationCreate, OrganizationRead
from app.services.organization_service import create_org, get_org, get_org_by_slug

router = APIRouter()

# slug格式：小写字母、数字、短横线
SLUG_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')


@router.get("", response_model=list[OrganizationRead])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """列出所有组织"""
    result = await db.execute(select(Organization).order_by(Organization.name))
    return result.scalars().all()


@router.get("/my-orgs", response_model=list[OrganizationRead])
async def list_my_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户加入的所有组织"""
    stmt = (
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == current_user.id)
        .order_by(Organization.name)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/by-id/{org_id}", response_model=OrganizationRead)
async def get_organization_by_id(org_id: UUID, db: AsyncSession = Depends(get_db)):
    """按ID获取组织"""
    org = await get_org(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")
    return org


@router.get("/search", response_model=list[OrganizationRead])
async def search_organizations(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
):
    """搜索组织（按名称或slug）"""
    stmt = select(Organization).where(
        (Organization.name.ilike(f"%{keyword}%")) |
        (Organization.slug.ilike(f"%{keyword}%"))
    ).order_by(Organization.name).limit(20)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=OrganizationRead, status_code=201)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建组织，当前用户自动成为owner"""
    # 校验slug格式
    if not SLUG_PATTERN.match(data.slug):
        raise HTTPException(status_code=400, detail="slug只能包含小写字母、数字和短横线，长度3-50，需以字母或数字开头和结尾")

    existing = await get_org_by_slug(db, data.slug)
    if existing:
        raise HTTPException(status_code=400, detail="组织slug已存在")

    org = await create_org(db, data, current_user.id)
    return org


@router.post("/{org_id}/join", response_model=dict)
async def join_organization(
    org_id: UUID,
    invite_code: str | None = Query(None, description="邀请码"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """加入组织（无邀请码可直接加入，有邀请码则需验证）"""
    org = await get_org(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    # 检查是否已加入
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="已加入该组织")

    # 如果组织设置了邀请码，则必须验证
    if org.invite_code:
        if not invite_code or invite_code != org.invite_code:
            raise HTTPException(status_code=400, detail="邀请码无效")

    member = OrganizationMember(
        org_id=org_id,
        user_id=current_user.id,
        role="member",
    )
    db.add(member)
    await db.commit()
    return {"message": "加入成功", "org_id": str(org_id), "role": "member"}


@router.post("/{org_id}/leave", response_model=dict)
async def leave_organization(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """退出组织"""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="未加入该组织")

    if membership.role == "owner":
        # 检查是否还有其他owner
        other_owners = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.role == "owner",
                OrganizationMember.user_id != current_user.id,
            )
        )
        if not other_owners.scalars().first():
            raise HTTPException(status_code=400, detail="唯一owner不能退出，请先转让组织")

    await db.delete(membership)
    await db.commit()
    return {"message": "已退出组织"}
