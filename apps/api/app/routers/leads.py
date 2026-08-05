import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.events import Lead

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class LeadIn(BaseModel):
    profile_id: uuid.UUID
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    message: str | None = None


@router.post("/")
@limiter.limit("10/minute")
async def submit_lead(
    request: Request,
    body: LeadIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    lead = Lead(**body.model_dump())
    db.add(lead)
    await db.commit()
    return {"submitted": True}
