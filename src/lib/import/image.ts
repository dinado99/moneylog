const TARGET_WIDTH = 1000;
const TILE_HEIGHT = 1400;
const OVERLAP = 160;

/**
 * 긴 휴대폰 캡처를 그대로 보내면 글자가 너무 작게 축소되므로
 * 폭을 맞춘 뒤 세로로 살짝 겹치게 잘라 JPEG(base64)로 만든다.
 */
export async function screenshotToTiles(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, TARGET_WIDTH / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const tiles: string[] = [];
  for (let top = 0; top < h; top += TILE_HEIGHT - OVERLAP) {
    const tileH = Math.min(TILE_HEIGHT, h - top);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = tileH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, top / scale, bitmap.width, tileH / scale, 0, 0, w, tileH);
    tiles.push(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    if (top + tileH >= h) break;
  }
  bitmap.close();
  return tiles;
}
