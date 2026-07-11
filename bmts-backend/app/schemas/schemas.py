from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ============ 容器 Schemas ============

class ContainerBase(BaseModel):
    name: str
    type: str  # campus|building|floor|room|resource
    sort_order: int = 0
    base_attrs: dict[str, Any] = Field(default_factory=dict)
    ext_attrs: dict[str, Any] = Field(default_factory=dict)
    position: dict[str, float] | None = None
    dimensions: dict[str, float] | None = None


class ContainerCreate(ContainerBase):
    org_id: uuid.UUID
    parent_id: uuid.UUID | None = None


class ContainerUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None
    base_attrs: dict[str, Any] | None = None
    ext_attrs: dict[str, Any] | None = None
    position: dict[str, float] | None = None
    dimensions: dict[str, float] | None = None


class ContainerRead(ContainerBase):
    id: uuid.UUID
    org_id: uuid.UUID
    parent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContainerTreeNode(ContainerRead):
    """带子节点的树形结构"""
    children: list["ContainerTreeNode"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ============ 组织 Schemas ============

class OrganizationCreate(BaseModel):
    name: str
    slug: str
    org_type: str  # campus|hospital|government|enterprise
    description: str | None = None
    invite_code: str | None = None
    base_attrs: dict[str, Any] = Field(default_factory=dict)
    ext_attrs: dict[str, Any] = Field(default_factory=dict)


class OrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    org_type: str
    description: str | None
    invite_code: str | None
    logo_url: str | None
    base_attrs: dict[str, Any]
    ext_attrs: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============ 用户 Schemas ============

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str


class UserRead(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: str


# ============ 预约 Schemas ============

class ReservationCreate(BaseModel):
    room_id: uuid.UUID
    title: str | None = None
    start_time: datetime
    end_time: datetime


class ReservationUpdate(BaseModel):
    title: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None  # pending|approved|rejected|cancelled


class ReservationRead(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    start_time: datetime
    end_time: datetime
    status: str
    reviewed_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoomAvailability(BaseModel):
    """房间某日可用时段"""
    room_id: uuid.UUID
    date: str  # YYYY-MM-DD
    slots: list[dict[str, Any]]  # [{start, end, status, reservation_id}]

