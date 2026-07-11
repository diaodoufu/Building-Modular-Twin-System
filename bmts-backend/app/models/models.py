import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    """组织表 - 最顶层容器"""
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    org_type: Mapped[str] = mapped_column(String(32), nullable=False)  # campus|hospital|government|enterprise
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    invite_code: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    base_attrs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ext_attrs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    containers: Mapped[list["Container"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class OrganizationMember(Base):
    """组织-用户关联（多对多）"""
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", name="uq_org_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="member")  # owner|admin|member
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="org_memberships")


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(256), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    org_memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reservations: Mapped[list["Reservation"]] = relationship(foreign_keys="Reservation.user_id", back_populates="user", cascade="all, delete-orphan")
    reviewed_reservations: Mapped[list["Reservation"]] = relationship(foreign_keys="Reservation.reviewed_by", back_populates="reviewer")


class Container(Base):
    """核心容器表 - 所有空间实体共用"""
    __tablename__ = "containers"
    __table_args__ = (
        Index("idx_containers_org", "org_id"),
        Index("idx_containers_type", "type"),
        Index("idx_containers_parent", "parent_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # campus|building|floor|room|resource
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    base_attrs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ext_attrs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    position: Mapped[dict | None] = mapped_column(JSONB, nullable=True)   # { x, y, z }
    dimensions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # { width, height, depth }

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="containers")
    children: Mapped[list["Container"]] = relationship(back_populates="parent", cascade="all, delete-orphan")
    parent: Mapped["Container | None"] = relationship(back_populates="children", remote_side="Container.id")
    reservations: Mapped[list["Reservation"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class Reservation(Base):
    """预约表"""
    __tablename__ = "reservations"
    __table_args__ = (
        Index("idx_reservations_room_time", "room_id", "start_time", "end_time"),
        Index("idx_reservations_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")  # pending|approved|rejected|cancelled
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    room: Mapped["Container"] = relationship(back_populates="reservations")
    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="reservations")
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by], back_populates="reviewed_reservations")
