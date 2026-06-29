// ESC/POS termal yazıcı komutları.
//
// Türkçe karakter sorununu kökten çözmek için METİN MODU yerine fişi
// monokrom GÖRÜNTÜ (raster bitmap) olarak basıyoruz: ç/ğ/ı/ş/İ ve logo
// yazıcının kod sayfasına bağlı kalmadan birebir çıkar. Komut: GS v 0.
//
// Kağıt genişliği nokta (dot) cinsinden: 58mm ≈ 384, 80mm ≈ 576 (203 dpi).

export const PAPER_DOTS = { '58mm': 384, '80mm': 576 } as const
export type PaperWidth = keyof typeof PAPER_DOTS

const ESC = 0x1b
const GS = 0x1d

/** Yazıcıyı sıfırla (ESC @). */
function initBytes(): number[] {
  return [ESC, 0x40]
}

/** n satır kağıt besle. */
function feedBytes(lines = 4): number[] {
  return [ESC, 0x64, lines] // ESC d n
}

/** Kağıt kes (destekleyen yazıcılarda; yoksa görmezden gelinir). */
function cutBytes(): number[] {
  return [GS, 0x56, 0x42, 0x00] // GS V B 0 → partial cut + feed
}

/**
 * Bir canvas'ı ESC/POS raster (GS v 0) byte dizisine çevirir.
 * Genişlik 8'in katına yuvarlanır (byte hizalama). Açık pikseller beyaz,
 * koyu pikseller siyah basılır (luminance eşiği).
 */
export function canvasToRaster(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const w = canvas.width
  const h = canvas.height
  const { data } = ctx.getImageData(0, 0, w, h)

  const bytesPerRow = Math.ceil(w / 8)
  const out: number[] = [
    GS, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, // xL, xH
    h & 0xff, (h >> 8) & 0xff,                     // yL, yH
  ]

  for (let y = 0; y < h; y++) {
    for (let bx = 0; bx < bytesPerRow; bx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit
        if (x < w) {
          const i = (y * w + x) * 4
          const alpha = data[i + 3]
          // luminance (siyah-beyaz eşik). Şeffaf veya açık → beyaz (0).
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
          if (alpha > 128 && lum < 128) byte |= 0x80 >> bit
        }
      }
      out.push(byte)
    }
  }
  return out
}

/**
 * Tam baskı paketi: init + raster + besle (+ opsiyonel kesme).
 * @returns Uint8Array — Bluetooth karakteristiğine yazılmaya hazır.
 */
export function buildPrintPayload(
  canvas: HTMLCanvasElement,
  opts: { cut?: boolean; feedLines?: number } = {},
): Uint8Array {
  const bytes = [
    ...initBytes(),
    ...canvasToRaster(canvas),
    ...feedBytes(opts.feedLines ?? 4),
    ...(opts.cut ? cutBytes() : []),
  ]
  return Uint8Array.from(bytes)
}
