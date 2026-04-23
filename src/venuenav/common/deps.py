import uuid
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from venuenav.common.database import get_db
from venuenav.common.errors import not_found, http_error
from venuenav.config.settings import get_settings
from venuenav.db.models import AppUser, Organization, UserMembership

DbSession = Annotated[Session, Depends(get_db)]


def get_or_create_dev_user(db: Session) -> AppUser:
    s = get_settings()
    email = s.default_dev_user_email
    u = db.execute(select(AppUser).where(AppUser.email == email)).scalar_one_or_none()
    if u is None:
        u = AppUser(
            id=uuid.uuid4(),
            email=email,
            created_at=datetime.now(timezone.utc),
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    return u


def get_current_user_id(
    request: Request,
    db: DbSession,
    authorization: str | None = Header(None, alias="Authorization"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> UUID:
    s = get_settings()
    if s.auth_disabled and x_user_id:
        return UUID(x_user_id)
    if s.auth_disabled:
        u = get_or_create_dev_user(db)
        return u.id
    if not authorization or not authorization.startswith("Bearer "):
        raise http_error("Unauthorized", "UNAUTHORIZED", 401)
    u = get_or_create_dev_user(db)
    return u.id


UserId = Annotated[UUID, Depends(get_current_user_id)]


def require_org_member(db: Session, org_id: UUID, user_id: UUID) -> UserMembership:
    m = (
        db.execute(
            select(UserMembership).where(
                UserMembership.organization_id == org_id,
                UserMembership.user_id == user_id,
            )
        )
        .scalar_one_or_none()
    )
    if m is None:
        raise not_found("Organization membership")
    if m.role not in ("owner", "editor", "viewer"):
        raise not_found("Organization membership")
    return m


def require_org_editor(membership: UserMembership) -> None:
    if membership.role not in ("owner", "editor"):
        raise http_error("Editor role required", "FORBIDDEN", 403)


def get_org_if_member(db: DbSession, org_id: UUID, user_id: UserId) -> Organization:
    m = require_org_member(db, org_id, user_id)
    o = db.get(Organization, org_id)
    if o is None:
        raise not_found("Organization")
    _ = m
    return o
