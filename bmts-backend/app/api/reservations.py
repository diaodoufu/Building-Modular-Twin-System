"""预约API"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import ReservationCreate, ReservationRead, ReservationUpdate, RoomAvailability
from app.services.reservation_service import (
    cancel_reservation, create_reservation, get_reservation,
    get_reservations, get_room_availability, update_reservation,
)

router = APIRouter()

# 临时硬编码用户ID，后续从JWT获取
TEMP_USER_ID = None


async def _get_user_id(db: AsyncSession = Depends(get_db)) -> UUID:
    """获取当前用户ID（简化版）"""
    global TEMP_USER_ID
    if TEMP_USER_ID:
        return TEMP_USER_ID
    from sqlalchemy import select
    from app.models.models import User
    result = await db.execute(select(User).where(User.username == "admin"))
    user = result.scalar_one_or_none()
    if user:
        TEMP_USER_ID = user.id
        return user.id
    raise HTTPException(status_code=401, detail="未登录")


@router.get("", response_model=list[ReservationRead])
async def list_reservations(
    room_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    status: str | None = Query(None),
    start_after: datetime | None = Query(None),
    end_before: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """查询预约列表"""
    return await get_reservations(db, room_id, user_id, status, start_after, end_before)


@router.get("/my", response_model=list[ReservationRead])
async def my_reservations(
    db: AsyncSession = Depends(get_db),
    uid: UUID = Depends(_get_user_id),
):
    """我的预约"""
    return await get_reservations(db, user_id=uid)


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
    uid: UUID = Depends(_get_user_id),
):
    try:
        return await create_reservation(db, data, uid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{reservation_id}", response_model=ReservationRead)
async def update_one(
    reservation_id: UUID,
    data: ReservationUpdate,
    db: AsyncSession = Depends(get_db),
    uid: UUID = Depends(_get_user_id),
):
    try:
        r = await update_reservation(db, reservation_id, data, uid)
        if not r:
            raise HTTPException(status_code=404, detail="预约不存在")
        return r
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{reservation_id}/cancel", response_model=ReservationRead)
async def cancel_one(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    uid: UUID = Depends(_get_user_id),
):
    try:
        if not await cancel_reservation(db, reservation_id, uid):
            raise HTTPException(status_code=404, detail="预约不存在")
        return await get_reservation(db, reservation_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
