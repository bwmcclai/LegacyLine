import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import type { Recording } from '@/lib/types'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/** Extract public_id from a Cloudinary secure_url */
function extractPublicId(url: string): string {
  // e.g. https://res.cloudinary.com/cloud/video/upload/v123/audio-abc.webm
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^./?]+)?(?:\?.*)?$/)
  if (!match) throw new Error(`Could not parse public_id from URL: ${url}`)
  return match[1]
}

export async function POST(req: NextRequest) {
  try {
    const { name, audio_url, selfie_url, duration } = await req.json()

    if (!name || !audio_url) {
      return NextResponse.json({ error: 'name and audio_url are required' }, { status: 400 })
    }

    const publicId = extractPublicId(audio_url)

    // Attach metadata to the Cloudinary asset so we can retrieve it later
    await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      resource_type: 'video',
      context: {
        name,
        duration: String(duration ?? ''),
        selfie_url: selfie_url ?? '',
      },
    })

    const recording: Recording = {
      id: publicId,
      name,
      audio_url,
      selfie_url: selfie_url ?? null,
      duration: duration ?? null,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json(recording)
  } catch (err: any) {
    console.error('[POST /api/recordings]', err)
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const result = await cloudinary.api.resources_by_tag('legacyline', {
      resource_type: 'video',
      context: true,
      max_results: 500,
    })

    const recordings: Recording[] = result.resources.map((r: any) => ({
      id: r.public_id,
      name: r.context?.custom?.name ?? r.public_id,
      audio_url: r.secure_url,
      selfie_url: r.context?.custom?.selfie_url || null,
      duration: r.context?.custom?.duration ? Number(r.context.custom.duration) : null,
      created_at: r.created_at,
    }))

    recordings.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    return NextResponse.json(recordings)
  } catch (err: any) {
    console.error('[GET /api/recordings]', err)
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 })
  }
}
