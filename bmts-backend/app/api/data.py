"""BMTS Schema 数据导入导出API"""

import json
import logging
from uuid import UUID

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.models import OrganizationMember, User
from app.services.data_service import export_data, import_data

router = APIRouter()

logger = logging.getLogger(__name__)


async def _require_org_admin(org_id: UUID, user: User, db: AsyncSession) -> None:
    """校验用户是指定组织的管理员"""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.org_id == org_id,
            OrganizationMember.role.in_(["owner", "admin"]),
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=403, detail="需要该组织管理员权限才能导入导出数据")


@router.post("/import")
async def import_data_api(
    org_id: UUID = Query(..., description="目标组织ID"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导入BMTS Schema数据（JSON或YAML文件），需组织管理员权限"""
    await _require_org_admin(org_id, current_user, db)

    content = await file.read()
    try:
        raw_data = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="文件编码错误，请使用UTF-8编码")

    filename = file.filename or "data.json"
    format_type = "yaml" if filename.endswith((".yaml", ".yml")) else "json"

    try:
        stats = await import_data(db, org_id, raw_data, format_type)
        return {"message": "导入成功", "stats": stats}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON格式错误，请检查文件内容")
    except yaml.YAMLError:
        raise HTTPException(status_code=400, detail="YAML格式错误，请检查文件内容")
    except Exception as e:
        logger.exception("数据导入失败")
        raise HTTPException(status_code=500, detail="导入失败，请检查数据格式是否符合BMTS Schema规范")


@router.get("/export")
async def export_data_api(
    org_id: UUID = Query(..., description="导出组织ID"),
    format: str = Query("json", description="导出格式: json/yaml"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出BMTS Schema格式数据，需组织管理员权限"""
    await _require_org_admin(org_id, current_user, db)

    try:
        data = await export_data(db, org_id)
    except Exception as e:
        logger.exception("数据导出失败")
        raise HTTPException(status_code=500, detail="导出失败，请稍后重试")

    if format == "yaml":
        yaml_str = yaml.dump(data, allow_unicode=True, default_flow_style=False)
        return JSONResponse(
            content={"data": yaml_str, "format": "yaml"},
        )
    return data
