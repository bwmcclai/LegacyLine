'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { uploadAudio, uploadSelfie, saveRecording } from '@/lib/supabase'

type Step = 'intro' | 'setup' | 'recording' | 'review' | 'details' | 'success'
const MAX_SECONDS = 30

// ─── Hero background image (the torch-passing particle art) ──────────
function HeroBg({ step }: { step: Step }) {
  // Opacity varies by step: rich on intro/success, subtle when recording
  const opacityMap: Record<Step, number> = {
    intro: 0.32,
    setup: 0.20,
    recording: 0.10,
    review: 0.16,
    details: 0.16,
    success: 0.45,
  }
  const opacity = opacityMap[step]

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      animate={{ opacity }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
    >
      {/* The particle art image */}
      <img
        src="/legacy-hero.jpg"
        alt=""
        className="w-full h-full object-cover object-center"
        style={{ mixBlendMode: 'luminosity' }}
      />
      {/* Dark vignette so cards read clearly */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 50% 50%, transparent 20%, rgba(8,6,0,0.55) 70%, rgba(8,6,0,0.85) 100%)',
        }}
      />
    </motion.div>
  )
}

// ─── Animated background: gold noise field ────────────────────────────
function GoldField() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Radial gradient center glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(201,168,76,0.09) 0%, transparent 70%)',
        }}
      />
      {/* Top streak */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: '-30%',
          width: '1px',
          height: '60%',
          background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.25), transparent)',
        }}
      />
      {/* Floating orbs */}
      {[
        { x: '12%', size: 340, delay: 0, opacity: 0.045 },
        { x: '78%', size: 280, delay: 3, opacity: 0.035 },
        { x: '45%', size: 420, delay: 1.5, opacity: 0.03 },
        { x: '88%', size: 180, delay: 5, opacity: 0.04 },
        { x: '5%', size: 220, delay: 2.5, opacity: 0.04 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: orb.x,
            top: '30%',
            width: orb.size,
            height: orb.size,
            marginLeft: -orb.size / 2,
            background: `radial-gradient(circle, rgba(201,168,76,${orb.opacity}) 0%, transparent 70%)`,
          }}
          animate={{ y: [-20, 20, -20], scale: [1, 1.06, 1] }}
          transition={{ duration: 14 + i * 2, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Rising gold sparks */}
      {[...Array(24)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${4 + i * 4}%`,
            bottom: 0,
            width: i % 3 === 0 ? 4 : 2,
            height: i % 3 === 0 ? 4 : 2,
            background: 'linear-gradient(to top, #c9a84c, #f5e08a)',
            boxShadow: '0 0 8px rgba(201,168,76,0.6)',
          }}
          animate={{
            y: [0, -(400 + Math.random() * 500)],
            x: [0, (Math.random() - 0.5) * 40],
            opacity: [0, 0.8, 0.4, 0],
          }}
          transition={{
            duration: 10 + i * 0.5,
            delay: i * 0.4,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
      
      {/* Passing the Torch - Subtle Miller 'N' watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <span style={{ fontSize: '40vw', fontWeight: 900, fontFamily: 'Georgia, serif', color: '#c9a84c' }}>N</span>
      </div>
    </div>
  )
}

// ─── Sound wave decorative SVG ────────────────────────────────────────
function SoundWave({ active = false, large = false }: { active?: boolean; large?: boolean }) {
  const bars = large ? 28 : 18
  return (
    <div className="flex items-center gap-[3px]" style={{ height: large ? 48 : 28 }}>
      {[...Array(bars)].map((_, i) => {
        const center = bars / 2
        const dist = Math.abs(i - center) / center
        const baseH = large
          ? (1 - dist * 0.7) * 46
          : (1 - dist * 0.65) * 26
        return (
          <motion.div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{ width: large ? 3 : 2 }}
            animate={
              active
                ? {
                  height: [`${baseH * 0.3}px`, `${baseH * (0.5 + Math.random() * 0.5)}px`, `${baseH * 0.3}px`],
                  opacity: [0.4, 1, 0.4],
                  background: ['#c9a84c', '#e6c96d', '#c9a84c'],
                }
                : { height: `${baseH * 0.35}px`, opacity: 0.35, background: '#c9a84c' }
            }
            transition={{
              duration: 0.5 + (i % 4) * 0.2,
              delay: i * 0.04,
              repeat: active ? Infinity : 0,
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Countdown ring ───────────────────────────────────────────────────
function CountdownRing({ seconds, max }: { seconds: number; max: number }) {
  const r = 58
  const circ = 2 * Math.PI * r
  const progress = seconds / max

  return (
    <svg width="136" height="136" className="absolute inset-0 m-auto" style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a07832" />
          <stop offset="50%" stopColor="#e6c96d" />
          <stop offset="100%" stopColor="#a07832" />
        </linearGradient>
        <filter id="timerGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(201,168,76,0.08)" strokeWidth="3" />
      {/* Progress */}
      <circle
        cx="68" cy="68" r={r}
        fill="none"
        stroke="url(#timerGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - circ * progress}
        filter="url(#timerGlow)"
        style={{ transition: 'stroke-dashoffset 0.9s linear' }}
      />
    </svg>
  )
}

// ─── Live waveform ────────────────────────────────────────────────────
function LiveWaveform({ data, active }: { data: number[]; active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 64 }}>
      {data.map((val, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ width: '3px' }}
          animate={{
            height: active ? `${Math.max(5, val * 58)}px` : '5px',
            background: active
              ? `rgba(201, 168, 76, ${0.3 + val * 0.7})`
              : 'rgba(201, 168, 76, 0.18)',
            boxShadow: active && val > 0.5 ? `0 0 6px rgba(201,168,76,${val * 0.6})` : 'none',
          }}
          transition={{ duration: 0.05, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ─── Inspirational quote pill ─────────────────────────────────────────
const QUOTES = [
  { text: '"Be the voice they remember."', attr: 'Legacy Line' },
  { text: '"Once a Miller, Always a Miller."', attr: 'Noblesville Schools' },
  { text: '"Your words today shape who they become tomorrow."', attr: 'Legacy Line' },
]

function QuotePill() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((p) => (p + 1) % QUOTES.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="overflow-hidden" style={{ height: 44 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-sm italic" style={{ color: 'rgba(201,168,76,0.75)' }}>
            {QUOTES[idx].text}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Main page component ──────────────────────────────────────────────
export default function RecordPage() {
  const [step, setStep] = useState<Step>('intro')
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS)
  const [secondsRecorded, setSecondsRecorded] = useState(0)
  const [name, setName] = useState('')
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [waveform, setWaveform] = useState<number[]>(Array(50).fill(0.05))
  const [showCamera, setShowCamera] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    cancelAnimationFrame(animRef.current)
    audioCtxRef.current?.close()
    camStreamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mrRef.current?.state !== 'inactive') mrRef.current?.stop()
    setIsRecording(false)
  }, [])

  const togglePause = () => {
    if (!mrRef.current) return
    if (isPaused) {
      mrRef.current.resume()
      setIsPaused(false)
    } else {
      mrRef.current.pause()
      setIsPaused(true)
    }
  }

  const prepareMic = useCallback(async () => {
    if (streamRef.current) return
    setErrorMsg(null)
    console.log('[Mic] Preparing microphone...')
    try {
      // 1. Initial request to ensure permissions and populate labels
      let stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 2. Enumerate for preference
      const devices = await navigator.mediaDevices.enumerateDevices()
      const preferredMic = devices.find(d => 
        d.kind === 'audioinput' && 
        (d.label.toLowerCase().includes('microphone') || d.label.toLowerCase().includes('built-in'))
      )

      if (preferredMic && !stream.getAudioTracks()[0].label.toLowerCase().includes('built-in')) {
        console.log('[Mic] Switching to preferred device:', preferredMic.label)
        stream.getTracks().forEach(t => t.stop())
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { deviceId: { exact: preferredMic.deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        })
      }

      streamRef.current = stream
      setMicStream(stream)

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx
      
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      src.connect(analyser)
      analyserRef.current = analyser

      const draw = () => {
        if (!analyserRef.current) return
        const d = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(d)
        setWaveform(Array.from(d.slice(0, 50)).map((v) => v / 255))
        animRef.current = requestAnimationFrame(draw)
      }

      if (ctx.state === 'suspended') {
        console.log('[Mic] Resuming suspended context...')
        await ctx.resume()
      }
      console.log('[Mic] Context state:', ctx.state)

      draw()
      setStep('setup')
    } catch (err: any) {
      console.error('[Mic] Preparation failed:', err)
      setErrorMsg('Microphone access is required to record your message.')
    }
  }, [])

  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    console.log('[Recorder] Starting recording flow...')
    
    try {
      // 1. Enumerate devices for debugging
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioDevices = devices.filter(d => d.kind === 'audioinput')
      console.log('[Recorder] Available audio devices:', audioDevices.map(d => `${d.label} (${d.deviceId})`))

      // 2. Ensure we have a stream (prefer physical mic if BlackHole is default)
      let stream = streamRef.current
      if (!stream || !stream.active) {
        console.log('[Recorder] Getting fresh stream...')
        
        // Try to find a non-virtual mic if possible
        const preferredMic = audioDevices.find(d => 
          d.label.toLowerCase().includes('microphone') || 
          d.label.toLowerCase().includes('built-in')
        )
        
        const constraints: MediaStreamConstraints = { 
          audio: preferredMic 
            ? { deviceId: { exact: preferredMic.deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        }
        
        console.log('[Recorder] Using constraints:', constraints)
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        setMicStream(stream)
      }

      // Explicitly enable all audio tracks
      stream.getAudioTracks().forEach(track => {
        console.log(`[Recorder] Track: ${track.label}, Enabled: ${track.enabled}, State: ${track.readyState}`)
        track.enabled = true
      })

      // 2. Ensure AudioContext is alive and connected to destination (sink)
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') await ctx.resume()

      // Re-connect visualizer if needed
      const src = ctx.createMediaStreamSource(stream)
      
      // Zero-gain "sink" to keep context/stream alive in some browsers
      const sink = ctx.createGain()
      sink.gain.value = 0
      src.connect(sink)
      sink.connect(ctx.destination)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      src.connect(analyser)
      analyserRef.current = analyser

      const mime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ].find((t) => {
        try { return MediaRecorder.isTypeSupported(t) } catch { return false }
      }) ?? ''
      
      console.log(`[Recorder] Using MIME type: ${mime}`)
      const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 })
      mrRef.current = mr
      chunksRef.current = []
      
      mr.ondataavailable = (e) => { 
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime })
        console.log(`[Recorder] Finalized. Size: ${Math.round(blob.size / 1024)}KB, Type: ${mime}, Chunks: ${chunksRef.current.length}`)
        
        if (blob.size < 100) {
          console.warn('[Recorder] Blob is suspiciously small! Recording may be silent.')
        }

        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        
        // Stop stream tracks only after a slight delay to ensure cleanup doesn't clip the end
        setTimeout(() => {
          stream?.getTracks().forEach((t) => {
            console.log(`[Recorder] Stopping track: ${t.label}`)
            t.stop()
          })
          streamRef.current = null
          setMicStream(null)
          if (audioCtxRef.current?.state !== 'closed') {
            audioCtxRef.current?.close()
          }
        }, 300)

        cancelAnimationFrame(animRef.current)
        setWaveform(Array(50).fill(0.05))
        setStep('review')
      }

      // 4. Start recording immediately
      mr.start(250) // Use timeslices to ensure data flows
      setIsRecording(true)
      setIsPaused(false)
      setStep('recording')
      setSecondsLeft(MAX_SECONDS)
      setSecondsRecorded(0)

      let elapsed = 0
      timerRef.current = setInterval(() => {
        if (!isPaused) {
          elapsed++
          setSecondsRecorded(elapsed)
          setSecondsLeft(MAX_SECONDS - elapsed)
          if (elapsed >= MAX_SECONDS) stopRecording()
        }
      }, 1000)

    } catch (err: any) {
      console.error('[Recorder] Failed to start:', err)
      setErrorMsg('Recording failed to start. Please check your microphone permissions.')
    }
  }, [isPaused, stopRecording])

  function resetRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null); setAudioUrl(null)
    setSecondsRecorded(0); setSecondsLeft(MAX_SECONDS)
    setWaveform(Array(50).fill(0.05))
    setIsPaused(false)
    setStep('intro')
  }

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } })
      camStreamRef.current = stream
      setShowCamera(true)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      }, 150)
    } catch { setErrorMsg('Camera access denied — you can still submit without a photo.') }
  }

  const takeSelfie = () => {
    if (!videoRef.current) return
    const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(videoRef.current, (videoRef.current.videoWidth - size) / 2, (videoRef.current.videoHeight - size) / 2, size, size, 0, 0, size, size)
    setSelfieDataUrl(canvas.toDataURL('image/jpeg', 0.85))
    setShowCamera(false)
    camStreamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const handleSubmit = async () => {
    if (!audioBlob || !name.trim()) { setErrorMsg('Please enter your name.'); return }
    setIsSubmitting(true); setErrorMsg(null)
    try {
      const [audioPublicUrl, selfiePublicUrl] = await Promise.all([
        uploadAudio(audioBlob),
        selfieDataUrl ? uploadSelfie(selfieDataUrl) : Promise.resolve(null),
      ])
      await saveRecording({ name: name.trim(), audio_url: audioPublicUrl, selfie_url: selfiePublicUrl, duration: secondsRecorded })
      setStep('success')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Submission failed. Please try again.')
    } finally { setIsSubmitting(false) }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative"
      style={{ background: '#080600' }}
    >
      {/* ─── Hero background image ──────────────────────────────────── */}
      <HeroBg step={step} />
      <GoldField />

      {/* ─── Logo header ─────────────────────────────────────────────── */}
      <motion.div
        className="relative z-10 flex flex-col items-center mb-7"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div
          style={{
            width: 68, height: 68, borderRadius: 18,
            background: 'linear-gradient(145deg, #1e1500, #2d2000)',
            border: '1px solid rgba(201,168,76,0.45)',
            boxShadow: '0 0 32px rgba(201,168,76,0.2), inset 0 1px 0 rgba(201,168,76,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ color: '#c9a84c', fontSize: 34, fontWeight: 900, fontFamily: 'Georgia, serif', textShadow: '0 0 20px rgba(201,168,76,0.7)' }}>
            N
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.35em] uppercase font-semibold" style={{ color: 'rgba(201,168,76,0.6)' }}>
          Noblesville Schools
        </p>
      </motion.div>

      {/* ─── Steps ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ═══ INTRO ═══ */}
        {step === 'intro' && (
          <CardWrap key="intro">
            <div className="p-8">
              {/* Hero headline */}
              <motion.div
                className="text-center mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <p className="text-[10px] tracking-[0.4em] uppercase font-bold mb-3" style={{ color: 'rgba(201,168,76,0.55)' }}>
                  Class of 2026
                </p>
                <h1
                  className="font-bold mb-1 leading-none"
                  style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2.2rem, 8vw, 3rem)', background: 'linear-gradient(135deg, #f5e08a, #c9a84c, #9a7030, #c9a84c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '200% auto', animation: 'shimmer 4s linear infinite' }}
                >
                  Legacy Line
                </h1>
                <div style={{ width: 48, height: 2, margin: '14px auto', background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }} />

                {/* Sound wave decoration */}
                <div className="flex justify-center mb-5">
                  <SoundWave large />
                </div>

                <h2
                  className="text-white font-bold text-xl leading-snug mb-3"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  Your voice will carry on<br />
                  <span style={{ color: '#e6c96d', textShadow: '0 0 15px rgba(230,201,109,0.3)' }}>for the class of 2034</span>
                </h2>
                <p className="text-sm leading-relaxed max-w-[90%] mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Today, you walk the same halls as the 5th graders heading to Noblesville Middle School.
                  Leave them a message they&apos;ll remember — your words become part of the{' '}
                  <span style={{ color: 'rgba(201,168,76,0.95)', fontWeight: 600 }}>Miller legacy</span>.
                </p>
              </motion.div>

              {/* Rotating quote */}
              <motion.div
                className="mb-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <QuotePill />
              </motion.div>

              {/* What to say tips */}
              <motion.div
                style={{
                  background: 'rgba(201,168,76,0.05)',
                  border: '1px solid rgba(201,168,76,0.15)',
                  borderRadius: 18,
                  padding: '1rem 1.2rem',
                  marginBottom: '1.5rem',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <p className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: 'rgba(201,168,76,0.7)' }}>
                  What to share
                </p>
                {[
                  { icon: '🎓', text: 'Your best advice for middle school life' },
                  { icon: '⚡', text: 'What made you proud to be a Miller' },
                  { icon: '💡', text: 'What you wish you\'d known in 5th grade' },
                ].map((tip, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3 mb-2 last:mb-0"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                  >
                    <span className="text-base w-6 text-center flex-shrink-0">{tip.icon}</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{tip.text}</span>
                  </motion.div>
                ))}
              </motion.div>

              <motion.p
                className="text-center text-[11px] mb-5"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Up to {MAX_SECONDS} seconds · Audio only · Takes under 1 minute
              </motion.p>

              {errorMsg && (
                <div className="rounded-2xl p-3 mb-4 text-xs text-red-300" style={{ background: 'rgba(200,40,40,0.1)', border: '1px solid rgba(200,40,40,0.25)' }}>
                  {errorMsg}
                </div>
              )}

              <motion.button
                onClick={prepareMic}
                className="w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  color: '#c9a84c',
                  boxShadow: '0 0 30px rgba(201,168,76,0.1)',
                }}
                whileHover={{ scale: 1.02, background: 'linear-gradient(135deg, #1a1a1a, #252525)', borderColor: 'rgba(201,168,76,0.6)' }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.1), transparent)', skewX: '-20deg' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
                <span className="flex items-center justify-center gap-3">
                  <span className="text-lg">🎙</span> Record My Legacy
                </span>
              </motion.button>
            </div>
          </CardWrap>
        )}

        {/* ═══ SETUP ═══ */}
        {step === 'setup' && (
          <CardWrap key="setup">
            <div className="p-8 text-center min-h-[440px] flex flex-col justify-center">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif', color: '#e6c96d' }}>
                  Ready to share?
                </h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Test your levels before your recording begins.
                </p>
              </div>

              {/* Live waveform for feedback */}
              <div
                className="rounded-2xl p-6 mb-8"
                style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)' }}
              >
                <LiveWaveform data={waveform} active={true} />
                <p className="text-[10px] tracking-widest uppercase mt-4" style={{ color: '#c9a84c' }}>
                  Microphone Active
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl p-3 mb-4 text-xs text-red-300" style={{ background: 'rgba(200,40,40,0.1)', border: '1px solid rgba(200,40,40,0.25)' }}>
                  {errorMsg}
                </div>
              )}

              <motion.button
                onClick={startRecording}
                className="w-full py-5 rounded-2xl font-bold text-sm uppercase tracking-widest relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #9a1a1a, #ef4444)',
                  color: 'white',
                  boxShadow: '0 0 30px rgba(239,68,68,0.2)'
                }}
                whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(239,68,68,0.4)' }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="flex items-center justify-center gap-3">
                  <span className="w-4 h-4 rounded-full bg-white animate-pulse" />
                  Start Recording
                </span>
              </motion.button>

              <button
                onClick={() => {
                  streamRef.current?.getTracks().forEach(t => t.stop());
                  setMicStream(null);
                  setStep('intro');
                }}
                className="mt-6 text-xs uppercase tracking-widest font-bold opacity-30 hover:opacity-60 transition-opacity"
                style={{ color: '#c9a84c' }}
              >
                ← Back
              </button>
            </div>
          </CardWrap>
        )}

        {/* ═══ RECORDING ═══ */}
        {step === 'recording' && (
          <CardWrap key="recording">
            <div className="p-8 text-center min-h-[440px] flex flex-col justify-center">
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full"
              >
                {/* Live indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: isPaused ? 'rgba(201,168,76,0.5)' : '#ef4444' }}
                    animate={isPaused ? {} : { opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <span className={`text-[11px] tracking-[0.3em] uppercase font-bold ${isPaused ? 'text-amber-500/60' : 'text-red-400'}`}>
                    {isPaused ? 'Paused' : 'Recording Now'}
                  </span>
                </div>

                {/* Countdown ring */}
                <div className="relative w-36 h-36 mx-auto mb-5 flex items-center justify-center">
                  <CountdownRing seconds={secondsLeft} max={MAX_SECONDS} />
                  <div className="relative z-10 text-center">
                    <p className="text-4xl font-black tabular-nums leading-none" style={{ color: '#e6c96d', fontFamily: 'Georgia, serif', textShadow: '0 0 20px rgba(201,168,76,0.5)' }}>
                      {secondsLeft}
                    </p>
                    <p className="text-[10px] tracking-widest uppercase mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>seconds</p>
                  </div>
                </div>

                {/* Waveform */}
                <div
                  className="rounded-2xl p-4 mb-5"
                  style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}
                >
                  <LiveWaveform data={waveform} active={isRecording && !isPaused} />
                  <p className="text-[10px] tracking-widest uppercase mt-2" style={{ color: 'rgba(201,168,76,0.4)' }}>
                    {isPaused ? 'Recording Paused' : 'Live · Speak naturally'}
                  </p>
                </div>

                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Sharing your vision for the Class of 2034.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={togglePause}
                    className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                    style={{
                      background: 'rgba(201,168,76,0.08)',
                      border: '1px solid rgba(201,168,76,0.2)',
                      color: '#e6c96d'
                    }}
                  >
                    {isPaused ? '▶ Resume' : '‖ Pause'}
                  </button>
                  <motion.button
                    onClick={stopRecording}
                    className="flex-[2] py-4 rounded-2xl font-bold text-xs uppercase tracking-widest"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#fca5a5',
                      boxShadow: '0 0 20px rgba(239,68,68,0.15)',
                    }}
                    whileHover={{ background: 'rgba(239,68,68,0.25)', scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-red-400 inline-block" />
                      Complete
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </CardWrap>
        )}

        {/* ═══ REVIEW ═══ */}
        {step === 'review' && (
          <CardWrap key="review">
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">👂</div>
                <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Georgia, serif', color: '#e6c96d' }}>
                  Hear Your Message
                </h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {secondsRecorded}s recorded — listen before you send it forward
                </p>
              </div>

              {audioUrl && (
                <div
                  className="rounded-2xl p-4 mb-5"
                  style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <SoundWave />
                    <p className="text-[10px] tracking-widest uppercase font-semibold" style={{ color: 'rgba(201,168,76,0.7)' }}>
                      Your Recording
                    </p>
                  </div>
                  <audio
                    src={audioUrl}
                    controls
                    autoPlay
                    onLoadedMetadata={(e) => {
                      const audio = e.currentTarget
                      audio.volume = 1
                      audio.muted = false
                      audio.play().catch(err => {
                        if (err.name !== 'AbortError') console.warn('[Review] Auto-play blocked:', err)
                      })
                    }}
                    className="w-full"
                    style={{ filter: 'invert(1) hue-rotate(180deg) brightness(0.85)' }}
                  />
                  {/* Real-time review visualizer */}
                  <div className="mt-4 flex justify-center opacity-60">
                     <SoundWave active />
                  </div>
                </div>
              )}

              {/* Legacy message */}
              <div
                className="rounded-2xl p-4 mb-5 text-center"
                style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}
              >
                <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  "This message will be preserved and shared with the 5th graders walking these halls for the first time."
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetRecording}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
                >
                  Re‑Record
                </button>
                <motion.button
                  onClick={() => setStep('details')}
                  className="flex-[2] py-3 rounded-2xl text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'linear-gradient(135deg, #9a7030, #c9a84c, #e6c96d)', color: '#0a0a0a', boxShadow: '0 0 24px rgba(201,168,76,0.3)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Send It Forward ✦
                </motion.button>
              </div>
            </div>
          </CardWrap>
        )}

        {/* ═══ DETAILS ═══ */}
        {step === 'details' && (
          <CardWrap key="details">
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">✍️</div>
                <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Georgia, serif', color: '#e6c96d' }}>
                  Sign Your Legacy
                </h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Put your name on a piece of Noblesville history
                </p>
              </div>

              <label className="block mb-1.5 text-[10px] tracking-[0.3em] uppercase font-bold" style={{ color: 'rgba(201,168,76,0.7)' }}>
                Your Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                maxLength={60}
                className="gold-input w-full rounded-xl px-4 py-3 mb-5 text-sm"
              />

              <label className="block mb-2 text-[10px] tracking-[0.3em] uppercase font-bold" style={{ color: 'rgba(201,168,76,0.7)' }}>
                Selfie <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — shows on the Legacy Wall)</span>
              </label>

              <AnimatePresence mode="wait">
                {showCamera ? (
                  <motion.div key="cam" className="mb-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="relative rounded-2xl overflow-hidden mb-3" style={{ aspectRatio: '1', background: '#111' }}>
                      <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-3/4 h-3/4 rounded-full" style={{ border: '2px solid rgba(201,168,76,0.5)' }} />
                      </div>
                    </div>
                    <button onClick={takeSelfie} className="w-full py-3 rounded-2xl text-sm font-bold uppercase tracking-widest" style={{ background: 'linear-gradient(135deg, #9a7030, #c9a84c, #e6c96d)', color: '#0a0a0a' }}>
                      Capture Photo
                    </button>
                  </motion.div>
                ) : selfieDataUrl ? (
                  <motion.div key="preview" className="mb-5 flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="w-24 h-24 rounded-full overflow-hidden" style={{ border: '2px solid rgba(201,168,76,0.5)', boxShadow: '0 0 20px rgba(201,168,76,0.3)' }}>
                      <img src={selfieDataUrl} alt="Your selfie" className="w-full h-full object-cover scale-x-[-1]" />
                    </div>
                    <button onClick={openCamera} className="text-xs underline underline-offset-4" style={{ color: 'rgba(201,168,76,0.6)' }}>Retake photo</button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="opencam"
                    onClick={openCamera}
                    className="w-full mb-5 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'rgba(201,168,76,0.05)', border: '1px dashed rgba(201,168,76,0.3)', color: 'rgba(201,168,76,0.75)' }}
                    whileHover={{ background: 'rgba(201,168,76,0.1)' }}
                  >
                    <span className="text-lg">📸</span> Take a Selfie
                  </motion.button>
                )}
              </AnimatePresence>

              {errorMsg && (
                <div className="rounded-xl p-3 mb-4 text-xs text-red-300" style={{ background: 'rgba(200,40,40,0.1)', border: '1px solid rgba(200,40,40,0.25)' }}>
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
                >
                  Back
                </button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !name.trim()}
                  className="flex-[2] py-3 rounded-2xl text-sm font-bold uppercase tracking-widest disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #9a7030, #c9a84c, #e6c96d)', color: '#0a0a0a', boxShadow: '0 0 24px rgba(201,168,76,0.3)' }}
                  whileHover={!isSubmitting && name.trim() ? { scale: 1.02 } : {}}
                  whileTap={!isSubmitting && name.trim() ? { scale: 0.97 } : {}}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full inline-block"
                      />
                      Preserving…
                    </span>
                  ) : (
                    'Submit Legacy ✦'
                  )}
                </motion.button>
              </div>
            </div>
          </CardWrap>
        )}

        {/* ═══ SUCCESS ═══ */}
        {step === 'success' && (
          <CardWrap key="success">
            <div className="p-10 text-center">
              {/* Animated trophy burst */}
              <motion.div
                className="text-7xl mb-5"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
              >
                🏆
              </motion.div>

              {/* Gold particle burst effect */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[28px]">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      left: '50%', top: '30%',
                      width: 4, height: 4,
                      background: '#c9a84c',
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: (Math.cos((i / 20) * Math.PI * 2) * (80 + Math.random() * 60)),
                      y: (Math.sin((i / 20) * Math.PI * 2) * (80 + Math.random() * 60)),
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{ duration: 1.2, delay: 0.2 + i * 0.03, ease: 'easeOut' }}
                  />
                ))}
              </div>

              <motion.h2
                className="font-bold mb-2 leading-tight"
                style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 6vw, 2rem)', background: 'linear-gradient(135deg, #f5e08a, #c9a84c, #9a7030)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Your Legacy Lives On.
              </motion.h2>

              <motion.p
                className="text-base mb-3"
                style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                Your voice has been preserved as part of the Noblesville Legacy Line.
              </motion.p>
              <motion.p
                className="text-sm mb-6"
                style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.75 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                The 5th graders stepping into Noblesville Middle School will hear your voice, carry your words, and build on the foundation you leave behind.
              </motion.p>

              <motion.div
                className="rounded-2xl p-5 mb-6"
                style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.72 }}
              >
                <div className="flex justify-center mb-3">
                  <SoundWave large active />
                </div>
                <p className="text-sm font-bold" style={{ color: '#e6c96d', fontFamily: 'Georgia, serif' }}>
                  Once a Miller, Always a Miller.
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Go Millers! 🖤🏆</p>
              </motion.div>

              <motion.a
                href="/"
                className="block py-4 rounded-2xl text-sm font-bold uppercase tracking-widest text-center"
                style={{ background: 'linear-gradient(135deg, #9a7030, #c9a84c, #e6c96d)', color: '#0a0a0a', boxShadow: '0 0 30px rgba(201,168,76,0.35)' }}
                whileHover={{ scale: 1.02 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.82 }}
              >
                View the Legacy Wall ✦
              </motion.a>
            </div>
          </CardWrap>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.p
        className="relative z-10 mt-8 text-[11px] text-center"
        style={{ color: 'rgba(255,255,255,0.18)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        Noblesville Schools · Class of 2026 · Legacy Line
      </motion.p>
    </div>
  )
}

// ─── Shared glass card wrapper ───────────────────────────────────────
function CardWrap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative z-10 w-full max-w-md mx-auto ${className}`}
      style={{
        background: 'rgba(8,6,0,0.7)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(201,168,76,0.18)',
        borderRadius: '28px',
        overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 130, damping: 22 }}
    >
      {/* Top gold shimmer line */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.6) 50%, transparent 100%)',
        }}
      />
      {children}
    </motion.div>
  )
}
