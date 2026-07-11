"""BMTS Schema 数据导入导出服务"""

import json
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import yaml
from jsonschema import validate, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Container


SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "bmts_schema_v0.1.json"


def _load_schema() -> dict:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


async def import_data(db: AsyncSession, org_id: UUID, raw_data: str, format: str = "json") -> dict:
    """导入BMTS Schema数据，返回导入统计"""
    # 解析数据
    if format == "yaml":
        data = yaml.safe_load(raw_data)
    else:
        data = json.loads(raw_data)

    # 校验Schema
    schema = _load_schema()
    try:
        validate(instance=data, schema=schema)
    except ValidationError as e:
        raise ValueError(f"数据不符合BMTS Schema规范: {e.message}")

    # 导入campus
    campus_data = data["campus"]
    stats = {"created": 0, "skipped": 0}

    campus = Container(
        id=UUID(campus_data["id"]) if "id" in campus_data else uuid4(),
        org_id=org_id,
        name=campus_data["name"],
        type="campus",
        parent_id=None,
        base_attrs=campus_data.get("baseAttrs", {}),
        ext_attrs=campus_data.get("extAttrs", {}),
    )
    db.add(campus)
    stats["created"] += 1

    # 递归导入children
    for building_data in campus_data.get("children", []):
        building = Container(
            id=UUID(building_data["id"]) if "id" in building_data else uuid4(),
            org_id=org_id,
            name=building_data["name"],
            type="building",
            parent_id=campus.id,
            base_attrs=building_data.get("baseAttrs", {}),
            ext_attrs=building_data.get("extAttrs", {}),
            position=building_data.get("position"),
            dimensions=building_data.get("dimensions"),
            sort_order=building_data.get("sortOrder", 0),
        )
        db.add(building)
        stats["created"] += 1

        for floor_data in building_data.get("children", []):
            floor = Container(
                id=UUID(floor_data["id"]) if "id" in floor_data else uuid4(),
                org_id=org_id,
                name=floor_data["name"],
                type="floor",
                parent_id=building.id,
                base_attrs=floor_data.get("baseAttrs", {}),
                ext_attrs=floor_data.get("extAttrs", {}),
                sort_order=floor_data.get("sortOrder", 0),
            )
            db.add(floor)
            stats["created"] += 1

            for room_data in floor_data.get("children", []):
                room = Container(
                    id=UUID(room_data["id"]) if "id" in room_data else uuid4(),
                    org_id=org_id,
                    name=room_data["name"],
                    type="room",
                    parent_id=floor.id,
                    base_attrs=room_data.get("baseAttrs", {}),
                    ext_attrs=room_data.get("extAttrs", {}),
                    position=room_data.get("position"),
                    dimensions=room_data.get("dimensions"),
                    sort_order=room_data.get("sortOrder", 0),
                )
                db.add(room)
                stats["created"] += 1

                for resource_data in room_data.get("children", []):
                    resource = Container(
                        id=UUID(resource_data["id"]) if "id" in resource_data else uuid4(),
                        org_id=org_id,
                        name=resource_data["name"],
                        type="resource",
                        parent_id=room.id,
                        base_attrs=resource_data.get("baseAttrs", {}),
                        ext_attrs=resource_data.get("extAttrs", {}),
                        position=resource_data.get("position"),
                        dimensions=resource_data.get("dimensions"),
                        sort_order=resource_data.get("sortOrder", 0),
                    )
                    db.add(resource)
                    stats["created"] += 1

    await db.commit()
    return stats


async def export_data(db: AsyncSession, org_id: UUID) -> dict:
    """导出BMTS Schema格式数据"""
    # 查询该组织所有容器
    result = await db.execute(
        select(Container).where(Container.org_id == org_id).order_by(Container.sort_order)
    )
    all_containers = result.scalars().all()

    if not all_containers:
        return {"version": "0.1.0", "campus": None}

    # 找到campus
    campus_list = [c for c in all_containers if c.type == "campus"]
    if not campus_list:
        return {"version": "0.1.0", "campus": None}

    campus = campus_list[0]

    def build_tree(container: Container) -> dict[str, Any]:
        children = [c for c in all_containers if c.parent_id == container.id]
        node: dict[str, Any] = {
            "id": str(container.id),
            "name": container.name,
            "baseAttrs": container.base_attrs or {},
            "extAttrs": container.ext_attrs or {},
        }
        if container.position:
            node["position"] = container.position
        if container.dimensions:
            node["dimensions"] = container.dimensions
        if container.sort_order:
            node["sortOrder"] = container.sort_order
        if children:
            node["children"] = [build_tree(c) for c in children]
        return node

    return {
        "version": "0.1.0",
        "campus": build_tree(campus),
    }
