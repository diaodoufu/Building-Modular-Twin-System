"""统计API - 空间利用率 + 预约趋势"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Container, Reservation

router = APIRouter()


@router.get("/usage")
async def space_usage(
    org_id: UUID = Query(..., description="组织ID（必填）"),
    building_id: UUID | None = Query(None, description="按建筑筛选"),
    db: AsyncSession = Depends(get_db),
):
    """空间利用率统计（按组织隔离）"""
    cst = timezone(timedelta(hours=8))
    now = datetime.now(cst)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=0)

    # 获取房间列表 — 必须按org_id过滤
    room_stmt = select(Container).where(Container.type == "room", Container.org_id == org_id)
    if building_id:
        floor_stmt = select(Container.id).where(
            Container.parent_id == building_id, Container.type == "floor"
        )
        floor_result = await db.execute(floor_stmt)
        floor_ids = [r[0] for r in floor_result.fetchall()]
        if floor_ids:
            room_stmt = room_stmt.where(Container.parent_id.in_(floor_ids))
        else:
            return {"buildings": [], "room_types": [], "summary": {"total": 0, "reserved": 0, "rate": 0}}

    room_result = await db.execute(room_stmt)
    rooms = room_result.scalars().all()

    if not rooms:
        return {"buildings": [], "room_types": [], "summary": {"total": 0, "reserved": 0, "rate": 0}}

    room_ids = [r.id for r in rooms]

    # 查询今天有预约的房间
    reserved_stmt = select(Reservation.room_id).where(
        and_(
            Reservation.room_id.in_(room_ids),
            Reservation.status.in_(["pending", "approved"]),
            Reservation.start_time < today_end.astimezone(timezone.utc),
            Reservation.end_time > today_start.astimezone(timezone.utc),
        )
    ).distinct()
    reserved_result = await db.execute(reserved_stmt)
    reserved_room_ids = set(r[0] for r in reserved_result.fetchall())

    # 按建筑分组
    buildings_stats = []
    floor_ids_in_rooms = set(r.parent_id for r in rooms if r.parent_id)
    if floor_ids_in_rooms:
        floor_stmt = select(Container.id, Container.parent_id, Container.name).where(
            Container.id.in_(floor_ids_in_rooms)
        )
        floor_result = await db.execute(floor_stmt)
        floor_to_building = {}
        for f in floor_result.fetchall():
            floor_to_building[f[0]] = f[1]

        building_ids = set(floor_to_building.values())
        if building_ids:
            bld_stmt = select(Container.id, Container.name).where(Container.id.in_(building_ids))
            bld_result = await db.execute(bld_stmt)
            building_names = {b[0]: b[1] for b in bld_result.fetchall()}
        else:
            building_names = {}

        building_rooms: dict[UUID, list] = {}
        for room in rooms:
            bld_id = floor_to_building.get(room.parent_id) if room.parent_id else None
            if bld_id:
                building_rooms.setdefault(bld_id, []).append(room)

        for bld_id, bld_rooms in building_rooms.items():
            total = len(bld_rooms)
            reserved = sum(1 for r in bld_rooms if r.id in reserved_room_ids)
            buildings_stats.append({
                "building_id": str(bld_id),
                "building_name": building_names.get(bld_id, "未知建筑"),
                "total_rooms": total,
                "reserved_rooms": reserved,
                "rate": round(reserved / total * 100, 1) if total > 0 else 0,
            })

    # 按房间类型分组
    type_stats: dict[str, dict] = {}
    for room in rooms:
        room_type = room.base_attrs.get("room_type", "other") if room.base_attrs else "other"
        if room_type not in type_stats:
            type_stats[room_type] = {"total": 0, "reserved": 0}
        type_stats[room_type]["total"] += 1
        if room.id in reserved_room_ids:
            type_stats[room_type]["reserved"] += 1

    room_types_stats = [
        {
            "type": t,
            "total": v["total"],
            "reserved": v["reserved"],
            "rate": round(v["reserved"] / v["total"] * 100, 1) if v["total"] > 0 else 0,
        }
        for t, v in type_stats.items()
    ]

    total = len(rooms)
    reserved = len(reserved_room_ids)

    return {
        "buildings": buildings_stats,
        "room_types": room_types_stats,
        "summary": {
            "total": total,
            "reserved": reserved,
            "rate": round(reserved / total * 100, 1) if total > 0 else 0,
        },
    }


@router.get("/reservation-trends")
async def reservation_trends(
    org_id: UUID = Query(..., description="组织ID（必填）"),
    days: int = Query(7, description="统计最近N天", ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """预约趋势分析（按组织隔离）"""
    cst = timezone(timedelta(hours=8))
    now = datetime.now(cst)

    trends = []
    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=cst)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=0, tzinfo=cst)

        # 查询当天创建的预约，按组织过滤
        stmt = (
            select(Reservation)
            .join(Container, Reservation.room_id == Container.id)
            .where(
                and_(
                    Container.org_id == org_id,
                    Reservation.created_at >= day_start.astimezone(timezone.utc),
                    Reservation.created_at <= day_end.astimezone(timezone.utc),
                )
            )
        )
        result = await db.execute(stmt)
        reservations = result.scalars().all()

        status_count = {"pending": 0, "approved": 0, "rejected": 0, "cancelled": 0}
        for r in reservations:
            if r.status in status_count:
                status_count[r.status] += 1

        trends.append({
            "date": day.strftime("%Y-%m-%d"),
            "total": len(reservations),
            **status_count,
        })

    return {"trends": trends, "days": days}


@router.get("/recommend")
async def recommend_rooms(
    org_id: UUID = Query(..., description="组织ID（必填）"),
    date: str = Query(..., description="日期 YYYY-MM-DD"),
    duration: int = Query(60, description="需要时长（分钟）", ge=30, le=480),
    room_type: str | None = Query(None, description="房间类型"),
    capacity: int | None = Query(None, description="最小容量"),
    db: AsyncSession = Depends(get_db),
):
    """智能推荐房间和时间段（按组织隔离）"""
    cst = timezone(timedelta(hours=8))

    try:
        from datetime import datetime as dt
        day = dt.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")

    day_start = day.replace(hour=8, minute=0, second=0, tzinfo=cst)
    day_end = day.replace(hour=22, minute=0, second=0, tzinfo=cst)

    # 获取可用房间 — 必须按org_id过滤
    room_stmt = select(Container).where(Container.type == "room", Container.org_id == org_id)
    if room_type:
        room_stmt = room_stmt.where(Container.base_attrs["room_type"].as_string() == room_type)
    if capacity:
        room_stmt = room_stmt.where(Container.base_attrs["capacity"].as_integer() >= capacity)

    room_result = await db.execute(room_stmt)
    rooms = room_result.scalars().all()

    recommendations = []

    for room in rooms:
        res_stmt = select(Reservation).where(
            and_(
                Reservation.room_id == room.id,
                Reservation.status.in_(["pending", "approved"]),
                Reservation.start_time < day_end.astimezone(timezone.utc),
                Reservation.end_time > day_start.astimezone(timezone.utc),
            )
        ).order_by(Reservation.start_time)
        res_result = await db.execute(res_stmt)
        reservations = res_result.scalars().all()

        occupied_slots = [(r.start_time, r.end_time) for r in reservations]
        free_slots = []
        slot_start = day_start
        slot_duration = timedelta(minutes=duration)

        for occ_start, occ_end in occupied_slots:
            occ_start_cst = occ_start.astimezone(cst) if occ_start.tzinfo else occ_start.replace(tzinfo=cst)
            occ_end_cst = occ_end.astimezone(cst) if occ_end.tzinfo else occ_end.replace(tzinfo=cst)
            if slot_start + slot_duration <= occ_start_cst:
                free_slots.append({
                    "start": slot_start.strftime("%H:%M"),
                    "end": occ_start_cst.strftime("%H:%M"),
                })
            slot_start = max(slot_start, occ_end_cst)

        if slot_start + slot_duration <= day_end:
            free_slots.append({
                "start": slot_start.strftime("%H:%M"),
                "end": day_end.strftime("%H:%M"),
            })

        if free_slots:
            room_capacity = room.base_attrs.get("capacity", 0) if room.base_attrs else 0
            room_type_name = room.base_attrs.get("room_type", "other") if room.base_attrs else "other"

            best_slot = free_slots[0]
            for slot in free_slots:
                hour = int(slot["start"].split(":")[0])
                if 10 <= hour <= 11 or 14 <= hour <= 15:
                    best_slot = slot
                    break

            score = len(free_slots) * 10 + (5 if 10 <= int(best_slot["start"].split(":")[0]) <= 15 else 0)

            recommendations.append({
                "room_id": str(room.id),
                "room_name": room.name,
                "room_type": room_type_name,
                "capacity": room_capacity,
                "best_time": best_slot,
                "free_slots_count": len(free_slots),
                "score": score,
            })

    recommendations.sort(key=lambda x: x["score"], reverse=True)

    return {
        "date": date,
        "duration": duration,
        "recommendations": recommendations[:10],
    }


@router.get("/anomalies")
async def detect_anomalies(
    org_id: UUID = Query(..., description="组织ID（必填）"),
    db: AsyncSession = Depends(get_db),
):
    """异常占用检测（按组织隔离）"""
    anomalies = []

    # 1. 过期未审核的预约（pending超过3天） — 按组织过滤
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    stale_stmt = (
        select(Reservation)
        .join(Container, Reservation.room_id == Container.id)
        .where(
            and_(
                Container.org_id == org_id,
                Reservation.status == "pending",
                Reservation.created_at < three_days_ago,
            )
        )
    )
    stale_result = await db.execute(stale_stmt)
    stale_reservations = stale_result.scalars().all()

    for r in stale_reservations:
        anomalies.append({
            "type": "stale_pending",
            "description": "预约超过3天未审核",
            "reservation_id": str(r.id),
            "room_id": str(r.room_id),
            "user_id": str(r.user_id),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 2. 同一用户高频预约 — 按组织过滤
    freq_stmt = (
        select(
            Reservation.user_id,
            Reservation.room_id,
            func.count(Reservation.id).label("count"),
        )
        .join(Container, Reservation.room_id == Container.id)
        .where(
            and_(
                Container.org_id == org_id,
                Reservation.status.in_(["pending", "approved"]),
            )
        )
        .group_by(
            Reservation.user_id, Reservation.room_id,
        )
        .having(
            func.count(Reservation.id) >= 5
        )
    )
    freq_result = await db.execute(freq_stmt)
    for row in freq_result.fetchall():
        anomalies.append({
            "type": "high_frequency",
            "description": f"同一用户对同一房间预约{row[2]}次",
            "user_id": str(row[0]),
            "room_id": str(row[1]),
            "count": row[2],
        })

    # 3. 预约时间已过但仍为approved — 按组织过滤
    now = datetime.now(timezone.utc)
    missed_stmt = (
        select(Reservation)
        .join(Container, Reservation.room_id == Container.id)
        .where(
            and_(
                Container.org_id == org_id,
                Reservation.status == "approved",
                Reservation.end_time < now - timedelta(hours=2),
            )
        )
        .limit(20)
    )
    missed_result = await db.execute(missed_stmt)
    for r in missed_result.scalars().all():
        anomalies.append({
            "type": "potential_no_show",
            "description": "预约时间已过，可能未到场",
            "reservation_id": str(r.id),
            "room_id": str(r.room_id),
            "end_time": r.end_time.isoformat() if r.end_time else None,
        })

    return {"anomalies": anomalies, "total": len(anomalies)}
