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
        background: 'rgba(10, 10, 10, 0.4)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
        // Safe area for iPhone notch / Dynamic Island
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
        paddingLeft: 'max(env(safe-area-inset-left), 24px)',
        paddingRight: 'max(env(safe-area-inset-right), 24px)',
        paddingBottom: '12px',
      }}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }}
      />
      
      {/* Left: Logo + title */}
      <div className="flex items-center gap-4 group cursor-default">
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e1500, #2d2000)',
            border: '1px solid rgba(201, 168, 76, 0.4)',
          }}
          whileHover={{ scale: 1.05, borderColor: 'rgba(201, 168, 76, 0.6)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-miller-gold/10 to-transparent" />
          <span className="text-xl font-black relative z-10" style={{ color: '#c9a84c', fontFamily: 'var(--font-crimson-pro), Georgia, serif' }}>
            N
          </span>
        </motion.div>
        <div>
          <h1 className="text-lg font-bold gold-text-animated leading-none tracking-tight" style={{ fontFamily: 'var(--font-crimson-pro), Georgia, serif' }}>
            Legacy Line
          </h1>
          <p className="text-white/40 text-[10px] tracking-[0.25em] uppercase leading-none mt-1" style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 500 }}>
            Noblesville Schools
          </p>
        </div>
      </div>

      {/* Right: count badge (compact on mobile) */}
      <motion.div
        className="flex items-center gap-2 px-4 py-2 rounded-full cursor-default"
        style={{
          background: 'rgba(201, 168, 76, 0.08)',
          border: '1px solid rgba(201, 168, 76, 0.2)',
          backdropFilter: 'blur(8px)',
        }}
        whileHover={{ background: 'rgba(201, 168, 76, 0.12)', borderColor: 'rgba(201, 168, 76, 0.3)' }}
      >
        <div className="relative flex items-center justify-center">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: '#c9a84c', boxShadow: '0 0 10px #c9a84c' }}
          />
          <motion.span
            className="absolute w-2 h-2 rounded-full"
            style={{ background: '#c9a84c' }}
            animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[12px] font-bold tracking-wide" style={{ color: '#c9a84c', fontFamily: 'var(--font-outfit), sans-serif' }}>
          {count} {count === 1 ? 'LEGACY' : 'LEGACIES'}
        </span>
      </motion.div>
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
        maxWidth: '290px',
        width: '85%',
      }}
      initial={{ opacity: 0, y: 16, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 10, x: '-50%' }}
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
