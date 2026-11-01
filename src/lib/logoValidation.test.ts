import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateBusinessLogoFile, validateProfilePhotoFile } from './logoValidation'

const validPng = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])

afterEach(() => vi.unstubAllGlobals())

describe('business logo validation', () => {
  it('accepts a correctly signed, decodable PNG within the pixel limit', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1200, height: 800, close }))
    const file = new File([validPng], 'logo.png', { type: 'image/png' })

    await expect(validateBusinessLogoFile(file)).resolves.toMatchObject({ extension: 'png' })
    expect(close).toHaveBeenCalledOnce()
  })

  it('rejects unsupported formats and content that does not match the MIME type', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)

    await expect(validateBusinessLogoFile(new File([validPng], 'logo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG, JPEG ou WEBP')
    await expect(validateBusinessLogoFile(new File(['not a png'], 'logo.png', { type: 'image/png' }))).rejects.toThrow('ne correspond pas')
    expect(decode).not.toHaveBeenCalled()
  })

  it('rejects oversized images by file size and decoded dimensions', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 5001, height: 100, close: vi.fn() }))

    await expect(validateBusinessLogoFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow('2 Mo')
    await expect(validateBusinessLogoFile(new File([validPng], 'wide.png', { type: 'image/png' }))).rejects.toThrow('5 000 × 5 000')
  })

  it('applies the same content validation to profile photos with user-facing labels', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1200, height: 800, close: vi.fn() }))
    await expect(validateProfilePhotoFile(new File([validPng], 'avatar.png', { type: 'image/png' }))).resolves.toMatchObject({ extension: 'png' })
    await expect(validateProfilePhotoFile(new File([validPng], 'avatar.svg', { type: 'image/svg+xml' }))).rejects.toThrow('La photo de profil doit être au format')
  })
})
