import json
import re
import uuid
import zipfile
from io import BytesIO
from pathlib import PurePosixPath
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles
from app.models.template import Template
from app.models.template_background import TemplateBackground
from app.models.user import User, UserRole
from app.utils.images import optimize_template_background
from app.utils.storage import delete_public_asset, save_public_asset

router = APIRouter()
SuperAdmin = Depends(require_roles(UserRole.super_admin))
AdminOrOwner = Depends(require_roles(UserRole.super_admin, UserRole.business_owner))

_MAX_ZIP_BYTES = 25 * 1024 * 1024
_MAX_ARCHIVE_FILES = 20
_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
_SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,79}$")
_LAYOUTS = {"classic", "minimal", "corporate", "spotlight"}


class TemplateOut(BaseModel):
    id: str
    name: str
    layout: str
    palette: dict
    branding: dict
    locked: bool
    background: dict | None = None


def _safe_archive_entries(data: bytes) -> dict[str, bytes]:
    try:
        archive = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Upload a valid ZIP template archive.") from exc

    entries = archive.infolist()
    if len(entries) > _MAX_ARCHIVE_FILES:
        raise HTTPException(status_code=400, detail="Template ZIP contains too many files.")
    if sum(entry.file_size for entry in entries) > _MAX_UNCOMPRESSED_BYTES:
        raise HTTPException(status_code=413, detail="Template ZIP expands beyond the 50 MB limit.")

    files: dict[str, bytes] = {}
    for entry in entries:
        path = PurePosixPath(entry.filename)
        if entry.is_dir():
            continue
        if path.is_absolute() or ".." in path.parts:
            raise HTTPException(status_code=400, detail="ZIP contains an unsafe file path.")
        files[path.as_posix()] = archive.read(entry)
    return files


def _template_json_path(files: dict[str, bytes]) -> str:
    candidates = [path for path in files if PurePosixPath(path).name == "template.json"]
    if len(candidates) != 1:
        raise HTTPException(status_code=400, detail="Template ZIP must include exactly one template.json file.")
    return candidates[0]


def _validated_template_json(raw: bytes) -> dict:
    try:
        template = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="template.json must contain valid UTF-8 JSON.") from exc
    if not isinstance(template, dict):
        raise HTTPException(status_code=400, detail="template.json must be an object.")
    template_id = template.get("id") or template.get("slug")
    if not isinstance(template_id, str) or not _SAFE_ID.fullmatch(template_id):
        raise HTTPException(status_code=400, detail="template.json requires an id or slug of lowercase letters, digits, and hyphens.")
    template["id"] = template_id
    if not isinstance(template.get("name"), str) or not template["name"].strip():
        raise HTTPException(status_code=400, detail="template.json requires a non-empty name.")
    if template.get("layout") not in _LAYOUTS:
        raise HTTPException(status_code=400, detail="template.json has an unsupported layout.")
    if not isinstance(template.get("palette"), dict):
        raise HTTPException(status_code=400, detail="template.json requires a palette object.")
    for field in ("background", "branding", "assets", "features"):
        if field in template and not isinstance(template[field], dict):
            raise HTTPException(status_code=400, detail=f"template.json {field} must be an object.")
    return template


def _asset_path(value: object, template_json_path: str, files: dict[str, bytes]) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    path = PurePosixPath(value)
    if ".." in path.parts or path.suffix.lower() not in _IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Asset references must name a JPG, PNG, or WebP file inside the ZIP.")
    template_dir = PurePosixPath(template_json_path).parent
    relative_path = (template_dir / path.name) if path.is_absolute() else template_dir / path
    normalized = relative_path.as_posix().lstrip("./")
    if normalized in files:
        return normalized
    # Web URLs in a template definition may include a public prefix; resolve the
    # final filename relative to the template directory when packaging the ZIP.
    fallback = (template_dir / path.name).as_posix().lstrip("./")
    if fallback in files:
        return fallback
    return normalized


def _save_image(template_id: str, kind: str, file_name: str, files: dict[str, bytes]) -> tuple[str, str]:
    data = files.get(file_name)
    if data is None:
        raise HTTPException(status_code=400, detail=f"Referenced asset '{file_name}' is missing from the ZIP.")
    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
        optimized = optimize_template_background(data)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Asset '{file_name}' is not a valid supported image.") from exc
    key = f"templates/{template_id}/{kind}-{uuid.uuid4().hex}.webp"
    return key, save_public_asset(key, optimized, content_type="image/webp")


def _to_out(template: Template, background: TemplateBackground | None) -> TemplateOut:
    return TemplateOut(
        id=template.id,
        name=template.name,
        layout=template.layout,
        palette=json.loads(template.palette_json),
        branding=json.loads(template.branding_json),
        locked=template.locked,
        background={
            "image_url": background.image_url,
            "position": background.position,
            "size_mode": background.size_mode,
            "opacity": background.opacity,
            "overlay_color": background.overlay_color,
            "overlay_opacity": background.overlay_opacity,
            "text_color": background.text_color,
            "lock_background": background.lock_background,
        } if background else None,
    )


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    _: Annotated[User, AdminOrOwner], db: Annotated[AsyncSession, Depends(get_db)]
) -> list[TemplateOut]:
    templates = (await db.execute(select(Template).order_by(Template.name))).scalars().all()
    backgrounds = {
        row.theme_id: row
        for row in (await db.execute(select(TemplateBackground))).scalars().all()
    }
    return [_to_out(template, backgrounds.get(template.id)) for template in templates]


@router.post("/import-zip", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def import_template_zip(
    current_user: Annotated[User, SuperAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File(...)],
) -> TemplateOut:
    if file.content_type not in {"application/zip", "application/x-zip-compressed", "application/octet-stream"} and not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload a .zip template archive.")
    data = await file.read()
    if len(data) > _MAX_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="Template ZIP is too large (max 25 MB).")
    files = _safe_archive_entries(data)
    template_json_path = _template_json_path(files)
    definition = _validated_template_json(files[template_json_path])
    template_id = definition["id"]
    background_definition = dict(definition.get("background", {}))
    assets = definition.get("assets", {})
    if not background_definition.get("image") and assets.get("background"):
        background_definition["image"] = assets["background"]
    branding = dict(definition.get("branding", {}))
    branding["features"] = definition.get("features", {})
    background_file = _asset_path(background_definition.get("image"), template_json_path, files)
    asset_keys: list[str] = []

    try:
        if background_file:
            background_key, background_url = _save_image(template_id, "background", background_file, files)
            asset_keys.append(background_key)
        else:
            background_key = background_url = None
        asset_references = {
            "logo": branding.get("logo") or assets.get("logo"),
            "tapcard_logo": branding.get("tapcardLogo") or assets.get("tapcardLogo"),
            "icon": branding.get("icon") or assets.get("icon"),
            "preview": branding.get("preview") or assets.get("preview"),
        }
        for field, reference in asset_references.items():
            asset_file = _asset_path(reference, template_json_path, files)
            if asset_file:
                key, url = _save_image(template_id, field, asset_file, files)
                asset_keys.append(key)
                branding[f"{field}_url"] = url
                branding.pop(field, None)

        existing = await db.get(Template, template_id)
        old_background = (
            await db.execute(select(TemplateBackground).where(TemplateBackground.theme_id == template_id))
        ).scalar_one_or_none()
        template = existing or Template(id=template_id, name=definition["name"], created_by_id=current_user.id)
        template.name = definition["name"].strip()
        template.layout = definition["layout"]
        template.palette_json = json.dumps(definition["palette"])
        template.branding_json = json.dumps(branding)
        template.locked = bool(definition.get("locked", True))
        db.add(template)

        background = old_background or TemplateBackground(theme_id=template_id)
        if background_url:
            old_key = background.image_key
            background.image_key = background_key
            background.image_url = background_url
            background.position = background_definition.get("position", "center center")
            background.size_mode = background_definition.get("size_mode", "cover")
            background.opacity = float(background_definition.get("opacity", 1))
            background.overlay_color = background_definition.get("overlay_color")
            background.overlay_opacity = float(background_definition.get("overlay_opacity", 0))
            background.text_color = background_definition.get("text_color")
            db.add(background)
        else:
            old_key = None
        await db.commit()
        await db.refresh(template)
        if old_key:
            delete_public_asset(old_key)
        return _to_out(template, background if background_url else old_background)
    except Exception:
        for key in asset_keys:
            delete_public_asset(key)
        await db.rollback()
        raise
