// Görsel yardımcıları — Render dosya sistemi geçici (ephemeral) olduğu için
// yüklenen görseller dosya olarak DEĞİL, küçültülüp base64 data URL olarak
// MongoDB'de string alanda saklanır. Backend body limiti 1 MB olduğundan
// görseli tarayıcıda küçültüp sıkıştırıyoruz (payload + DB boyutu kontrol altında).

interface ResizeOpts {
  maxSize?: number   // en uzun kenar (px)
  quality?: number   // JPEG kalite 0..1
  maxBytes?: number  // hedef üst sınır (yaklaşık, data URL byte)
}

/**
 * Bir görsel dosyasını orantılı küçültüp JPEG base64 data URL döndürür.
 * Sonuç maxBytes'ı aşarsa kaliteyi kademeli düşürür.
 */
export async function fileToResizedDataUrl(
  file: File,
  { maxSize = 800, quality = 0.72, maxBytes = 700 * 1024 }: ResizeOpts = {},
): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  let { width, height } = img
  if (width >= height && width > maxSize) {
    height = Math.round((height * maxSize) / width)
    width = maxSize
  } else if (height > width && height > maxSize) {
    width = Math.round((width * maxSize) / height)
    height = maxSize
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)

  // Kaliteyi düşürerek boyutu hedefe çek (en fazla birkaç deneme)
  let q = quality
  let out = canvas.toDataURL('image/jpeg', q)
  while (approxBytes(out) > maxBytes && q > 0.4) {
    q -= 0.12
    out = canvas.toDataURL('image/jpeg', q)
  }
  return out
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Dosya okunamadı'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Görsel yüklenemedi'))
    img.src = src
  })
}

// base64 data URL'in yaklaşık byte boyutu
function approxBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor((b64.length * 3) / 4)
}
