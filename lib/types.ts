export interface Recording {
  id: string
  name: string
  audio_url: string
  selfie_url: string | null
  duration: number | null
  created_at: string
}
