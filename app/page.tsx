'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getRecordings } from '@/lib/supabase'
import type { Recording } from '@/lib/types'

// Three.js scene — client only, no SSR
const NFormation = dynamic(() => import('@/components/NFormation'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center gold-glow"
          style={{
            background: 'linear-gradient(135deg, #1a1200, #2a1f00)',
            border: '1px solid rgba(201,168,76,0.4)',
          }}
        >
          <span className="text-4xl font-black" style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}>
            N
          </span>
        </div>
        <p className="text-miller-gold/60 text-xs tracking-widest uppercase">Loading Legacy Line…</p>
      </motion.div>
    </div>
  ),
})

// ——— Header bar ———
function Header({ count }: { count: number }) {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
        // Safe area for iPhone notch / Dynamic Island
        paddingTop: 'max(env(safe-area-inset-top), 10px)',
        paddingLeft: 'max(env(safe-area-inset-left), 16px)',
        paddingRight: 'max(env(safe-area-inset-right), 16px)',
        paddingBottom: '10px',
      }}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Left: Logo + title */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #1a1200, #2a1f00)',
            border: '1px solid rgba(201,168,76,0.35)',
            boxShadow: '0 0 10px rgba(201,168,76,0.2)',
          }}
        >
          <span className="text-sm font-black" style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}>
            N
          </span>
        </div>
        <div>
          <p className="text-sm font-bold gold-text-animated leading-none" style={{ fontFamily: 'Georgia, serif' }}>
            Legacy Line
          </p>
          <p className="text-white/30 text-[9px] tracking-widest uppercase leading-none mt-0.5">
            Noblesville Schools
          </p>
        </div>
      </div>

      {/* Right: count badge (compact on mobile) */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
        style={{
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.25)',
          color: '#c9a84c',
          fontSize: '11px',
          fontWeight: '600',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: '#c9a84c', boxShadow: '0 0 5px #c9a84c' }}
        />
        <span>
          {count} {count === 1 ? 'Legacy' : 'Legacies'}
        </span>
      </div>
    </motion.header>
  )
}

// ——— Instruction toast (first visit) ———
function InstructionToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      className="fixed z-40 left-1/2"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)',
        transform: 'translateX(-50%)',
        maxWidth: '290px',
        width: '85%',
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="rounded-2xl px-4 py-3 text-center"
        style={{
          background: 'rgba(10,8,0,0.92)',
          border: '1px solid rgba(201,168,76,0.28)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <p className="text-white/70 text-xs leading-relaxed">
          <span className="font-semibold" style={{ color: '#c9a84c' }}>Tap a glowing orb</span>{' '}
          to hear a senior's legacy.
          <br />
          <span className="text-white/40">Drag to spin · Pinch to zoom</span>
        </p>
      </div>
    </motion.div>
  )
}

// ——— Empty state ———
function EmptyState() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-8">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
          style={{
            background: 'rgba(201,168,76,0.06)',
            border: '1px solid rgba(201,168,76,0.2)',
          }}
        >
          <span className="text-4xl font-black gold-text" style={{ fontFamily: 'Georgia, serif' }}>
            N
          </span>
        </div>
        <h2 className="text-xl font-bold gold-text mb-3" style={{ fontFamily: 'Georgia, serif' }}>
          Legacy Line
        </h2>
        <p className="text-white/40 text-sm leading-relaxed max-w-[260px] mx-auto mb-6">
          No messages yet. Be the first to leave your legacy for the Class of 2034.
        </p>
      </motion.div>
    </div>
  )
}

// ——— Floating Record CTA ———
function RecordButton() {
  return (
    <motion.a
      href="/record"
      className="fixed left-1/2 z-50 flex items-center gap-2 font-bold uppercase tracking-widest"
      style={{
        bottom: 'max(env(safe-area-inset-bottom, 0px) + 24px, 28px)',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #9a7030, #c9a84c, #e6c96d, #c9a84c, #9a7030)',
        backgroundSize: '200% auto',
        animation: 'shimmer 4s linear infinite',
        color: '#0a0a0a',
        padding: '14px 28px',
        borderRadius: '100px',
        fontSize: '13px',
        boxShadow: '0 0 32px rgba(201,168,76,0.45), 0 4px 24px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap',
        WebkitTapHighlightColor: 'transparent',
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.5, type: 'spring', stiffness: 130, damping: 20 }}
      whileTap={{ scale: 0.95 }}
    >
      <span style={{ fontSize: '16px' }}>🎙</span>
      Record Your Legacy
    </motion.a>
  )
}

// ——— Main page ———
export default function WallPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showToast, setShowToast] = useState(true)
  const [showHero, setShowHero] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getRecordings()
        setRecordings(data)
      } catch (e: any) {
        setError('Could not load recordings. Check your connection.')
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onMove = () => setShowHero(false)
    window.addEventListener('pointerdown', onMove)
    return () => window.removeEventListener('pointerdown', onMove)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#0a0a0a' }}>
      <Header count={recordings.length} />

      {/* Full-screen Three.js canvas — starts below the header */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          paddingTop: 'max(env(safe-area-inset-top, 0px) + 56px, 60px)',
          // Leave room at bottom for the record button
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 80px, 88px)',
        }}
      >
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <motion.div
              className="flex flex-col items-center gap-4"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1a1200, #2a1f00)',
                  border: '1px solid rgba(201,168,76,0.4)',
                  boxShadow: '0 0 30px rgba(201,168,76,0.2)',
                }}
              >
                <span className="text-4xl font-black" style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}>
                  N
                </span>
              </div>
              <p className="text-miller-gold/50 text-xs tracking-widest uppercase">Loading Legacy Line…</p>
            </motion.div>
          </div>
        ) : (
          <NFormation recordings={recordings} />
        )}
      </div>

      {/* Empty state */}
      {!isLoading && recordings.length === 0 && !error && <EmptyState />}

      {/* Error */}
      {error && (
        <motion.div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className="px-5 py-3 rounded-2xl text-sm text-center"
            style={{
              background: 'rgba(180,30,30,0.15)',
              border: '1px solid rgba(180,30,30,0.3)',
              color: 'rgba(255,150,150,0.9)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {error}
          </div>
        </motion.div>
      )}

      {/* Instruction toast */}
      <AnimatePresence>
        {showToast && !isLoading && recordings.length > 0 && (
          <InstructionToast onDismiss={() => setShowToast(false)} />
        )}
      </AnimatePresence>

      {/* Subtle class label — fades on first touch */}
      <AnimatePresence>
        {showHero && !isLoading && (
          <motion.div
            className="fixed inset-x-0 z-30 flex flex-col items-center pointer-events-none"
            style={{ bottom: 'max(env(safe-area-inset-bottom, 0px) + 92px, 100px)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="w-px h-10 mb-3"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.35))' }}
            />
            <p className="text-white/25 text-[10px] tracking-[0.3em] uppercase">
              Noblesville Seniors · Class of 2026
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating record button */}
      <RecordButton />

      {/* Bottom fade */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 'max(env(safe-area-inset-bottom, 0px) + 80px, 88px)',
          background: 'linear-gradient(to top, rgba(10,10,10,0.9), transparent)',
          zIndex: 40,
        }}
      />

      {/* Top fade (below header) */}
      <div
        className="fixed left-0 right-0 h-16 pointer-events-none"
        style={{
          top: 'max(env(safe-area-inset-top, 0px) + 56px, 60px)',
          background: 'linear-gradient(to bottom, rgba(10,10,10,0.5), transparent)',
          zIndex: 3,
        }}
      />
    </div>
  )
}
