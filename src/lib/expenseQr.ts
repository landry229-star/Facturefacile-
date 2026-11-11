export async function decodeExpenseQrImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Sélectionnez une image du justificatif pour lire son QR code.')
  const imageUrl = URL.createObjectURL(file)
  try {
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(imageUrl)
      return result.getText()
    } catch {
      // Fall back to jsQR's full-image and cropped scans when ZXing cannot decode the image.
    }

    const bitmap = await createImageBitmap(file)
    try {
      const { default: jsQR } = await import('jsqr')
      const scanRegion = (left: number, top: number, regionWidth: number, regionHeight: number) => {
        const scale = Math.min(1, 2400 / Math.max(regionWidth, regionHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(regionWidth * scale))
        canvas.height = Math.max(1, Math.round(regionHeight * scale))
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Impossible de préparer l’image pour la lecture du QR code.')
        context.drawImage(bitmap, left, top, regionWidth, regionHeight, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
      }

      const fullImage = scanRegion(0, 0, bitmap.width, bitmap.height)
      if (fullImage) return fullImage

      const regionSize = Math.min(bitmap.width, bitmap.height) * 0.55
      for (const centerY of [0.2, 0.5, 0.8]) {
        for (const centerX of [0.2, 0.5, 0.8]) {
          const left = Math.max(0, Math.min(bitmap.width - regionSize, bitmap.width * centerX - regionSize / 2))
          const top = Math.max(0, Math.min(bitmap.height - regionSize, bitmap.height * centerY - regionSize / 2))
          const result = scanRegion(left, top, regionSize, regionSize)
          if (result) return result
        }
      }
      throw new Error('Aucun QR code lisible n’a été trouvé dans cette image. Essayez une photo plus nette et cadrée sur le code.')
    } finally {
      bitmap.close()
    }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
