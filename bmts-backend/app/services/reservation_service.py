"""预约服务层 - 业务逻辑 + 冲突检测"""

from datetime import datetime
from typing import Sequence
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Reservation, Container
from app.schemas.schemas import ReservationCreate, ReservationUpdate


async def get_reservations(
    db: AsyncSession,
    room_id: UUID | None = None,
    user_id: UUID | None = None,
    status: str | None = None,
    start_after: datetime | None = None,
    end_before: datetime | None = None,
) -> Sequence[Reservation]:
    """查询预约列表"""
    stmt = select(Reservation)
    if room_id:
        stmt = stmt.where(Reservation.room_id == room_id)
    if user_id:
        stmt = stmt.where(Reservation.user_id == user_id)
    if status:
        stmt = stmt.where(Reservation.status == status)
    if start_after:
        stmt = stmt.where(Reservation.start_time >= start_after)
    if end_before:
        stmt = stmt.where(Reservation.end_time <= end_before)
    stmt = stmt.order_by(Reservation.start_time)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_reservation(db: AsyncSession, reservation_id: UUID) -> Reservation | None:
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    return result.scalar_one_or_none()


async def check_conflict(
    db: AsyncSession,
    room_id: UUID,
    start_time: datetime,
    end_time: datetime,
    exclude_id: UUID | None = None,
) -> bool:
    """检查时间段是否冲突，返回True表示有冲突"""
    stmt = select(Reservation).where(
        and_(
            Reservation.room_id == room_id,
            Reservation.status.in_(["pending", "approved"]),
            Reservation.start_time < end_time,
            Reservation.end_time > start_time,
        )
    )
    if exclude_id:
        stmt = stmt.where(Reservation.id != exclude_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def create_reservation(
    db: AsyncSession, data: ReservationCreate, user_id: UUID
) -> Reservation:
    """创建预约（含冲突检测）"""
    # 验证房间存在
    room_result = await db.execute(select(Container).where(Container.id == data.room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise ValueError("房间不存在")
    if room.type != "room":
        raise ValueError("只能预约房间类型的容器")

    # 时间校验
    if data.start_time >= data.end_time:
        raise ValueError("结束时间必须晚于开始时间")
    from datetime import timezone
    now = datetime.now(timezone.utc)
    if data.start_time < now:
        raise ValueError("不能预约过去的时间")

    # 冲突检测
    if await check_conflict(db, data.room_id, data.start_time, data.end_time):
        raise ValueError("该时间段已被预约")

    reservation = Reservation(
        room_id=data.room_id,
        user_id=user_id,
        title=data.title,
        start_time=data.start_time,
        end_time=data.end_time,
        status="pending",
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return reservation


async def update_reservation(
    db: AsyncSession, reservation_id: UUID, data: ReservationUpdate, user_id: UUID
) -> Reservation | None:
    """更新预约"""
    reservation = await get_reservation(db, reservation_id)
    if not reservation:
        return None
    if reservation.user_id != user_id:
        raise ValueError("只能修改自己的预约")

    update_data = data.model_dump(exclude_unset=True)

    # 如果修改了时间，需要重新检测冲突
    new_start = update_data.get("start_time", reservation.start_time)
    new_end = update_data.get("end_time", reservation.end_time)
    if new_start >= new_end:
        raise ValueError("结束时间必须晚于开始时间")
    if "start_time" in update_data or "end_time" in update_data:
        if await check_conflict(db, reservation.room_id, new_start, new_end, exclude_id=reservation_id):
            raise ValueError("该时间段已被预约")

    for key, value in update_data.items():
        setattr(reservation, key, value)

    await db.commit()
    await db.refresh(reservation)
    return reservation


async def cancel_reservation(db: AsyncSession, reservation_id: UUID, user_id: UUID) -> bool:
    """取消预约"""
    reservation = await get_reservation(db, reservation_id)
    if not reservation:
        return False
    if reservation.user_id != user_id:
        raise ValueError("只能取消自己的预约")
    reservation.status = "cancelled"
    await db.commit()
    return True


async def get_room_availability(
    db: AsyncSession, room_id: UUID, date: str
) -> list[dict]:
    """获取房间某日的可用时段"""
    from datetime import timedelta

    # 解析日期（中国时区 UTC+8）
    from datetime import timezone as tz
    try:
        day = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValueError("日期格式应为 YYYY-MM-DD")

    cst = tz(timedelta(hours=8))
    day_start = day.replace(hour=8, minute=0, second=0, tzinfo=cst)   # 08:00 CST
    day_end = day.replace(hour=22, minute=0, second=0, tzinfo=cst)    # 22:00 CST

    # 查询该房间当天的所有有效预约
    stmt = select(Reservation).where(
        and_(
            Reservation.room_id == room_id,
            Reservation.status.in_(["pending", "approved"]),
            Reservation.start_time < day_end,
            Reservation.end_time > day_start,
        )
    ).order_by(Reservation.start_time)
    result = await db.execute(stmt)
    reservations = result.scalars().all()

    # 生成半小时粒度时段
    slots = []
    current = day_start
    while current < day_end:
        slot_end = current + timedelta(minutes=30)
        # 检查是否被预约
        occupied = any(
            r.start_time < slot_end and r.end_time > current
            for r in reservations
        )
        slots.append({
            "start": current.strftime("%H:%M"),
            "end": slot_end.strftime("%H:%M"),
            "status": "occupied" if occupied else "available",
        })
        current = slot_end

    return slots
