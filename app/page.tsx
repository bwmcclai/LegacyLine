'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'
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
          <span
            className="text-4xl font-black"
            style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}
          >
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
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: 'rgba(10,10,10,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
      }}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Left: Logo + title */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #1a1200, #2a1f00)',
            border: '1px solid rgba(201,168,76,0.35)',
            boxShadow: '0 0 12px rgba(201,168,76,0.2)',
          }}
        >
          <span
            className="text-base font-black"
            style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}
          >
            N
          </span>
        </div>
        <div>
          <p
            className="text-sm font-bold gold-text-animated leading-none"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Legacy Line
          </p>
          <p className="text-white/30 text-[10px] tracking-widest uppercase leading-none mt-0.5">
            Noblesville Schools
          </p>
        </div>
      </div>

      {/* Right: count badge */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.25)',
          color: '#c9a84c',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#c9a84c', boxShadow: '0 0 6px #c9a84c' }}
        />
        {count} {count === 1 ? 'Miller Legacy' : 'Miller Legacies'} Recorded
      </div>
    </motion.header>
  )
}

// ——— Instruction overlay (first visit) ———
function InstructionToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      className="fixed bottom-24 left-1/2 z-40"
      style={{ transform: 'translateX(-50%)', maxWidth: '300px', width: '90%' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="rounded-2xl px-5 py-3 text-center"
        style={{
          background: 'rgba(10,8,0,0.9)',
          border: '1px solid rgba(201,168,76,0.25)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <p className="text-white/70 text-xs leading-relaxed">
          <span className="text-miller-gold font-semibold">Tap a glowing orb</span> to hear a senior's message.
          Drag to rotate. Scroll to zoom.
        </p>
      </div>
    </motion.div>
  )
}

// ——— Hero text (shown when no interactions yet) ———
function HeroText({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-30 flex flex-col items-center pb-10"
          style={{ pointerEvents: 'none' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.6 }}
        >
          <div
            className="w-px h-12 mb-4"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.4))' }}
          />
          <p className="text-white/30 text-xs tracking-[0.3em] uppercase">
            Noblesville Seniors · Class of 2026
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ——— Empty state ———
function EmptyState() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
      <motion.div
        className="text-center px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <div
          className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center"
          style={{
            background: 'rgba(201,168,76,0.06)',
            border: '1px solid rgba(201,168,76,0.2)',
          }}
        >
          <span className="text-5xl font-black gold-text" style={{ fontFamily: 'Georgia, serif' }}>
            N
          </span>
        </div>
        <h2
          className="text-2xl font-bold gold-text mb-3"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          Legacy Line
        </h2>
        <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
          No messages yet. Noblesville seniors — scan the recording tag to leave your legacy for the Class of 2030!
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
        setError('Could not load recordings. Check your Supabase connection.')
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    load()

    // Poll for new recordings every 30s
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onMove = () => setShowHero(false)
    window.addEventListener('pointerdown', onMove)
    return () => window.removeEventListener('pointerdown', onMove)
  }, [])

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: '#0a0a0a' }}
    >
      {/* ── Hero image: very subtle, revealed when idle ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: showHero ? 0.13 : 0.06 }}
        transition={{ duration: 2.5, ease: 'easeInOut' }}
      >
        <img
          src="/legacy-hero.jpg"
          alt=""
          className="w-full h-full object-cover object-center"
          style={{ mixBlendMode: 'luminosity' }}
        />
        {/* Heavy vignette — let the 3D scene breathe */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(10,10,10,0.1) 0%, rgba(10,10,10,0.75) 65%, rgba(10,10,10,0.95) 100%)',
          }}
        />
      </motion.div>

      <Header count={recordings.length} />

      {/* Full-screen Three.js canvas */}
      <div className="absolute inset-0 pt-16" style={{ zIndex: 2 }}>
        {!isLoading && (
          <NFormation recordings={recordings} />
        )}

        {isLoading && (
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
                <span
                  className="text-4xl font-black"
                  style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}
                >
                  N
                </span>
              </div>
              <p className="text-miller-gold/50 text-xs tracking-widest uppercase">
                Loading Legacy Line…
              </p>
            </motion.div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!isLoading && recordings.length === 0 && !error && <EmptyState />}

      {/* Error */}
      {error && (
        <motion.div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className="px-5 py-3 rounded-2xl text-sm"
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

      {/* Hero text */}
      <HeroText visible={showHero && !isLoading} />

      {/* Bottom gradient fade */}
      <div
        className="fixed bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(10,10,10,0.8), transparent)',
        }}
      />

      {/* Subtle top gradient */}
      <div
        className="fixed top-16 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(10,10,10,0.6), transparent)',
        }}
      />
    </div>
  )
}
