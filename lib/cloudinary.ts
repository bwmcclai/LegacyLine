import type { Recording } from './types'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

export async function uploadAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob)
  form.append('upload_preset', UPLOAD_PRESET)
  form.append('tags', 'legacyline')

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
    { method: 'POST', body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Audio upload failed')
  }
  const data = await res.json()
  return data.secure_url
}

export async function uploadSelfie(dataUrl: string): Promise<string> {
  const form = new FormData()
  form.append('file', dataUrl)
  form.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Selfie upload failed')
  }
  const data = await res.json()
  return data.secure_url
}

export async function saveRecording(
  recording: Omit<Recording, 'id' | 'created_at'>
): Promise<Recording> {
  const res = await fetch('/api/recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recording),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to save recording')
  }
  return res.json()
}

export async function getRecordings(): Promise<Recording[]> {
  const res = await fetch('/api/recordings')
  if (!res.ok) throw new Error('Failed to load recordings')
  return res.json()
}
