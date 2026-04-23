from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from venuenav.common.deps import DbSession, get_org_if_member, require_org_editor, require_org_member, UserId
from venuenav.common.errors import not_found
from venuenav.db.models import Organization, UserMembership

router = APIRouter(prefix="/organizations", tags=["Organizations"])


class OrgCreate(BaseModel):
    name: str


class OrgOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    class Config:
        from_attributes = True


@router.get("", response_model=dict)
def list_organizations(
    db: DbSession, user_id: UserId, page: int = 1, page_size: int = 20
) -> dict:
    base = select(Organization).join(UserMembership, UserMembership.organization_id == Organization.id).where(
        UserMembership.user_id == user_id
    )
    total = (
        db.execute(
            select(func.count(Organization.id))
            .join(UserMembership, UserMembership.organization_id == Organization.id)
            .where(UserMembership.user_id == user_id)
        ).scalar()
        or 0
    )
    off = (page - 1) * page_size
    rows = db.execute(base.offset(off).limit(page_size)).scalars().all()
    return {
        "items": [OrgOut.model_validate(x).model_dump() for x in rows],
        "page": page,
        "page_size": page_size,
        "total": int(total),
    }


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
def create_org(db: DbSession, user_id: UserId, body: OrgCreate) -> OrgOut:
    from slugify import slugify

    base = slugify(body.name) or "org"
    o = Organization(
        id=uuid.uuid4(),
        name=body.name,
        slug=f"{base}-{str(uuid.uuid4())[:8]}",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(o)
    db.flush()
    m = UserMembership(
        id=uuid.uuid4(),
        user_id=user_id,
        organization_id=o.id,
        role="owner",
    )
    db.add(m)
    db.commit()
    db.refresh(o)
    return OrgOut.model_validate(o)


@router.get("/{org_id}", response_model=OrgOut)
def get_org(org_id: uuid.UUID, db: DbSession, user_id: UserId) -> OrgOut:
    o = get_org_if_member(db, org_id, user_id)
    return OrgOut.model_validate(o)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_org(org_id: uuid.UUID, db: DbSession, user_id: UserId) -> Response:
    m = require_org_member(db, org_id, user_id)
    if m.role != "owner":
        raise not_found("Permission")
    o = db.get(Organization, org_id)
    if o is None:
        raise not_found("Organization")
    db.delete(o)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
