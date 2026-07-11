"""预约API"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.models import Container, OrganizationMember, User
from app.schemas.schemas import ReservationCreate, ReservationRead, ReservationUpdate, RoomAvailability
from app.services.reservation_service import (
    cancel_reservation, create_reservation, get_reservation,
    get_reservations, get_room_availability, update_reservation,
)

router = APIRouter()


async def _check_org_admin(org_id: UUID, user: User, db: AsyncSession) -> None:
    """校验用户是否为指定组织的管理员"""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.role.in_(["owner", "admin"]),
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="需要管理员权限")


async def _check_org_member(org_id: UUID, user: User, db: AsyncSession) -> None:
    """校验用户是否为指定组织的成员"""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="需要加入组织后才能操作")


async def _get_room_org_id(room_id: UUID, db: AsyncSession) -> UUID:
    """通过房间ID查找所属组织ID"""
    result = await db.execute(select(Container.org_id).where(Container.id == room_id))
    org_id = result.scalar_one_or_none()
    if not org_id:
        raise HTTPException(status_code=404, detail="房间不存在")
    return org_id


@router.get("", response_model=list[ReservationRead])
async def list_reservations(
    org_id: UUID | None = Query(None, description="组织ID（按组织过滤）"),
    room_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    status: str | None = Query(None),
    start_after: datetime | None = Query(None),
    end_before: datetime | None = Query(None),
    offset: int = Query(0, ge=0, description="分页偏移"),
    limit: int = Query(100, ge=1, le=500, description="每页数量"),
    db: AsyncSession = Depends(get_db),
):
    """查询预约列表（可按组织过滤，支持分页）"""
    return await get_reservations(db, room_id, user_id, status, start_after, end_before, org_id=org_id, offset=offset, limit=limit)


@router.get("/pending", response_model=list[ReservationRead])
async def pending_reservations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """查询待审核预约（管理员，返回所有管理员所属组织的待审核预约）"""
    result = await db.execute(
        select(OrganizationMember.org_id).where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["owner", "admin"]),
        )
    )
    admin_org_ids = [row[0] for row in result.fetchall()]
    if not admin_org_ids:
        raise HTTPException(status_code=403, detail="需要管理员权限")

    # 查询所有管理员所属组织的待审核预约
    all_pending: list = []
    for org_id in admin_org_ids:
        reservations = await get_reservations(db, status="pending", org_id=org_id)
        all_pending.extend(reservations)
    return all_pending


@router.get("/my", response_model=list[ReservationRead])
async def my_reservations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """我的预约"""
    return await get_reservations(db, user_id=current_user.id)


@router.get("/availability/{room_id}", response_model=RoomAvailability)
async def room_availability(
    room_id: UUID,
    date: str = Query(..., description="日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """获取房间某日可用时段"""
    try:
        slots = await get_room_availability(db, room_id, date)
        return RoomAvailability(room_id=room_id, date=date, slots=slots)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{reservation_id}", response_model=ReservationRead)
async def get_one(reservation_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await get_reservation(db, reservation_id)
    if not r:
        raise HTTPException(status_code=404, detail="预约不存在")
    return r


@router.post("", response_model=ReservationRead, status_code=201)
async def create_one(
    data: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 校验用户是否为房间所属组织的成员
    org_id = await _get_room_org_id(data.room_id, db)
    await _check_org_member(org_id, current_user, db)
    try:
        return await create_reservation(db, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{reservation_id}", response_model=ReservationRead)
async def update_one(
    reservation_id: UUID,
    data: ReservationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 校验用户是否为预约所属组织的成员
    reservation = await get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    org_id = await _get_room_org_id(reservation.room_id, db)
    await _check_org_member(org_id, current_user, db)
    try:
        r = await update_reservation(db, reservation_id, data, current_user.id)
        if not r:
            raise HTTPException(status_code=404, detail="预约不存在")
        return r
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{reservation_id}/cancel", response_model=ReservationRead)
async def cancel_one(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reservation = await get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    if reservation.status not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="当前状态不可取消")

    org_id = await _get_room_org_id(reservation.room_id, db)

    if reservation.user_id != current_user.id:
        # 非预约所有者，需要该组织管理员权限
        await _check_org_admin(org_id, current_user, db)
    else:
        # 所有者取消，只需是组织成员
        await _check_org_member(org_id, current_user, db)

    reservation.status = "cancelled"
    await db.commit()
    await db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/approve", response_model=ReservationRead)
async def approve_one(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审核通过预约"""
    reservation = await get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    if reservation.status != "pending":
        raise HTTPException(status_code=400, detail="只能审核待审核的预约")
    # 校验管理员是否属于该预约的组织
    org_id = await _get_room_org_id(reservation.room_id, db)
    await _check_org_admin(org_id, current_user, db)
    reservation.status = "approved"
    reservation.reviewed_by = current_user.id
    await db.commit()
    await db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/reject", response_model=ReservationRead)
async def reject_one(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审核拒绝预约"""
    reservation = await get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    if reservation.status != "pending":
        raise HTTPException(status_code=400, detail="只能审核待审核的预约")
    # 校验管理员是否属于该预约的组织
    org_id = await _get_room_org_id(reservation.room_id, db)
    await _check_org_admin(org_id, current_user, db)
    reservation.status = "rejected"
    reservation.reviewed_by = current_user.id
    await db.commit()
    await db.refresh(reservation)
    return reservation
