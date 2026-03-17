'use client'

import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Recording } from '@/lib/types'

// ——— Generate N-shape positions ———
function generateNPositions(count: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []

  const leftX = -1.5
  const rightX = 1.5
  const topY = 2.4
  const bottomY = -2.4
  const height = topY - bottomY
  const diagLen = Math.sqrt((rightX - leftX) ** 2 + height ** 2)

  // Distribute orbs proportionally to stroke length
  const vertLen = height
  const totalLen = 2 * vertLen + diagLen
  const leftCount = Math.round((count * vertLen) / totalLen)
  const rightCount = Math.round((count * vertLen) / totalLen)
  const diagCount = count - leftCount - rightCount

  // Left vertical (bottom to top)
  for (let i = 0; i < leftCount; i++) {
    const t = i / (leftCount - 1)
    positions.push(new THREE.Vector3(leftX, bottomY + t * height, 0))
  }

  // Diagonal (top-left to bottom-right)
  for (let i = 0; i < diagCount; i++) {
    const t = i / (diagCount - 1)
    const x = leftX + t * (rightX - leftX)
    const y = topY + t * (bottomY - topY)
    positions.push(new THREE.Vector3(x, y, 0))
  }

  // Right vertical (bottom to top)
  for (let i = 0; i < rightCount; i++) {
    const t = i / (rightCount - 1)
    positions.push(new THREE.Vector3(rightX, bottomY + t * height, 0))
  }

  return positions
}

// ——— Single recording orb ———
function RecordingOrb({
  position,
  recording,
  index,
  onClick,
  isSelected,
}: {
  position: THREE.Vector3
  recording: Recording | null
  index: number
  onClick: () => void
  isSelected: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const isFilled = recording !== null

  // Selfie texture
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (recording?.selfie_url) {
      const loader = new THREE.TextureLoader()
      loader.load(recording.selfie_url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        setTexture(tex)
      })
    }
  }, [recording?.selfie_url])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()

    // Gentle float
    meshRef.current.position.y = position.y + Math.sin(t * 0.8 + index * 0.4) * 0.04

    // Scale on hover/select
    const targetScale = isSelected ? 1.6 : hovered ? 1.25 : 1
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12)

    // Glow pulse
    if (glowRef.current && isFilled) {
      const pulse = 0.5 + Math.sin(t * 1.5 + index * 0.7) * 0.3
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.25
    }
  })

  const goldColor = new THREE.Color('#c9a84c')
  const dimColor = new THREE.Color('#2a1f00')
  const emissiveColor = new THREE.Color('#c9a84c')

  return (
    <group position={position}>
      {/* Outer glow (filled only) */}
      {isFilled && (
        <mesh ref={glowRef} scale={1.8}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial
            color={goldColor}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          if (!isFilled) return
          e.stopPropagation()
          onClick()
        }}
        onPointerEnter={() => {
          if (isFilled) {
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerLeave={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[0.12, 32, 32]} />
        {texture ? (
          <meshStandardMaterial
            map={texture}
            emissive={emissiveColor}
            emissiveIntensity={isSelected ? 0.8 : hovered ? 0.5 : 0.2}
            roughness={0.3}
            metalness={0.1}
          />
        ) : (
          <meshStandardMaterial
            color={isFilled ? goldColor : dimColor}
            emissive={isFilled ? emissiveColor : new THREE.Color('#1a1000')}
            emissiveIntensity={isFilled ? (isSelected ? 1.5 : hovered ? 0.8 : 0.4) : 0.1}
            roughness={0.2}
            metalness={0.8}
            transparent
            opacity={isFilled ? 1 : 0.25}
          />
        )}
      </mesh>

      {/* Name label on hover */}
      {isFilled && hovered && !isSelected && (
        <Html
          center
          position={[0, 0.22, 0]}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(201,168,76,0.4)',
              borderRadius: '8px',
              padding: '4px 10px',
              color: '#c9a84c',
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.05em',
              backdropFilter: 'blur(8px)',
            }}
          >
            {recording!.name}
          </div>
        </Html>
      )}

      {/* Initial letter for unfilled + filled with no selfie */}
      {isFilled && !texture && (
        <Html center position={[0, 0, 0.13]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              color: '#0a0a0a',
              fontSize: '9px',
              fontWeight: '900',
              fontFamily: 'Georgia, serif',
              userSelect: 'none',
            }}
          >
            {recording!.name.charAt(0).toUpperCase()}
          </div>
        </Html>
      )}
    </group>
  )
}

// ——— Ambient gold particles ———
function GoldParticles({ count = 200 }: { count?: number }) {
  const points = useRef<THREE.Points>(null)

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8
      spd[i] = 0.05 + Math.random() * 0.15
    }
    return { positions: pos, speeds: spd }
  }, [count])

  useFrame((state) => {
    if (!points.current) return
    const posArray = (points.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += speeds[i] * 0.02
      if (posArray[i * 3 + 1] > 5) posArray[i * 3 + 1] = -5
    }
    ;(points.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    points.current.rotation.y = state.clock.getElapsedTime() * 0.015
  })

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  return (
    <points ref={points} geometry={geo}>
      <pointsMaterial
        color="#c9a84c"
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}

// ——— Scene ———
function Scene({
  recordings,
  onSelect,
  selectedId,
}: {
  recordings: Recording[]
  onSelect: (r: Recording | null) => void
  selectedId: string | null
}) {
  const SLOT_COUNT = 50
  const positions = useMemo(() => generateNPositions(SLOT_COUNT), [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 4, 3]} intensity={2} color="#e6c96d" />
      <pointLight position={[-3, -2, 2]} intensity={0.8} color="#c9a84c" />
      <pointLight position={[3, 2, -2]} intensity={0.5} color="#a07832" />

      {/* Background particles */}
      <GoldParticles count={300} />

      {/* N formation orbs */}
      {positions.map((pos, i) => {
        const recording = recordings[i] ?? null
        return (
          <RecordingOrb
            key={i}
            index={i}
            position={pos}
            recording={recording}
            isSelected={recording?.id === selectedId}
            onClick={() => onSelect(recording)}
          />
        )
      })}

      {/* Center glow sphere (very subtle) */}
      <mesh position={[0, 0, -1]}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#c9a84c" transparent opacity={0.015} />
      </mesh>

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={11}
        autoRotate
        autoRotateSpeed={0.4}
        maxPolarAngle={Math.PI * 0.75}
        minPolarAngle={Math.PI * 0.2}
      />
    </>
  )
}

// ——— Audio player modal overlay ———
function RecordingModal({
  recording,
  onClose,
}: {
  recording: Recording
  onClose: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) audioRef.current.play().catch(() => {})
    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(20,14,0,0.95)',
          border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '24px',
          padding: '2rem',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(201,168,76,0.2)',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            overflow: 'hidden',
            border: '2px solid rgba(201,168,76,0.5)',
            background: 'linear-gradient(135deg, #2a1f00, #c9a84c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(201,168,76,0.4)',
          }}
        >
          {recording.selfie_url ? (
            <img
              src={recording.selfie_url}
              alt={recording.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                color: '#0a0a0a',
                fontSize: '2rem',
                fontWeight: '900',
                fontFamily: 'Georgia, serif',
              }}
            >
              {recording.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <p
          style={{
            color: 'rgba(201,168,76,0.6)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Noblesville Senior
        </p>
        <h3
          style={{
            color: '#e6c96d',
            fontSize: '1.4rem',
            fontWeight: '700',
            fontFamily: 'Georgia, serif',
            marginBottom: '6px',
          }}
        >
          {recording.name}
        </h3>
        {recording.duration && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '1.5rem' }}>
            {recording.duration}s message
          </p>
        )}

        {/* Audio */}
        <div
          style={{
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: '16px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <audio
            ref={audioRef}
            src={recording.audio_url}
            controls
            style={{ width: '100%', filter: 'invert(1) hue-rotate(180deg) brightness(0.9)' }}
          />
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            color: 'rgba(255,255,255,0.5)',
            padding: '10px 24px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            letterSpacing: '0.05em',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ——— Main export ———
export default function NFormation({ recordings }: { recordings: Recording[] }) {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)

  const handleSelect = useCallback((r: Recording | null) => {
    setSelectedRecording(r)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <Scene
          recordings={recordings}
          onSelect={handleSelect}
          selectedId={selectedRecording?.id ?? null}
        />
      </Canvas>

      {selectedRecording && (
        <RecordingModal recording={selectedRecording} onClose={() => setSelectedRecording(null)} />
      )}
    </div>
  )
}
