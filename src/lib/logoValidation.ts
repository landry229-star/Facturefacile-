type LogoFormat = {
  extension: string
  matchesSignature: (bytes: Uint8Array) => boolean
}

const logoFormats: Record<string, LogoFormat> = {
  'image/png': {
    extension: 'png',
    matchesSignature: (bytes) => bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte),
  },
  'image/jpeg': {
    extension: 'jpg',
    matchesSignature: (bytes) => bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
  },
  'image/webp': {
    extension: 'webp',
    matchesSignature: (bytes) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
  },
}

async function validateImageFile(file: File, label: string): Promise<LogoFormat> {
  const format = logoFormats[file.type]
  if (!format) throw new Error(`${label} doit être au format PNG, JPEG ou WEBP.`)
  if (file.size > 2 * 1024 * 1024) throw new Error(`${label} ne doit pas dépasser 2 Mo.`)
  if (file.size === 0) throw new Error(`Le fichier ${label.toLowerCase()} est vide.`)

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!format.matchesSignature(header)) throw new Error('Le contenu du fichier ne correspond pas à son format image déclaré.')

  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 5000 || bitmap.height > 5000) {
      throw new Error(`${label} doit mesurer au maximum 5 000 × 5 000 pixels.`)
    }
  } finally {
    bitmap.close()
  }
  return format
}

export async function validateBusinessLogoFile(file: File) {
  return validateImageFile(file, 'Le logo')
}

export async function validateProfilePhotoFile(file: File) {
  return validateImageFile(file, 'La photo de profil')
}
