"""容器CRUD API"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.schemas import (
    ContainerCreate, ContainerRead, ContainerTreeNode, ContainerUpdate,
)
from app.services.container_service import (
    create_container, delete_container, get_children, get_container,
    get_container_tree, get_containers, update_container,
)

router = APIRouter()


@router.get("", response_model=list[ContainerRead])
async def list_containers(
    org_id: UUID = Query(..., description="组织ID"),
    parent_id: UUID | None = Query(None, description="父容器ID"),
    type: str | None = Query(None, description="容器类型"),
    db: AsyncSession = Depends(get_db),
):
    """查询容器列表"""
    return await get_containers(db, org_id, parent_id, type)


@router.get("/tree", response_model=list[ContainerTreeNode])
async def get_tree(
    org_id: UUID = Query(..., description="组织ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取容器树 - 返回扁平列表，前端自行构建树"""
    from sqlalchemy import select
    from app.models.models import Container

    stmt = select(Container).where(Container.org_id == org_id).order_by(Container.sort_order, Container.name)
    result = await db.execute(stmt)
    all_containers = result.scalars().all()

    # 将扁平列表转为树
    nodes_map = {}
    for c in all_containers:
        nodes_map[str(c.id)] = ContainerTreeNode(
            id=c.id, org_id=c.org_id, type=c.type, name=c.name,
            parent_id=c.parent_id, sort_order=c.sort_order,
            base_attrs=c.base_attrs, ext_attrs=c.ext_attrs,
            position=c.position, dimensions=c.dimensions,
            created_at=c.created_at, updated_at=c.updated_at,
            children=[],
        )

    roots = []
    for node in nodes_map.values():
        pid = str(node.parent_id) if node.parent_id else None
        if pid and pid in nodes_map:
            nodes_map[pid].children.append(node)
        else:
            roots.append(node)
    return roots


@router.get("/{container_id}", response_model=ContainerRead)
async def get_one(container_id: UUID, db: AsyncSession = Depends(get_db)):
    container = await get_container(db, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="容器不存在")
    return container


@router.get("/{container_id}/children", response_model=list[ContainerRead])
async def list_children(container_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_children(db, container_id)


@router.post("", response_model=ContainerRead, status_code=201)
async def create_one(data: ContainerCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await create_container(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{container_id}", response_model=ContainerRead)
async def update_one(container_id: UUID, data: ContainerUpdate, db: AsyncSession = Depends(get_db)):
    container = await update_container(db, container_id, data)
    if not container:
        raise HTTPException(status_code=404, detail="容器不存在")
    return container


@router.delete("/{container_id}", status_code=204)
async def delete_one(container_id: UUID, db: AsyncSession = Depends(get_db)):
    if not await delete_container(db, container_id):
        raise HTTPException(status_code=404, detail="容器不存在")
