"""种子数据 - 创建示例校园数据"""

import asyncio
import json
import uuid

import asyncpg
import bcrypt

PG_DSN = "postgresql://postgres:tf6y2l27@localhost:5432/bmts"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def seed():
    conn = await asyncpg.connect(PG_DSN)

    # 注册JSON编解码器
    await conn.set_type_codec(
        'jsonb',
        encoder=lambda d: json.dumps(d, ensure_ascii=False),
        decoder=json.loads,
        schema='pg_catalog'
    )

    # 清理旧数据
    await conn.execute("DELETE FROM containers")
    await conn.execute("DELETE FROM organization_members")
    await conn.execute("DELETE FROM organizations")
    await conn.execute("DELETE FROM users")
    print("旧数据已清理")

    # 1. 创建用户
    admin_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO users (id, username, password, display_name, created_at) VALUES ($1, $2, $3, $4, now())",
        admin_id, "admin", hash_password("123456"), "管理员"
    )
    viewer_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO users (id, username, password, display_name, created_at) VALUES ($1, $2, $3, $4, now())",
        viewer_id, "viewer", hash_password("123456"), "查看者"
    )
    print("用户创建完成")

    # 2. 创建组织
    org_id = uuid.uuid4()
    await conn.execute(
        """INSERT INTO organizations (id, name, slug, org_type, invite_code, base_attrs, ext_attrs, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())""",
        org_id, "北京信息科技大学", "bistu", "campus", "BISTU2026",
        {"address": "北京市昌平区", "area_sqm": 500000, "description": "北京信息科技大学"},
        {}
    )
    print(f"组织创建完成: {org_id}")

    # 3. 加入组织
    await conn.execute(
        "INSERT INTO organization_members (id, org_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4, now())",
        uuid.uuid4(), org_id, admin_id, "owner"
    )
    await conn.execute(
        "INSERT INTO organization_members (id, org_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4, now())",
        uuid.uuid4(), org_id, viewer_id, "member"
    )
    print("成员关系创建完成")

    # 4. 创建容器树
    # 校区
    campus_id = uuid.uuid4()
    await conn.execute(
        """INSERT INTO containers (id, org_id, type, name, parent_id, sort_order, base_attrs, ext_attrs, position, dimensions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())""",
        campus_id, org_id, "campus", "昌平校区", None, 0,
        {"address": "北京市昌平区太行路55号", "area_sqm": 500000}, {},
        {"x": 0, "y": 0, "z": 0}, {"width": 500, "height": 10, "depth": 400}
    )

    # 3栋建筑
    building_id = uuid.uuid4()
    await conn.execute(
        """INSERT INTO containers (id, org_id, type, name, parent_id, sort_order, base_attrs, ext_attrs, position, dimensions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())""",
        building_id, org_id, "building", "教学楼A", campus_id, 1,
        {"built_year": 2015, "total_floors": 5, "area_sqm": 8000}, {},
        {"x": 50, "y": 0, "z": 30}, {"width": 60, "height": 20, "depth": 25}
    )

    office_id = uuid.uuid4()
    await conn.execute(
        """INSERT INTO containers (id, org_id, type, name, parent_id, sort_order, base_attrs, ext_attrs, position, dimensions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())""",
        office_id, org_id, "building", "行政办公楼", campus_id, 2,
        {"built_year": 2012, "total_floors": 4, "area_sqm": 4000}, {},
        {"x": -40, "y": 0, "z": 50}, {"width": 40, "height": 16, "depth": 20}
    )

    lib_id = uuid.uuid4()
    await conn.execute(
        """INSERT INTO containers (id, org_id, type, name, parent_id, sort_order, base_attrs, ext_attrs, position, dimensions, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())""",
        lib_id, org_id, "building", "图书馆", campus_id, 3,
        {"built_year": 2018, "total_floors": 3, "area_sqm": 6000}, {},
        {"x": 0, "y": 0, "z": -20}, {"width": 50, "height": 12, "depth": 35}
    )

    # 教学楼楼层和房间
    for floor_num in range(1, 6):
        floor_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO containers (id, org_id, type, name, parent_id, sort_order, base_attrs, ext_attrs, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())""",
            floor_id, org_id, "floor", f"{floor_num}F", building_id, floor_num,
            {"level": floor_num, "height_m": 4.0, "area_sqm": 1600}, {}
        )

        room_types = ["classroom", "classroom", "lab", "classroom", "office", "meeting"]
        for i, rtype in enumerate(room_types, 1):
            capacity = 50 if rtype == "classroom" else 20 if rtype == "lab" else 10
            await conn.execute(
                """INSERT INTO containers (id, org_id, type, name, parent_id, sort_order, base_attrs, ext_attrs, position, dimensions, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())""",
                uuid.uuid4(), org_id, "room", f"{floor_num}{i:02d}", floor_id, i,
                {"room_number": f"{floor_num}{i:02d}", "area_sqm": 60 if rtype == "classroom" else 80 if rtype == "lab" else 30, "capacity": capacity, "room_type": rtype},
                {"has_projector": rtype in ("classroom", "meeting"), "has_whiteboard": True},
                {"x": (i - 1) * 10 - 25, "y": (floor_num - 1) * 4, "z": 0},
                {"width": 8, "height": 3.5, "depth": 7}
            )

    print(f"容器树创建完成: 1校区 + 3建筑 + 5楼层 + 30房间")
    await conn.close()

    print(f"\n种子数据插入完成！")
    print(f"org_id = {org_id}")
    print(f"campus_id = {campus_id}")
    print(f"building_id = {building_id}")


if __name__ == "__main__":
    asyncio.run(seed())
