"""容器服务层 - 业务逻辑"""

from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Container, Organization
from app.schemas.schemas import ContainerCreate, ContainerUpdate

# 允许的层级关系：parent_type → [allowed child types]
HIERARCHY_RULES: dict[str | None, list[str]] = {
    None: ["campus"],              # 顶层只能是 campus
    "campus": ["building"],
    "building": ["floor"],
    "floor": ["room"],
    "room": ["resource"],
    "resource": [],                # resource 无子级
}


async def _validate_hierarchy(db: AsyncSession, parent_id: UUID | None, child_type: str) -> None:
    """校验容器层级约束"""
    if child_type not in {"campus", "building", "floor", "room", "resource"}:
        raise ValueError(f"不支持的容器类型: {child_type}")

    if parent_id is None:
        # 无父容器，只允许 campus
        if child_type not in HIERARCHY_RULES[None]:
            raise ValueError(f"顶层容器只能是 campus，不能是 {child_type}")
        return

    # 查询父容器类型
    result = await db.execute(select(Container.type).where(Container.id == parent_id))
    parent_type = result.scalar_one_or_none()
    if not parent_type:
        raise ValueError(f"父容器 {parent_id} 不存在")

    allowed = HIERARCHY_RULES.get(parent_type, [])
    if child_type not in allowed:
        raise ValueError(f"{parent_type} 下只能创建 {allowed}，不能创建 {child_type}")


async def get_containers(
    db: AsyncSession,
    org_id: UUID,
    parent_id: UUID | None = None,
    container_type: str | None = None,
) -> Sequence[Container]:
    """查询容器列表"""
    stmt = select(Container).where(Container.org_id == org_id)
    if parent_id is not None:
        stmt = stmt.where(Container.parent_id == parent_id)
    if container_type:
        stmt = stmt.where(Container.type == container_type)
    stmt = stmt.order_by(Container.sort_order, Container.name)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_container(db: AsyncSession, container_id: UUID) -> Container | None:
    """获取单个容器"""
    result = await db.execute(select(Container).where(Container.id == container_id))
    return result.scalar_one_or_none()


async def get_children(db: AsyncSession, parent_id: UUID) -> Sequence[Container]:
    """获取子容器"""
    stmt = select(Container).where(Container.parent_id == parent_id).order_by(Container.sort_order, Container.name)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_container_tree(db: AsyncSession, org_id: UUID) -> list[Container]:
    """获取某组织的完整容器树（根节点）"""
    stmt = (
        select(Container)
        .where(Container.org_id == org_id, Container.parent_id.is_(None))
        .order_by(Container.sort_order, Container.name)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_container(db: AsyncSession, data: ContainerCreate) -> Container:
    """创建容器"""
    # 验证组织存在
    org_result = await db.execute(select(Organization).where(Organization.id == data.org_id))
    if not org_result.scalar_one_or_none():
        raise ValueError(f"组织 {data.org_id} 不存在")

    # 校验层级约束
    await _validate_hierarchy(db, data.parent_id, data.type)

    # 校验parent_id与org_id一致（防止跨组织挂载）
    if data.parent_id is not None:
        parent_result = await db.execute(
            select(Container.org_id).where(Container.id == data.parent_id)
        )
        parent_org_id = parent_result.scalar_one_or_none()
        if parent_org_id and parent_org_id != data.org_id:
            raise ValueError("父容器必须属于同一组织")

    container = Container(
        org_id=data.org_id,
        type=data.type,
        name=data.name,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
        base_attrs=data.base_attrs,
        ext_attrs=data.ext_attrs,
        position=data.position,
        dimensions=data.dimensions,
    )
    db.add(container)
    await db.commit()
    await db.refresh(container)
    return container


async def update_container(db: AsyncSession, container_id: UUID, data: ContainerUpdate) -> Container | None:
    """更新容器"""
    container = await get_container(db, container_id)
    if not container:
        return None

    update_data = data.model_dump(exclude_unset=True)

    # 如果修改了 parent_id，需要校验层级约束和组织一致性
    if 'parent_id' in update_data:
        new_parent_id = update_data['parent_id']
        await _validate_hierarchy(db, new_parent_id, container.type)
        if new_parent_id is not None:
            parent_result = await db.execute(
                select(Container.org_id).where(Container.id == new_parent_id)
            )
            parent_org_id = parent_result.scalar_one_or_none()
            if parent_org_id and parent_org_id != container.org_id:
                raise ValueError("父容器必须属于同一组织")

    for key, value in update_data.items():
        setattr(container, key, value)

    await db.commit()
    await db.refresh(container)
    return container


async def delete_container(db: AsyncSession, container_id: UUID) -> bool:
    """删除容器"""
    container = await get_container(db, container_id)
    if not container:
        return False
    await db.delete(container)
    await db.commit()
    return True
