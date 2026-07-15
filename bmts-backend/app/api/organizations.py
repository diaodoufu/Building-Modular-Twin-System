"""组织API"""

import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.models import Organization, OrganizationJoinRequest, OrganizationMember, User
from app.schemas.schemas import (
    JoinRequestCreate,
    JoinRequestRead,
    JoinResult,
    OrganizationCreate,
    OrganizationRead,
)
from app.services.organization_service import create_org, get_org, get_org_by_slug

router = APIRouter()

# slug格式：小写字母、数字、短横线
SLUG_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')


async def _get_membership(db: AsyncSession, org_id: UUID, user_id: UUID) -> OrganizationMember | None:
    """查询用户在某组织中的成员记录"""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _require_org_admin(db: AsyncSession, org_id: UUID, user: User) -> OrganizationMember:
    """校验当前用户为该组织的 owner 或 admin；否则抛 403。

    依据项目约束：组织级管理员校验必须针对被操作的具体组织进行。
    """
    membership = await _get_membership(db, org_id, user.id)
    if not membership or membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="无该组织的管理权限")
    return membership


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


@router.get("/my-join-requests", response_model=list[JoinRequestRead])
async def list_my_join_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户提交的所有加入申请"""
    stmt = (
        select(OrganizationJoinRequest, User)
        .join(User, User.id == OrganizationJoinRequest.user_id)
        .where(OrganizationJoinRequest.user_id == current_user.id)
        .order_by(OrganizationJoinRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [_join_request_to_read(jr, user) for jr, user in rows]


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


@router.post("/{org_id}/join", response_model=JoinResult)
async def join_organization(
    org_id: UUID,
    invite_code: str | None = Query(None, description="邀请码（提供则直接加入，否则进入审核流程）"),
    payload: JoinRequestCreate | None = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """加入组织

    规则：
    - 已加入该组织 → 400
    - 已存在 pending 申请 → 400（避免重复申请）
    - 提供邀请码且与组织 invite_code 匹配 → 直接加入，member 角色
    - 未提供邀请码 → 创建 pending 申请记录，等待组织管理员审核
    """
    org = await get_org(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    # 一个用户对一个组织只能加入一次（已加入则拒绝）
    if await _get_membership(db, org_id, current_user.id):
        raise HTTPException(status_code=400, detail="已加入该组织")

    # 提供邀请码 → 走"直接加入"路径
    if invite_code:
        if not org.invite_code:
            raise HTTPException(status_code=400, detail="该组织未设置邀请码，请通过搜索加入发起申请")
        if invite_code != org.invite_code:
            raise HTTPException(status_code=400, detail="邀请码无效")
        member = OrganizationMember(
            org_id=org_id,
            user_id=current_user.id,
            role="member",
        )
        db.add(member)
        await db.commit()
        return JoinResult(
            status="joined",
            message="加入成功",
            org_id=org_id,
            role="member",
        )

    # 未提供邀请码 → 走"申请审核"路径
    existing_req = await db.execute(
        select(OrganizationJoinRequest).where(
            OrganizationJoinRequest.org_id == org_id,
            OrganizationJoinRequest.user_id == current_user.id,
            OrganizationJoinRequest.status == "pending",
        )
    )
    if existing_req.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="已申请加入该组织，等待审核")

    message = payload.message if payload else None
    join_req = OrganizationJoinRequest(
        org_id=org_id,
        user_id=current_user.id,
        status="pending",
        message=message,
    )
    db.add(join_req)
    await db.commit()
    await db.refresh(join_req)
    return JoinResult(
        status="pending",
        message="申请已发送，等待组织管理员审核",
        org_id=org_id,
        request_id=join_req.id,
    )


@router.get("/{org_id}/join-requests", response_model=list[JoinRequestRead])
async def list_join_requests(
    org_id: UUID,
    status_filter: str | None = Query(None, description="按状态过滤：pending|approved|rejected"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出某组织的加入申请（仅该组织 owner/admin 可见）"""
    await _require_org_admin(db, org_id, current_user)

    stmt = (
        select(OrganizationJoinRequest, User)
        .join(User, User.id == OrganizationJoinRequest.user_id)
        .where(OrganizationJoinRequest.org_id == org_id)
    )
    if status_filter:
        stmt = stmt.where(OrganizationJoinRequest.status == status_filter)
    stmt = stmt.order_by(OrganizationJoinRequest.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()
    return [_join_request_to_read(jr, user) for jr, user in rows]


@router.post("/{org_id}/join-requests/{request_id}/approve", response_model=JoinRequestRead)
async def approve_join_request(
    org_id: UUID,
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批准加入申请：将申请人写入组织成员表（member 角色）"""
    await _require_org_admin(db, org_id, current_user)

    result = await db.execute(
        select(OrganizationJoinRequest).where(
            OrganizationJoinRequest.id == request_id,
            OrganizationJoinRequest.org_id == org_id,
        )
    )
    join_req = result.scalar_one_or_none()
    if not join_req:
        raise HTTPException(status_code=404, detail="申请不存在")
    if join_req.status != "pending":
        raise HTTPException(status_code=400, detail=f"该申请已处理（当前状态：{join_req.status}）")

    # 防御性检查：若审核期间用户已被加入，避免重复
    if await _get_membership(db, org_id, join_req.user_id):
        join_req.status = "approved"
        join_req.reviewed_by = current_user.id
        join_req.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(join_req)
        return await _build_join_request_read(db, join_req)

    member = OrganizationMember(
        org_id=org_id,
        user_id=join_req.user_id,
        role="member",
    )
    db.add(member)
    join_req.status = "approved"
    join_req.reviewed_by = current_user.id
    join_req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(join_req)
    return await _build_join_request_read(db, join_req)


@router.post("/{org_id}/join-requests/{request_id}/reject", response_model=JoinRequestRead)
async def reject_join_request(
    org_id: UUID,
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拒绝加入申请"""
    await _require_org_admin(db, org_id, current_user)

    result = await db.execute(
        select(OrganizationJoinRequest).where(
            OrganizationJoinRequest.id == request_id,
            OrganizationJoinRequest.org_id == org_id,
        )
    )
    join_req = result.scalar_one_or_none()
    if not join_req:
        raise HTTPException(status_code=404, detail="申请不存在")
    if join_req.status != "pending":
        raise HTTPException(status_code=400, detail=f"该申请已处理（当前状态：{join_req.status}）")

    join_req.status = "rejected"
    join_req.reviewed_by = current_user.id
    join_req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(join_req)
    return await _build_join_request_read(db, join_req)


@router.put("/{org_id}/invite-code", response_model=OrganizationRead)
async def update_invite_code(
    org_id: UUID,
    invite_code: str | None = Body(None, description="新邀请码（不传则自动生成）"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新组织邀请码（仅 owner/admin 可操作）"""
    await _require_org_admin(db, org_id, current_user)

    org = await get_org(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    if invite_code:
        org.invite_code = invite_code
    else:
        import random
        import string
        org.invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    await db.commit()
    await db.refresh(org)
    return org


@router.delete("/{org_id}/invite-code", response_model=OrganizationRead)
async def clear_invite_code(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """清除组织邀请码（仅 owner/admin 可操作）"""
    await _require_org_admin(db, org_id, current_user)

    org = await get_org(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    org.invite_code = None
    await db.commit()
    await db.refresh(org)
    return org


@router.post("/{org_id}/leave", response_model=dict)
async def leave_organization(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """退出组织"""
    membership = await _get_membership(db, org_id, current_user.id)
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


# ============ 辅助函数 ============

def _join_request_to_read(jr: OrganizationJoinRequest, user: User) -> JoinRequestRead:
    """将 ORM 行转为 JoinRequestRead（已知申请人 User 实体）"""
    return JoinRequestRead(
        id=jr.id,
        org_id=jr.org_id,
        user_id=jr.user_id,
        username=user.username,
        display_name=user.display_name,
        status=jr.status,
        message=jr.message,
        reviewed_by=jr.reviewed_by,
        reviewed_at=jr.reviewed_at,
        created_at=jr.created_at,
    )


async def _build_join_request_read(db: AsyncSession, jr: OrganizationJoinRequest) -> JoinRequestRead:
    """刷新后重新拉取申请人信息构造 Read 对象"""
    user_result = await db.execute(select(User).where(User.id == jr.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        # 用户被删除则用占位字段，避免接口 500
        return JoinRequestRead(
            id=jr.id,
            org_id=jr.org_id,
            user_id=jr.user_id,
            username="",
            display_name="",
            status=jr.status,
            message=jr.message,
            reviewed_by=jr.reviewed_by,
            reviewed_at=jr.reviewed_at,
            created_at=jr.created_at,
        )
    return _join_request_to_read(jr, user)
