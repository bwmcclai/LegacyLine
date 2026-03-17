'use client'

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import type { Recording } from '@/lib/types'

// ─── Ring configuration ────────────────────────────────────────────────
// Radii expanded to give the center hero image room to breathe
const RINGS = [
  { maxNodes: 6, radius: 2.8, speed: 0.10, tiltX: 0.28 },
  { maxNodes: 12, radius: 4.1, speed: 0.060, tiltX: -0.32 },
  { maxNodes: 20, radius: 5.4, speed: 0.034, tiltX: 0.18 },
  { maxNodes: 30, radius: 6.8, speed: 0.020, tiltX: -0.22 },
] as const

function assignToRings(recs: Recording[]) {
  const out: { cfg: (typeof RINGS)[number]; items: Recording[] }[] = []
  let rem = [...recs]
  for (const cfg of RINGS) {
    const items = rem.splice(0, cfg.maxNodes)
    out.push({ cfg, items })
    if (!rem.length) break
  }
  return out
}

// ─── Canvas textures ───────────────────────────────────────────────────

/** Circular gold-gradient canvas with an initial letter — used as fallback when no selfie. */
function makeCircularCanvas(initial: string): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!

  // Clip to circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2)
  ctx.clip()

  // Gold radial gradient background
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, '#f0d878')
  g.addColorStop(0.55, '#c9a84c')
  g.addColorStop(1, '#6b4a12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)

  // Dark initial letter
  ctx.fillStyle = 'rgba(0,0,0,0.88)'
  ctx.font = `900 ${Math.floor(S * 0.52)}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initial.toUpperCase(), S / 2, S / 2 + 5)
  ctx.restore()

  // Gold ring border (drawn outside clip so it sits on the edge)
  ctx.strokeStyle = 'rgba(240,216,120,0.85)'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Load a selfie URL into a circular-clipped canvas texture. Falls back to initials. */
function useCircularTexture(selfieUrl: string | null, initial: string): THREE.Texture {
  const [texture, setTexture] = useState<THREE.Texture>(() => makeCircularCanvas(initial))

  useEffect(() => {
    if (!selfieUrl) {
      setTexture(makeCircularCanvas(initial))
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const S = 256
      const c = document.createElement('canvas')
      c.width = c.height = S
      const ctx = c.getContext('2d')!

      // Clip to circle and draw selfie
      ctx.save()
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2)
      ctx.clip()
      // Fit image (center-crop square)
      const srcS = Math.min(img.width, img.height)
      const sx = (img.width - srcS) / 2
      const sy = (img.height - srcS) / 2
      ctx.drawImage(img, sx, sy, srcS, srcS, 0, 0, S, S)
      ctx.restore()

      // Gold ring border
      ctx.strokeStyle = 'rgba(201,168,76,0.9)'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2)
      ctx.stroke()

      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      setTexture(tex)
    }
    img.onerror = () => setTexture(makeCircularCanvas(initial))
    img.src = selfieUrl
  }, [selfieUrl, initial])

  return texture
}

// ─── Center Image (hero image as 3D plane) ──────────────────────────────
// Using a Mesh so it exists in 3D space — as the camera orbits, the plane
// perspective changes accordingly. AdditiveBlending makes the black background 
// invisible, letting gold particles glow.
function CenterImage({ isPlaying }: { isPlaying: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    new THREE.TextureLoader().load('/LegacyLine.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      setTexture(tex)
    })
  }, [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    // Subtle breathing pulse; slightly larger when playing
    const baseH = isPlaying ? 5.1 : 4.8
    const baseW = baseH * 0.94
    const h = baseH + Math.sin(t * 0.45) * 0.06
    const w = h * 0.94
    meshRef.current.scale.set(w, h, 1)

    // Match the slowest/inner orbit slightly to give it 3D depth
    meshRef.current.rotation.y += delta * 0.05
  })

  if (!texture) return null

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ─── Audio Aura (waveform ring around center image) ────────────────────
function AudioAura({
  analyserRef,
  isPlaying,
}: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>
  isPlaying: boolean
}) {
  const COUNT = 128
  const BASE_R = 2.5   // pushed out to clear the hero image
  const groupRef = useRef<THREE.Group>(null)

  const lineObj = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i <= COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2
      pts.push(Math.cos(a) * BASE_R, Math.sin(a) * BASE_R, 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const mat = new THREE.LineBasicMaterial({ color: '#c9a84c', transparent: true, opacity: 0.08 })
    return new THREE.Line(geo, mat)
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (groupRef.current) groupRef.current.rotation.z = t * 0.038
    const mat = lineObj.material as THREE.LineBasicMaterial
    const pos = lineObj.geometry.attributes.position as THREE.BufferAttribute

    if (isPlaying && analyserRef.current) {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      let peak = 0
      for (let i = 0; i <= COUNT; i++) {
        const a = (i / COUNT) * Math.PI * 2
        const fi = Math.floor((i / COUNT) * data.length * 0.55)
        const amp = data[fi] / 255
        peak = Math.max(peak, amp)
        const r = BASE_R + amp * 0.9
        pos.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0)
      }
      pos.needsUpdate = true
      mat.opacity = 0.3 + peak * 0.7
      mat.color.setHSL(0.12 - peak * 0.02, 0.82, 0.54 + peak * 0.12)
    } else {
      for (let i = 0; i <= COUNT; i++) {
        const a = (i / COUNT) * Math.PI * 2
        const r = BASE_R + Math.sin(a * 5 + t * 0.55) * 0.022
        pos.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0)
      }
      pos.needsUpdate = true
      mat.opacity = 0.065 + Math.sin(t * 0.65) * 0.022
      mat.color.setHex(0xc9a84c)
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={lineObj} />
    </group>
  )
}

// ─── Recording Node (circular selfie sprite — always faces camera) ──────
function RecordingNode({
  recording,
  isSelected,
  onClick,
  index,
  analyserRef,
}: {
  recording: Recording
  isSelected: boolean
  onClick: () => void
  index: number
  analyserRef?: React.MutableRefObject<AnalyserNode | null>
}) {
  const spriteRef = useRef<THREE.Sprite>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const [hovered, setHovered] = useState(false)
  const texture = useCircularTexture(recording.selfie_url, recording.name.charAt(0))

  // Pre-build a radial glow texture for the backing sprite
  const glowTexture = useMemo(() => {
    const S = 128
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(201,168,76,0.9)')
    g.addColorStop(0.4, 'rgba(201,168,76,0.3)')
    g.addColorStop(1, 'rgba(201,168,76,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(c)
    return tex
  }, [])

  useFrame((state) => {
    if (!spriteRef.current || !glowRef.current) return
    const t = state.clock.getElapsedTime()

    // Lerp thumbnail size
    const targetS = isSelected ? 0.62 : hovered ? 0.50 : 0.38
    const cur = spriteRef.current.scale.x
    const next = cur + (targetS - cur) * 0.13
    spriteRef.current.scale.set(next, next, 1)

    // Glow opacity
    const gm = glowRef.current.material as THREE.SpriteMaterial
    
    // Audio-reactive flash
    let audioFlash = 0
    if (isSelected && analyserRef?.current) {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      audioFlash = avg / 255
    }

    gm.opacity = isSelected
      ? 0.55 + Math.abs(Math.sin(t * 3.2 + index * 0.7)) * 0.3 + audioFlash * 0.45
      : hovered
        ? 0.38
        : 0.1 + Math.sin(t * 1.2 + index) * 0.04
    
    const gs = isSelected 
      ? 0.9 + audioFlash * 0.6 // Selected node grows with audio
      : hovered 
        ? 0.72 
        : 0.55
    glowRef.current.scale.set(gs, gs, 1)

    // Also pulse the sprite itself slightly with audio
    const ss = targetS + audioFlash * 0.15
    spriteRef.current.scale.set(ss, ss, 1)
  })

  return (
    <group>
      {/* Glow halo behind thumbnail */}
      <sprite ref={glowRef} scale={[0.55, 0.55, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Circular selfie / initial thumbnail */}
      <sprite
        ref={spriteRef}
        scale={[0.38, 0.38, 1]}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      >
        <spriteMaterial
          map={texture}
          transparent
          alphaTest={0.05}
          depthWrite={false}
        />
      </sprite>

      {/* Hover name tooltip */}
      {hovered && !isSelected && (
        <Html center position={[0, 0.32, 0]} style={{ pointerEvents: 'none', zIndex: 100 }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.9)',
              border: '1px solid rgba(201,168,76,0.45)',
              borderRadius: '8px',
              padding: '4px 11px',
              color: '#e6c96d',
              fontSize: '11px',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(10px)',
              letterSpacing: '0.04em',
            }}
          >
            {recording.name}
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Wavelength Connection ──────────────────────────────────────────────
function WavelengthConnection({
  targetPos,
  isSelected,
  index,
}: {
  targetPos: THREE.Vector3
  isSelected: boolean
  index: number
}) {
  const SEGMENTS = 32

  const geometry = useMemo(() => {
    const pts = []
    for (let i = 0; i <= SEGMENTS; i++) {
      pts.push(new THREE.Vector3(0, 0, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: isSelected ? '#f0d878' : '#c9a84c',
      transparent: true,
      depthWrite: false,
    })
    return new THREE.Line(geometry, mat)
  }, [geometry, isSelected])

  useFrame((state) => {
    if (!lineObj) return
    const pos = lineObj.geometry.attributes.position as THREE.BufferAttribute
    const t = state.clock.getElapsedTime()

    for (let i = 0; i <= SEGMENTS; i++) {
      const pct = i / SEGMENTS
      // Base line from center (0,0,0) to node position
      const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), targetPos, pct)

      // Add "wavelength" animation
      // Amplitude increases in the middle of the line, and is higher for selected node
      const amp = (isSelected ? 0.25 : 0.08) * Math.sin(pct * Math.PI)
      const freq = isSelected ? 12 : 6
      const speed = isSelected ? 4 : 2

      const wave = Math.sin(pct * freq - t * speed + index) * amp
      
      // Offset perpendicular to the line direction
      p.y += wave
      
      pos.setXYZ(i, p.x, p.y, p.z)
    }
    pos.needsUpdate = true
    
    const mat = lineObj.material as THREE.LineBasicMaterial
    mat.opacity = isSelected ? 0.85 : 0.28 + Math.sin(t * 1.5 + index) * 0.1
  })

  return <primitive object={lineObj} />
}

// ─── Orbital Ring ──────────────────────────────────────────────────────
function OrbitalRing({
  cfg,
  recordings,
  selectedId,
  onSelect,
  nodePositionsRef,
  analyserRef,
}: {
  cfg: (typeof RINGS)[number]
  recordings: Recording[]
  selectedId: string | null
  onSelect: (rec: Recording, worldPos: THREE.Vector3) => void
  nodePositionsRef: React.MutableRefObject<Map<string, THREE.Vector3>>
  analyserRef: React.MutableRefObject<AnalyserNode | null>
}) {
  const groupRef = useRef<THREE.Group>(null)

  const ringLine = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push(Math.cos(a) * cfg.radius, 0, Math.sin(a) * cfg.radius)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: '#c9a84c', transparent: true, opacity: 0.07 })
    )
  }, [cfg.radius])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += cfg.speed * delta
      
      // Update real-time world positions for camera tracking
      recordings.forEach((rec, i) => {
        const a = (i / Math.max(recordings.length, 1)) * Math.PI * 2
        const local = new THREE.Vector3(Math.cos(a) * cfg.radius, 0, Math.sin(a) * cfg.radius)
        const world = groupRef.current!.localToWorld(local)
        nodePositionsRef.current.set(rec.id, world)
      })
    }
  })

  const handleClick = useCallback(
    (rec: Recording, i: number) => {
      if (!groupRef.current) return
      const a = (i / Math.max(recordings.length, 1)) * Math.PI * 2
      const local = new THREE.Vector3(Math.cos(a) * cfg.radius, 0, Math.sin(a) * cfg.radius)
      const world = groupRef.current.localToWorld(local)
      onSelect(rec, world)
    },
    [recordings.length, cfg.radius, onSelect]
  )

  return (
    <group ref={groupRef} rotation={[cfg.tiltX, 0, 0]}>
      <primitive object={ringLine} />
      
      {recordings.map((rec, i) => {
        const a = (i / Math.max(recordings.length, 1)) * Math.PI * 2
        const localPos = new THREE.Vector3(Math.cos(a) * cfg.radius, 0, Math.sin(a) * cfg.radius)
        return (
          <group key={rec.id}>
            {/* Animated wavelength connecting to center */}
            <WavelengthConnection 
              targetPos={localPos} 
              isSelected={rec.id === selectedId} 
              index={i} 
            />
            
            <group position={localPos}>
              <RecordingNode
                recording={rec}
                isSelected={rec.id === selectedId}
                onClick={() => handleClick(rec, i)}
                index={i}
                analyserRef={analyserRef}
              />
            </group>
          </group>
        )
      })}
    </group>
  )
}

// ─── Gold Particles ────────────────────────────────────────────────────
function GoldParticles() {
  const COUNT = 280
  const pointsRef = useRef<THREE.Points>(null)
  const { geo, speeds } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    const spd = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12
      spd[i] = 0.02 + Math.random() * 0.1
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { geo: g, speeds: spd }
  }, [])

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * delta * 0.5
      if (arr[i * 3 + 1] > 7) arr[i * 3 + 1] = -7
    }
    pos.needsUpdate = true
    pointsRef.current.rotation.y += delta * 0.009
  })

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial color="#c9a84c" size={0.022} sizeAttenuation transparent opacity={0.42} depthWrite={false} />
    </points>
  )
}

// ─── Camera Controller ─────────────────────────────────────────────────
function CameraController({
  selectedId,
  nodePositionsRef,
  isPlaying,
  orbitRef,
}: {
  selectedId: string | null
  nodePositionsRef: React.MutableRefObject<Map<string, THREE.Vector3>>
  isPlaying: boolean
  orbitRef: React.MutableRefObject<any>
}) {
  const { camera, size } = useThree()
  const isMobile = size.width < 768
  
  // Default camera position is further back on mobile to fit the whole formation
  const defaultCamPos = useMemo(() => {
    return isMobile 
      ? new THREE.Vector3(0, 4.8, 18.5)
      : new THREE.Vector3(0, 3.5, 14.5)
  }, [isMobile])

  const camTarget = useRef(defaultCamPos.clone())
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0))
  const currentLook = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    if (selectedId) {
      if (orbitRef.current) orbitRef.current.enabled = false
    } else {
      const tid = setTimeout(() => {
        if (orbitRef.current) {
          orbitRef.current.target.set(0, 0, 0)
          orbitRef.current.enabled = true
        }
      }, 1200)
      return () => clearTimeout(tid)
    }
  }, [selectedId, orbitRef])

  useFrame((state, delta) => {
    if (selectedId && nodePositionsRef.current.has(selectedId)) {
      const worldPos = nodePositionsRef.current.get(selectedId)!
      const dir = worldPos.clone().normalize()
      
      // "Moon orbit" logic: position camera further out on the same radial vector
      // This keeps the node directly between the camera and the center graphic
      const offsetDistance = isMobile ? 3.2 : 4.5
      camTarget.current.copy(worldPos).add(dir.clone().multiplyScalar(offsetDistance))
      
      // Subtle height for a better perspective looking down at both
      camTarget.current.y += isMobile ? 1.4 : 2.2
      
      // Look through the node at the center graphic
      lookTarget.current.set(0, 0, 0)
    } else {
      camTarget.current.copy(defaultCamPos)
      lookTarget.current.set(0, 0, 0)
    }

    if (orbitRef.current?.enabled) return
    
    // Faster lerp for more responsive "locked-on" feel
    const lerpFactor = selectedId ? 2.4 : 1.4
    camera.position.lerp(camTarget.current, delta * lerpFactor)
    currentLook.current.lerp(lookTarget.current, delta * (lerpFactor + 0.2))
    camera.lookAt(currentLook.current)
  })

  return null
}

// ─── 3-D Scene ─────────────────────────────────────────────────────────
function Scene({
  recordings,
  selectedId,
  selectedWorldPos,
  onSelect,
  analyserRef,
  isPlaying,
  orbitRef,
}: {
  recordings: Recording[]
  selectedId: string | null
  selectedWorldPos: THREE.Vector3 | null
  onSelect: (rec: Recording, worldPos: THREE.Vector3) => void
  analyserRef: React.MutableRefObject<AnalyserNode | null>
  isPlaying: boolean
  orbitRef: React.MutableRefObject<any>
}) {
  const rings = useMemo(() => assignToRings(recordings), [recordings])
  const nodePositionsRef = useRef(new Map<string, THREE.Vector3>())

  return (
    <>
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 5, 3]} intensity={2.2} color="#e6c96d" />
      <pointLight position={[-4, -2, 3]} intensity={0.9} color="#c9a84c" />
      <pointLight position={[4, 2, -2]} intensity={0.5} color="#a07832" />

      <GoldParticles />
      <CenterImage isPlaying={isPlaying} />
      <AudioAura analyserRef={analyserRef} isPlaying={isPlaying} />

      {rings.map(({ cfg, items }, ri) => (
        <OrbitalRing
          key={ri}
          cfg={cfg}
          recordings={items}
          selectedId={selectedId}
          onSelect={onSelect}
          nodePositionsRef={nodePositionsRef}
          analyserRef={analyserRef}
        />
      ))}

      <CameraController
        selectedId={selectedId}
        nodePositionsRef={nodePositionsRef}
        isPlaying={isPlaying}
        orbitRef={orbitRef}
      />

      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        minDistance={5}
        maxDistance={18}
        autoRotate
        autoRotateSpeed={0.35}
        maxPolarAngle={Math.PI * 0.78}
        minPolarAngle={Math.PI * 0.18}
      />
    </>
  )
}

// ─── Selected Recording Card (DOM overlay) ─────────────────────────────
// Track source nodes to prevent 'already connected' errors (especially in Strict Mode)
const audioSourceMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()
let sharedAudioCtx: AudioContext | null = null

function SelectedCard({
  recording,
  onStop,
  analyserRef,
  onPlaying,
}: {
  recording: Recording
  onStop: () => void
  analyserRef: React.MutableRefObject<AnalyserNode | null>
  onPlaying: (p: boolean) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [needsTap, setNeedsTap] = useState(false)

  // Called both from the effect (auto-play attempt) and from the tap-to-play button
  const tryPlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (sharedAudioCtx?.state === 'suspended') {
      sharedAudioCtx.resume().catch(console.error)
    }
    audio.play()
      .then(() => { onPlaying(true); setNeedsTap(false) })
      .catch(() => setNeedsTap(true))
  }, [onPlaying])

  useEffect(() => {
    const audio = audioRef.current
    // sharedAudioCtx was already created in handleSelect (user gesture).
    // If for some reason it's still null, bail — we can't proceed without it.
    if (!audio || !sharedAudioCtx) return
    const ctx = sharedAudioCtx

    if (ctx.state === 'suspended') ctx.resume().catch(console.error)

    // Force volume to 1 and ensure it's unmuted
    audio.volume = 1
    audio.muted = false

    let source = audioSourceMap.get(audio)
    if (!source) {
      source = ctx.createMediaElementSource(audio)
      audioSourceMap.set(audio, source)
    }

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyser.connect(ctx.destination)
    analyserRef.current = analyser

    const onTime = () => setProgress(audio.currentTime / (audio.duration || 1))
    const onLoad = () => setDuration(audio.duration)
    const onEnd = () => { onPlaying(false); onStop() }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoad)
    audio.addEventListener('ended', onEnd)

    const handlePlay = async () => {
      console.log(`[Audio] Attempting to play: ${recording.name} (ID: ${recording.id})`)
      try {
        // 1. Ensure audio is loaded and ready
        audio.load()
        
        // 2. Wake up context
        if (ctx.state === 'suspended') {
          console.log('[Audio] Context suspended, resuming...')
          await ctx.resume().catch(console.error)
        }
        
        // 3. Play
        console.log('[Audio] Calling audio.play()...')
        await audio.play()
        console.log('[Audio] Playback started successfully')
        onPlaying(true)
        setNeedsTap(false)
        
        // 4. Final verification check for output
        if (ctx.state === 'suspended') {
          console.log('[Audio] Context still suspended after play, forcing resume...')
          await ctx.resume().catch(console.error)
        }
      } catch (e: any) {
        console.error('[Audio] Playback failed/blocked:', e)
        if (e.name === 'NotAllowedError') {
          setNeedsTap(true)
        } else if (e.name !== 'AbortError') {
          console.error('[Audio] Unexpected playback error:', e)
        }
      }
    }

    handlePlay()

    return () => {
      console.log(`[Audio] Unmounting card for ${recording.name}`)
      if (analyserRef.current === analyser) analyserRef.current = null
      onPlaying(false)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoad)
      audio.removeEventListener('ended', onEnd)
      audio.pause()
      try { 
        source?.disconnect() 
        analyser.disconnect() 
      } catch (err) {
        console.warn('[Audio] Cleanup error:', err)
      }
    }
  }, [recording.id, onStop, onPlaying, analyserRef, tryPlay])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: '76px',
        left: '50%',
        zIndex: 60,
        maxWidth: '360px',
        width: 'calc(100% - 2rem)',
        pointerEvents: 'all',
      }}
      initial={{ opacity: 0, y: -24, scale: 0.95, x: '-50%' }}
      animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
      exit={{ opacity: 0, y: 40, scale: 0, x: '-50%' }}
      transition={{ duration: 0.45, type: 'spring', stiffness: 140, damping: 20 }}
    >
      <audio 
        ref={audioRef} 
        src={recording.audio_url} 
        crossOrigin="anonymous"
      />

      <div
        style={{
          background: 'rgba(10,8,0,0.92)',
          border: '1px solid rgba(201,168,76,0.35)',
          borderRadius: '20px',
          padding: '1.2rem 1.4rem',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 8px 50px rgba(201,168,76,0.2), 0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Avatar */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              border: '2px solid rgba(201,168,76,0.55)',
              boxShadow: '0 0 16px rgba(201,168,76,0.35)',
              background: 'linear-gradient(135deg, #2a1f00, #c9a84c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {recording.selfie_url ? (
              <img src={recording.selfie_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#0a0a0a', fontSize: '1.4rem', fontWeight: '900', fontFamily: 'Georgia, serif' }}>
                {recording.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'rgba(201,168,76,0.55)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '2px' }}>
              Now Playing
            </p>
            <p style={{ color: '#e6c96d', fontSize: '1rem', fontWeight: '700', fontFamily: 'Georgia, serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recording.name}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>Noblesville Senior</p>
          </div>

          {/* Stop */}
          <button
            onClick={onStop}
            style={{
              width: 36, height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = 'rgba(255,255,255,0.14)') }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'rgba(255,255,255,0.07)') }}
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(201,168,76,0.5)', fontSize: '10px' }}>
              {fmt((recording.duration ?? 0) * progress)}
            </span>
            <span style={{ color: 'rgba(201,168,76,0.5)', fontSize: '10px' }}>
              {recording.duration ? fmt(recording.duration) : '—'}
            </span>
          </div>
          <div style={{ height: '3px', background: 'rgba(201,168,76,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
            <motion.div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #a07832, #e6c96d)',
                borderRadius: '2px',
                transformOrigin: 'left',
              }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Tap-to-play fallback (shown when autoplay is blocked by the browser) */}
        {needsTap ? (
          <button
            onClick={tryPlay}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #9a7030, #c9a84c, #e6c96d)',
              color: '#0a0a0a',
              fontWeight: '700',
              fontSize: '13px',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            ▶ Tap to Play
          </button>
        ) : (
          /* Live waveform indicator dots */
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '12px' }}>
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                style={{ width: 4, borderRadius: 2, background: '#c9a84c' }}
                animate={{ height: [4, 14 + i * 2, 4] }}
                transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Export ───────────────────────────────────────────────────────
export default function NFormation({ recordings }: { recordings: Recording[] }) {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [selectedWorldPos, setSelectedWorldPos] = useState<THREE.Vector3 | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const orbitRef = useRef<any>(null)

  const handleSelect = useCallback((rec: Recording, worldPos: THREE.Vector3) => {
    // Create & resume AudioContext during the user gesture — required on iOS Safari.
    // If created later (e.g. in a useEffect) the context starts suspended and all
    // audio routed through it is silently muted.
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      if (Ctor) {
        sharedAudioCtx = new Ctor()
        console.log('[Audio] Initialized new shared AudioContext')
      }
    }
    if (sharedAudioCtx?.state === 'suspended') {
      sharedAudioCtx.resume().catch(console.error)
    }
    
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().then(() => {
        console.log('[Audio] Context resumed successfully')
      }).catch(console.error)
    }
    
    setSelectedRecording(rec)
    setSelectedWorldPos(worldPos)
  }, [])

  const handleStop = useCallback(() => {
    setSelectedRecording(null)
    setSelectedWorldPos(null)
    setIsPlaying(false)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas camera={{ position: [0, 3.5, 14.5], fov: 45 }} style={{ background: 'transparent' }} dpr={[1, 2]}>
        <Scene
          recordings={recordings}
          selectedId={selectedRecording?.id ?? null}
          selectedWorldPos={selectedWorldPos}
          onSelect={handleSelect}
          analyserRef={analyserRef}
          isPlaying={isPlaying}
          orbitRef={orbitRef}
        />
      </Canvas>

      <AnimatePresence>
        {selectedRecording && (
          <SelectedCard
            key={selectedRecording.id}
            recording={selectedRecording}
            onStop={handleStop}
            analyserRef={analyserRef}
            onPlaying={setIsPlaying}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
