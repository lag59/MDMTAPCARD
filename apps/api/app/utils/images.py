import io

from PIL import Image

MAX_WIDTH_PX = 1920
WEBP_QUALITY = 80


def optimize_template_background(data: bytes) -> bytes:
    """Resize to a max width of 1920px, convert to WebP, and compress for web use."""
    image = Image.open(io.BytesIO(data))
    image.load()

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

    if image.width > MAX_WIDTH_PX:
        ratio = MAX_WIDTH_PX / image.width
        new_size = (MAX_WIDTH_PX, max(1, round(image.height * ratio)))
        image = image.resize(new_size, Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=6)
    return buffer.getvalue()
