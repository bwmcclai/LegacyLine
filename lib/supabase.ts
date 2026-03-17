import { createClient } from '@supabase/supabase-js'
import type { Recording } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getRecordings(): Promise<Recording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function uploadAudio(blob: Blob): Promise<string> {
  const fileName = `audio-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`
  const { error } = await supabase.storage
    .from('legacy-audio')
    .upload(fileName, blob, { contentType: 'audio/webm' })

  if (error) throw error

  const { data } = supabase.storage.from('legacy-audio').getPublicUrl(fileName)
  return data.publicUrl
}

export async function uploadSelfie(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const fileName = `selfie-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

  const { error } = await supabase.storage
    .from('legacy-selfies')
    .upload(fileName, blob, { contentType: 'image/jpeg' })

  if (error) throw error

  const { data } = supabase.storage.from('legacy-selfies').getPublicUrl(fileName)
  return data.publicUrl
}

export async function saveRecording(recording: Omit<Recording, 'id' | 'created_at'>): Promise<Recording> {
  const { data, error } = await supabase
    .from('recordings')
    .insert(recording)
    .select()
    .single()

  if (error) throw error
  return data
}
