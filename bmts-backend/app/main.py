from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import auth, containers, data, health, organizations, reservations, stats
from app.database import init_db
from app.models.models import Organization, OrganizationMember, User, Container, Reservation, OrganizationJoinRequest  # noqa: 确保所有模型被导入


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(organizations.router, prefix="/api/v1/orgs", tags=["organizations"])
app.include_router(containers.router, prefix="/api/v1/containers", tags=["containers"])
app.include_router(reservations.router, prefix="/api/v1/reservations", tags=["reservations"])
app.include_router(data.router, prefix="/api/v1/data", tags=["data"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["stats"])


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION}
