'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadAudio, uploadSelfie, saveRecording } from '@/lib/supabase'

type Step = 'intro' | 'recording' | 'review' | 'details' | 'success'

const MAX_SECONDS = 20

// ——— Floating gold particle for background ———
function FloatingParticle({ delay, x, size }: { delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        bottom: '-10px',
        width: size,
        height: size,
        background: `radial-gradient(circle, rgba(201,168,76,0.6) 0%, rgba(201,168,76,0) 70%)`,
      }}
      animate={{
        y: [0, -900],
        opacity: [0, 0.6, 0.6, 0],
        scale: [0.5, 1, 0.8, 0.4],
      }}
      transition={{
        duration: 12 + delay * 3,
        delay: delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

// ——— Waveform visualizer ———
function Waveform({ data, isRecording }: { data: number[]; isRecording: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-16 w-full">
      {data.map((val, i) => (
        <motion.div
          key={i}
          className="rounded-full flex-shrink-0"
          style={{
            width: '4px',
            background: isRecording
              ? `rgba(201, 168, 76, ${0.3 + val * 0.7})`
              : 'rgba(201, 168, 76, 0.2)',
          }}
          animate={{
            height: isRecording ? `${Math.max(8, val * 60)}px` : '8px',
            opacity: isRecording ? 0.4 + val * 0.6 : 0.2,
          }}
          transition={{ duration: 0.05, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ——— Circular countdown timer ———
function CountdownRing({ seconds, max }: { seconds: number; max: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = seconds / max
  const strokeDash = circumference * progress

  return (
    <svg width="130" height="130" className="absolute inset-0 m-auto" style={{ transform: 'rotate(-90deg)' }}>
      {/* Track */}
      <circle
        cx="65" cy="65" r={radius}
        fill="none"
        stroke="rgba(201,168,76,0.1)"
        strokeWidth="3"
      />
      {/* Progress */}
      <motion.circle
        cx="65" cy="65" r={radius}
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - strokeDash}
        animate={{ strokeDashoffset: circumference - strokeDash }}
        transition={{ duration: 0.5, ease: 'linear' }}
      />
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a07832" />
          <stop offset="50%" stopColor="#e6c96d" />
          <stop offset="100%" stopColor="#a07832" />
        </linearGradient>
      </defs>
    </svg>
  )
}

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
  const [waveformData, setWaveformData] = useState<number[]>(Array(50).fill(0.05))
  const [showCamera, setShowCamera] = useState(false)
  const [micPermission, setMicPermission] = useState<'idle' | 'granted' | 'denied'>('idle')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  function cleanup() {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (audioCtxRef.current) audioCtxRef.current.close()
    if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((t) => t.stop())
  }

  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      setMicPermission('granted')

      // Audio analyser for waveform
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser

      const drawWave = () => {
        if (!analyserRef.current) return
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const normalized = Array.from(data.slice(0, 50)).map((v) => v / 255)
        setWaveformData(normalized)
        animFrameRef.current = requestAnimationFrame(drawWave)
      }
      drawWave()

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
        cancelAnimationFrame(animFrameRef.current)
        setWaveformData(Array(50).fill(0.05))
        setStep('review')
      }

      mr.start(100)
      setIsRecording(true)
      setStep('recording')
      setSecondsLeft(MAX_SECONDS)
      setSecondsRecorded(0)

      let elapsed = 0
      timerRef.current = setInterval(() => {
        elapsed += 1
        setSecondsRecorded(elapsed)
        setSecondsLeft(MAX_SECONDS - elapsed)
        if (elapsed >= MAX_SECONDS) stopRecording()
      }, 1000)
    } catch (err: any) {
      setMicPermission('denied')
      setErrorMsg(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone access in your browser settings and try again.'
          : 'Could not start recording. Please check your microphone and try again.'
      )
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setSecondsRecorded(0)
    setSecondsLeft(MAX_SECONDS)
    setWaveformData(Array(50).fill(0.05))
    setStep('intro')
  }

  const proceedToDetails = () => {
    if (!audioBlob) return
    setStep('details')
  }

  const openCamera = async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 640 },
      })
      cameraStreamRef.current = stream
      setShowCamera(true)
      // Give the video element a tick to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 150)
    } catch {
      setErrorMsg('Camera access denied. You can still submit without a photo.')
    }
  }

  const takeSelfie = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Center-crop square
    const offsetX = (videoRef.current.videoWidth - size) / 2
    const offsetY = (videoRef.current.videoHeight - size) / 2
    ctx.drawImage(videoRef.current, offsetX, offsetY, size, size, 0, 0, size, size)
    setSelfieDataUrl(canvas.toDataURL('image/jpeg', 0.85))
    setShowCamera(false)
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const handleSubmit = async () => {
    if (!audioBlob || !name.trim()) {
      setErrorMsg('Please enter your name before submitting.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const [audioPublicUrl, selfiePublicUrl] = await Promise.all([
        uploadAudio(audioBlob),
        selfieDataUrl ? uploadSelfie(selfieDataUrl) : Promise.resolve(null),
      ])

      await saveRecording({
        name: name.trim(),
        audio_url: audioPublicUrl,
        selfie_url: selfiePublicUrl,
        duration: secondsRecorded,
      })

      setStep('success')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ——————————————————————————————————————————————————————
  // RENDER
  // ——————————————————————————————————————————————————————

  return (
    <div className="page-bg min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <FloatingParticle key={i} delay={i * 1.5} x={10 + i * 11} size={i % 3 === 0 ? 3 : 2} />
        ))}
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Logo header */}
      <motion.div
        className="relative z-10 flex flex-col items-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* School N emblem */}
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center mb-3 gold-glow"
          style={{
            background: 'linear-gradient(135deg, #1a1200, #2a1f00)',
            border: '1px solid rgba(201,168,76,0.4)',
          }}
        >
          <span
            className="font-display font-black text-3xl"
            style={{
              color: '#c9a84c',
              textShadow: '0 0 20px rgba(201,168,76,0.6)',
              fontFamily: 'Georgia, serif',
            }}
          >
            N
          </span>
        </div>
        <p className="text-xs tracking-[0.3em] uppercase text-miller-gold opacity-70 font-medium">
          Noblesville Schools
        </p>
      </motion.div>

      {/* Main card */}
      <AnimatePresence mode="wait">
        {/* ——— INTRO ——— */}
        {step === 'intro' && (
          <motion.div
            key="intro"
            className="relative z-10 glass rounded-3xl p-8 max-w-md w-full text-center"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1
                className="font-display font-bold text-4xl mb-1 gold-text-animated"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Legacy Line
              </h1>
              <div
                className="w-16 h-0.5 mx-auto mb-5"
                style={{ background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }}
              />
            </motion.div>

            <motion.p
              className="text-white/70 text-sm leading-relaxed mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              Welcome, Noblesville Senior!
            </motion.p>
            <motion.p
              className="text-white/90 text-base leading-relaxed mb-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              You're about to record a message that will inspire the 5th graders heading into Noblesville Middle School — the next generation of Millers.
            </motion.p>

            <motion.div
              className="glass-gold rounded-2xl p-4 mb-6 text-left space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              <p className="text-miller-gold text-xs font-semibold tracking-widest uppercase mb-3">
                What to share
              </p>
              {[
                'Your best advice for middle school life',
                'What made you proud as a Miller',
                'Something you wish you had known in 5th grade',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-miller-gold text-xs mt-0.5">✦</span>
                  <span className="text-white/80 text-sm">{tip}</span>
                </div>
              ))}
            </motion.div>

            <motion.p
              className="text-white/40 text-xs mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
            >
              Up to {MAX_SECONDS} seconds · Audio only · Takes 1 minute
            </motion.p>

            {errorMsg && (
              <motion.div
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-300 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {errorMsg}
              </motion.div>
            )}

            <motion.button
              onClick={startRecording}
              className="btn-gold w-full py-4 rounded-2xl text-base uppercase tracking-widest font-bold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Begin Recording
            </motion.button>
          </motion.div>
        )}

        {/* ——— RECORDING ——— */}
        {step === 'recording' && (
          <motion.div
            key="recording"
            className="relative z-10 glass rounded-3xl p-8 max-w-md w-full text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-miller-gold text-xs tracking-widest uppercase font-semibold mb-6">
              Recording
            </p>

            {/* Timer ring + stop button */}
            <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
              <CountdownRing seconds={secondsLeft} max={MAX_SECONDS} />
              <button
                onClick={stopRecording}
                className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center record-pulse transition-transform hover:scale-105 active:scale-95"
                style={{ background: 'rgba(220, 38, 38, 0.9)' }}
              >
                <div className="w-7 h-7 bg-white rounded-md" />
              </button>
            </div>

            <p className="text-3xl font-bold mb-1 tabular-nums" style={{ color: '#e6c96d' }}>
              {secondsLeft}s
            </p>
            <p className="text-white/40 text-xs mb-6">remaining — tap the square to stop</p>

            {/* Live waveform */}
            <div className="glass-dark rounded-2xl p-4">
              <Waveform data={waveformData} isRecording={isRecording} />
            </div>
          </motion.div>
        )}

        {/* ——— REVIEW ——— */}
        {step === 'review' && (
          <motion.div
            key="review"
            className="relative z-10 glass rounded-3xl p-8 max-w-md w-full text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="font-display text-2xl font-bold gold-text mb-1"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Review Your Message
            </h2>
            <p className="text-white/50 text-sm mb-6">
              {secondsRecorded}s recorded — listen back before you submit
            </p>

            {/* Audio player */}
            {audioUrl && (
              <div className="glass-gold rounded-2xl p-4 mb-6">
                <p className="text-miller-gold text-xs tracking-widest uppercase mb-3 font-semibold">
                  Your Recording
                </p>
                <audio
                  src={audioUrl}
                  controls
                  className="w-full"
                  style={{
                    filter: 'invert(1) hue-rotate(180deg) brightness(0.9)',
                  }}
                />
              </div>
            )}

            {/* Waveform static preview */}
            <div className="flex gap-3">
              <button
                onClick={resetRecording}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)')}
              >
                Re‑Record
              </button>
              <motion.button
                onClick={proceedToDetails}
                className="flex-[2] btn-gold py-3 rounded-2xl text-sm uppercase tracking-widest font-bold"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Looks Great ✦
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ——— DETAILS ——— */}
        {step === 'details' && (
          <motion.div
            key="details"
            className="relative z-10 glass rounded-3xl p-8 max-w-md w-full"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="font-display text-2xl font-bold gold-text text-center mb-1"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Sign Your Legacy
            </h2>
            <p className="text-white/50 text-sm text-center mb-6">
              Add your name — and an optional selfie — to your message
            </p>

            {/* Name */}
            <label className="block mb-1 text-miller-gold text-xs tracking-widest uppercase font-semibold">
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

            {/* Selfie */}
            <label className="block mb-2 text-miller-gold text-xs tracking-widest uppercase font-semibold">
              Selfie <span className="text-white/30 normal-case font-normal">(optional)</span>
            </label>

            <AnimatePresence mode="wait">
              {showCamera ? (
                <motion.div
                  key="cam"
                  className="mb-5"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className="relative rounded-2xl overflow-hidden mb-3"
                    style={{ aspectRatio: '1', background: '#111' }}
                  >
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    {/* Viewfinder overlay */}
                    <div
                      className="absolute inset-4 rounded-full pointer-events-none"
                      style={{ border: '2px solid rgba(201,168,76,0.5)' }}
                    />
                  </div>
                  <button
                    onClick={takeSelfie}
                    className="btn-gold w-full py-3 rounded-2xl text-sm uppercase tracking-widest font-bold"
                  >
                    Capture Photo
                  </button>
                </motion.div>
              ) : selfieDataUrl ? (
                <motion.div
                  key="preview"
                  className="mb-5 flex flex-col items-center gap-3"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div
                    className="w-24 h-24 rounded-full overflow-hidden gold-glow"
                    style={{ border: '2px solid rgba(201,168,76,0.5)' }}
                  >
                    <img
                      src={selfieDataUrl}
                      alt="Your selfie"
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  </div>
                  <button
                    onClick={openCamera}
                    className="text-miller-gold text-xs underline underline-offset-4"
                  >
                    Retake photo
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="open-cam"
                  onClick={openCamera}
                  className="w-full mb-5 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: 'rgba(201,168,76,0.06)',
                    border: '1px dashed rgba(201,168,76,0.3)',
                    color: 'rgba(201,168,76,0.8)',
                  }}
                  whileHover={{ background: 'rgba(201,168,76,0.1)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="text-lg">📸</span> Take a Selfie
                </motion.button>
              )}
            </AnimatePresence>

            {errorMsg && (
              <motion.div
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-300 text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {errorMsg}
              </motion.div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('review')}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                Back
              </button>
              <motion.button
                onClick={handleSubmit}
                disabled={isSubmitting || !name.trim()}
                className="flex-[2] btn-gold py-3 rounded-2xl text-sm uppercase tracking-widest font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                whileHover={!isSubmitting && name.trim() ? { scale: 1.02 } : {}}
                whileTap={!isSubmitting && name.trim() ? { scale: 0.97 } : {}}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                    />
                    Submitting…
                  </span>
                ) : (
                  'Submit Legacy ✦'
                )}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ——— SUCCESS ——— */}
        {step === 'success' && (
          <motion.div
            key="success"
            className="relative z-10 glass rounded-3xl p-10 max-w-md w-full text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 120 }}
          >
            {/* Gold burst */}
            <motion.div
              className="text-6xl mb-5"
              animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              🏆
            </motion.div>

            <motion.h2
              className="font-display text-3xl font-bold gold-text-animated mb-3"
              style={{ fontFamily: 'Georgia, serif' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Legacy Recorded!
            </motion.h2>

            <motion.p
              className="text-white/70 text-sm leading-relaxed mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              Your message is now part of the Noblesville Legacy Line.
            </motion.p>
            <motion.p
              className="text-white/50 text-sm leading-relaxed mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
            >
              The 5th graders heading to Noblesville Middle School will hear your voice and carry your wisdom forward.
            </motion.p>

            <motion.div
              className="glass-gold rounded-2xl p-4 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="text-miller-gold text-xs tracking-widest uppercase font-semibold mb-1">
                Once a Miller
              </p>
              <p className="text-white/80 text-sm">Always a Miller. Go Millers! 🖤🏆</p>
            </motion.div>

            <motion.a
              href="/"
              className="block btn-gold py-3 rounded-2xl text-sm uppercase tracking-widest font-bold text-center"
              whileHover={{ scale: 1.02 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              View the Legacy Wall
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.p
        className="relative z-10 mt-8 text-white/20 text-xs text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Noblesville Schools · Class of 2025 · Legacy Line
      </motion.p>
    </div>
  )
}
