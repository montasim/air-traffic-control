#!/usr/bin/env python3
"""Build deterministic, actual-size V2.1 visual approval sheets.

These files are review evidence only. They do not enter the runtime bundle.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
MASTER_DIR = ROOT / "art" / "visual-v3" / "aircraft" / "masters"
REVIEW_DIR = ROOT / "art" / "visual-v3" / "review"
MAP_PATH = REVIEW_DIR / "river-bend-airport-landscape-v1.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    path = Path("/usr/share/fonts/truetype/dejavu") / name
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def trimmed(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"Asset has no visible pixels: {path}")
    return image.crop(bounds)


def scale_major_axis(image: Image.Image, target: int) -> Image.Image:
    scale = target / max(image.size)
    size = tuple(max(1, round(value * scale)) for value in image.size)
    return image.resize(size, Image.Resampling.LANCZOS)


def helicopter_master() -> Image.Image:
    body = Image.open(MASTER_DIR / "helicopter-body-v1.png").convert("RGBA")
    rotor = Image.open(MASTER_DIR / "helicopter-rotor-v1.png").convert("RGBA")
    if body.size != rotor.size:
        raise ValueError("Helicopter body and rotor masters must share a canvas and hub anchor")
    combined = Image.alpha_composite(body, rotor)
    bounds = combined.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Helicopter composite has no visible pixels")
    return combined.crop(bounds)


def aircraft() -> dict[str, Image.Image]:
    return {
        "LINER": scale_major_axis(trimmed(MASTER_DIR / "liner-v1.png"), 78),
        "COMMUTER": scale_major_axis(trimmed(MASTER_DIR / "commuter-v1.png"), 64),
        "ROTOR": scale_major_axis(helicopter_master(), 70),
    }


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def rotated(image: Image.Image, degrees: float) -> Image.Image:
    return image.rotate(-degrees, resample=Image.Resampling.BICUBIC, expand=True)


def paste_aircraft(
    canvas: Image.Image,
    sprite: Image.Image,
    center: tuple[int, int],
    *,
    heading: float = 0,
    selected: bool = False,
    warning: bool = False,
    alpha: float = 1,
) -> None:
    sprite = rotated(sprite, heading)
    if alpha < 1:
        sprite = sprite.copy()
        sprite.putalpha(sprite.getchannel("A").point(lambda value: round(value * alpha)))

    x = round(center[0] - sprite.width / 2)
    y = round(center[1] - sprite.height / 2)
    radius = max(sprite.size) * 0.58

    draw = ImageDraw.Draw(canvas, "RGBA")
    if warning:
        draw.ellipse(
            (center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius),
            outline=(225, 112, 87, 235),
            width=3,
        )
    if selected:
        for pad, color, width in ((7, (14, 35, 45, 244), 6), (4, (247, 242, 226, 250), 2)):
            ring = radius + pad
            draw.ellipse(
                (center[0] - ring, center[1] - ring, center[0] + ring, center[1] + ring),
                outline=color,
                width=width,
            )

    shadow_alpha = sprite.getchannel("A").filter(ImageFilter.GaussianBlur(3))
    shadow_alpha = shadow_alpha.point(lambda value: round(value * 0.18))
    shadow = Image.new("RGBA", sprite.size, (7, 18, 24, 0))
    shadow.putalpha(shadow_alpha)
    canvas.alpha_composite(shadow, (x + 5, y + 7))
    canvas.alpha_composite(sprite, (x, y))


def draw_route(
    canvas: Image.Image,
    points: list[tuple[float, float]],
    core: tuple[int, int, int, int],
    *,
    invalid: bool = False,
) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    sampled: list[tuple[float, float]] = []
    if len(points) == 4:
        start, control_a, control_b, end = points
        for step in range(41):
            t = step / 40
            inverse = 1 - t
            sampled.append((
                inverse**3 * start[0]
                + 3 * inverse**2 * t * control_a[0]
                + 3 * inverse * t**2 * control_b[0]
                + t**3 * end[0],
                inverse**3 * start[1]
                + 3 * inverse**2 * t * control_a[1]
                + 3 * inverse * t**2 * control_b[1]
                + t**3 * end[1],
            ))
    else:
        sampled = points
    draw.line(sampled, fill=(11, 29, 37, 218), width=7, joint="curve")
    draw.line(
        sampled,
        fill=(238, 143, 121, 244) if invalid else core,
        width=3,
        joint="curve",
    )


def patch_from_map(map_image: Image.Image, center: tuple[int, int], size: tuple[int, int]) -> Image.Image:
    width, height = size
    left = max(0, min(map_image.width - width, center[0] - width // 2))
    top = max(0, min(map_image.height - height, center[1] - height // 2))
    return map_image.crop((left, top, left + width, top + height))


def build_contact_sheet(fleet: dict[str, Image.Image], map_image: Image.Image) -> None:
    cell = (320, 205)
    header = 82
    sheet = Image.new("RGBA", (cell[0] * 4, header + cell[1] * 3), (18, 22, 24, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    draw.text((24, 17), "AIRCRAFT / MATERIAL LEGIBILITY", font=font(26, True), fill=(244, 240, 231, 255))
    draw.text((24, 50), "Actual gameplay scale — unselected left, selected right", font=font(14), fill=(192, 199, 198, 255))

    sources = [
        ("GRASS", (700, 520)),
        ("WATER", (320, 360)),
        ("RUNWAY", (1170, 205)),
        ("APRON", (1270, 355)),
    ]
    for column, (label, center) in enumerate(sources):
        draw.text((column * cell[0] + 14, header - 25), label, font=font(13, True), fill=(232, 227, 215, 255))
        for row, (kind, sprite) in enumerate(fleet.items()):
            tile = cover_crop(patch_from_map(map_image, center, (420, 280)), cell)
            origin = (column * cell[0], header + row * cell[1])
            sheet.alpha_composite(tile, origin)
            tile_center_y = origin[1] + cell[1] // 2 + 9
            paste_aircraft(sheet, sprite, (origin[0] + 92, tile_center_y), heading=8)
            paste_aircraft(sheet, sprite, (origin[0] + 229, tile_center_y), heading=-13, selected=True)
            draw.rectangle(
                (origin[0], origin[1], origin[0] + cell[0] - 1, origin[1] + cell[1] - 1),
                outline=(242, 237, 225, 56),
                width=1,
            )
            if column == 0:
                draw.rounded_rectangle(
                    (origin[0] + 10, origin[1] + 10, origin[0] + 104, origin[1] + 35),
                    radius=7,
                    fill=(15, 20, 23, 210),
                )
                draw.text((origin[0] + 19, origin[1] + 16), kind, font=font(11, True), fill=(244, 240, 231, 255))

    sheet.convert("RGB").save(REVIEW_DIR / "aircraft-material-contact-sheet-v1.png", optimize=True)


def build_operational_composite(fleet: dict[str, Image.Image], map_image: Image.Image) -> None:
    canvas = cover_crop(map_image, (1600, 900)).convert("RGBA")

    draw_route(canvas, [(420, 270), (620, 150), (840, 160), (923, 204)], (111, 194, 200, 248))
    draw_route(canvas, [(680, 590), (840, 620), (980, 560), (1013, 418)], (230, 166, 83, 248))
    draw_route(canvas, [(805, 425), (930, 520), (1110, 520), (1245, 475)], (237, 137, 113, 248), invalid=True)
    draw_route(canvas, [(1220, 730), (1180, 600), (1090, 450), (1035, 350)], (230, 166, 83, 248))

    paste_aircraft(canvas, fleet["LINER"], (420, 270), heading=-11, selected=True)
    paste_aircraft(canvas, fleet["COMMUTER"], (680, 590), heading=23)
    paste_aircraft(canvas, fleet["ROTOR"], (805, 425), heading=-26, warning=True)
    paste_aircraft(canvas, fleet["LINER"], (765, 452), heading=12, warning=True)
    paste_aircraft(canvas, fleet["COMMUTER"], (1220, 730), heading=-82)
    paste_aircraft(canvas, fleet["LINER"], (930, 206), heading=0, alpha=0.58)

    draw = ImageDraw.Draw(canvas, "RGBA")
    for x, title, value in ((14, "SCORE", "07"), (1510, "BEST", "32")):
        draw.rounded_rectangle((x, 14, x + 76, 78), radius=12, fill=(17, 22, 25, 239))
        draw.text((x + 12, 24), title, font=font(10, True), fill=(184, 193, 192, 255))
        draw.text((x + 11, 39), value, font=font(28, True), fill=(246, 242, 232, 255))
    draw.rounded_rectangle((1536, 836, 1586, 886), radius=12, fill=(17, 22, 25, 235))
    draw.ellipse((1551, 851, 1571, 871), outline=(246, 242, 232, 240), width=2)
    draw.line((1557, 856, 1557, 866), fill=(246, 242, 232, 240), width=2)
    draw.line((1565, 856, 1565, 866), fill=(246, 242, 232, 240), width=2)

    canvas.convert("RGB").save(REVIEW_DIR / "river-bend-operational-composite-v1.png", optimize=True)


def main() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    map_image = Image.open(MAP_PATH).convert("RGBA")
    fleet = aircraft()
    build_contact_sheet(fleet, map_image)
    build_operational_composite(fleet, map_image)


if __name__ == "__main__":
    main()
