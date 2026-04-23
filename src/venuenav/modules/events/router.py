from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from venuenav.common.deps import DbSession, UserId, get_org_if_member, require_org_editor, require_org_member
from venuenav.common.errors import not_found
from venuenav.db.models import Event, Venue

router = APIRouter()


class EventCreate(BaseModel):
    name: str
    starts_at: datetime
    ends_at: datetime | None = None


class EventOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    starts_at: datetime
    ends_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventUpdate(BaseModel):
    name: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


def _get_event_in_org(db: Session, org_id: uuid.UUID, event_id: uuid.UUID) -> Event:
    e = db.get(Event, event_id)
    if e is None or e.organization_id != org_id:
        raise not_found("Event")
    return e


@router.get(
    "/organizations/{org_id}/events",
    response_model=dict,
    tags=["Events"],
)
def list_events(
    org_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    get_org_if_member(db, org_id, user_id)
    count_q = select(func.count(Event.id)).where(Event.organization_id == org_id)
    total = db.execute(count_q).scalar() or 0
    off = (page - 1) * page_size
    rows = (
        db.execute(
            select(Event)
            .where(Event.organization_id == org_id)
            .order_by(Event.starts_at.desc())
            .offset(off)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return {
        "items": [EventOut.model_validate(x).model_dump() for x in rows],
        "page": page,
        "page_size": page_size,
        "total": int(total),
    }


@router.post(
    "/organizations/{org_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Events"],
)
def create_event(
    org_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: EventCreate,
) -> EventOut:
    m = require_org_member(db, org_id, user_id)
    require_org_editor(m)
    get_org_if_member(db, org_id, user_id)
    base = slugify(body.name) or "event"
    e = Event(
        id=uuid.uuid4(),
        organization_id=org_id,
        name=body.name,
        slug=f"{base}-{str(uuid.uuid4())[:6]}",
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return EventOut.model_validate(e)


@router.get(
    "/organizations/{org_id}/events/{event_id}",
    response_model=EventOut,
    tags=["Events"],
)
def get_event(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
) -> EventOut:
    get_org_if_member(db, org_id, user_id)
    return EventOut.model_validate(_get_event_in_org(db, org_id, event_id))


@router.patch(
    "/organizations/{org_id}/events/{event_id}",
    response_model=EventOut,
    tags=["Events"],
)
def patch_event(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: EventUpdate,
) -> EventOut:
    m = require_org_member(db, org_id, user_id)
    require_org_editor(m)
    e = _get_event_in_org(db, org_id, event_id)
    if body.name is not None:
        e.name = body.name
    if body.starts_at is not None:
        e.starts_at = body.starts_at
    if body.ends_at is not None:
        e.ends_at = body.ends_at
    e.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(e)
    return EventOut.model_validate(e)


@router.delete(
    "/organizations/{org_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Events"],
    response_class=Response,
)
def delete_event(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
) -> Response:
    m = require_org_member(db, org_id, user_id)
    require_org_editor(m)
    e = _get_event_in_org(db, org_id, event_id)
    db.delete(e)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class VenueCreate(BaseModel):
    name: str
    address: str | None = None


class VenueOut(BaseModel):
    id: uuid.UUID
    name: str
    address: str | None
    event_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


@router.get(
    "/organizations/{org_id}/events/{event_id}/venues",
    response_model=dict,
    tags=["Events"],
)
def list_venues(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    get_org_if_member(db, org_id, user_id)
    _ = _get_event_in_org(db, org_id, event_id)
    total = (
        db.execute(select(func.count(Venue.id)).where(Venue.event_id == event_id)).scalar() or 0
    )
    off = (page - 1) * page_size
    rows = (
        db.execute(select(Venue).where(Venue.event_id == event_id).offset(off).limit(page_size))
        .scalars()
        .all()
    )
    return {
        "items": [VenueOut.model_validate(x).model_dump() for x in rows],
        "page": page,
        "page_size": page_size,
        "total": int(total),
    }


@router.post(
    "/organizations/{org_id}/events/{event_id}/venues",
    response_model=VenueOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Events"],
)
def create_venue(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: VenueCreate,
) -> VenueOut:
    m = require_org_member(db, org_id, user_id)
    require_org_editor(m)
    _ = _get_event_in_org(db, org_id, event_id)
    v = Venue(
        id=uuid.uuid4(),
        event_id=event_id,
        name=body.name,
        address=body.address,
        created_at=datetime.now(timezone.utc),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return VenueOut.model_validate(v)
