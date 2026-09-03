export interface ImageCompressionOptions {
  thresholdBytes?: number
  maxEdge?: number
  quality?: number
}

const DEFAULT_THRESHOLD_BYTES = 512 * 1024
const DEFAULT_MAX_EDGE = 1600
const DEFAULT_QUALITY = 0.82
const compressibleTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function resolveImageType(file: File) {
  const type = file.type.toLowerCase()
  if (type) return type
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  return ''
}

function jpegFilename(filename: string) {
  const dotIndex = filename.lastIndexOf('.')
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return `${basename}.jpg`
}

async function loadImage(file: File) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('图片解码失败'))
      image.src = objectUrl
    })
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片压缩失败'))
    }, 'image/jpeg', quality)
  })
}

export async function compressImageForUpload(
  file: File,
  options: ImageCompressionOptions = {},
) {
  const thresholdBytes = options.thresholdBytes ?? DEFAULT_THRESHOLD_BYTES
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE
  const quality = options.quality ?? DEFAULT_QUALITY
  if (!compressibleTypes.has(resolveImageType(file)) || file.size <= thresholdBytes) return file

  const image = await loadImage(file)
  try {
    if (!image.width || !image.height) throw new Error('图片尺寸无效')
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器不支持图片压缩')

    // JPEG 不支持透明通道，统一使用白色背景，避免透明区域变黑。
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image.source, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, quality)
    if (scale === 1 && blob.size >= file.size) return file

    return new File([blob], jpegFilename(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } finally {
    image.release()
  }
}
