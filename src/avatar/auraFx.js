// Visual effect of the equipped aura, parented to the player group (so it survives avatar swaps):
// a pulsing ground ring, a soft body glow and glowing particles that spiral up around the player.
// Colours come from the aura's row colours (AURAS); the Rainbow aura cycles hue. Stronger auras
// (higher index) get more particles.
import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, Mesh,
  MeshBasicMaterial, Points, PointsMaterial, RingGeometry, Sprite, SpriteMaterial,
} from 'three'
import { AURAS } from '../config.js'
import { state, subscribe } from '../state.js'

const MAX = 90
const HEIGHT = 2.6

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

export function createAuraFx(parent) {
  const tex = glowTexture()
  const group = new Group()
  group.visible = false
  parent.add(group)

  const ring = new Mesh(
    new RingGeometry(0.8, 1.3, 48),
    new MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, side: DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.05
  group.add(ring)

  const glow = new Sprite(new SpriteMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false }))
  glow.position.y = 1.1
  group.add(glow)

  const pos = new Float32Array(MAX * 3)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  const dots = new Points(
    geo,
    new PointsMaterial({ map: tex, size: 0.6, transparent: true, depthWrite: false, sizeAttenuation: true }),
  )
  dots.frustumCulled = false
  group.add(dots)

  // per-particle phase: angle, radius, height progress, rise speed
  const p = Array.from({ length: MAX }, () => ({ a: Math.random() * 6.28, r: 0.5 + Math.random() * 0.7, h: Math.random(), v: 0.25 + Math.random() * 0.5 }))
  let active = 0
  let a = null
  const c1 = new Color()
  const c2 = new Color()

  subscribe((s) => {
    a = AURAS.find((x) => x.id === s.aura) ?? null
    group.visible = !!a
    if (!a) return
    const i = AURAS.indexOf(a)
    active = Math.round(30 + (i / (AURAS.length - 1)) * (MAX - 30))
    geo.setDrawRange(0, active)
    glow.scale.setScalar(2.6 + i * 0.18)
  })

  function update(t, dt) {
    if (!a) return
    if (a.rainbow) {
      c1.setHSL((t * 0.4) % 1, 1, 0.6)
      c2.setHSL((t * 0.4 + 0.5) % 1, 1, 0.6)
    } else {
      c1.set(a.top)
      c2.set(a.bot)
    }
    dots.material.color.copy(c1)
    glow.material.color.copy(c2)
    ring.material.color.copy(c1)
    ring.material.opacity = 0.75 + Math.sin(t * 3) * 0.15
    ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08)
    glow.material.opacity = 0.3 + Math.sin(t * 2.2) * 0.1
    for (let k = 0; k < active; k++) {
      const q = p[k]
      q.h += q.v * dt * 0.6
      if (q.h > 1) Object.assign(q, { h: 0, a: Math.random() * 6.28 })
      const ang = q.a + t * (0.8 + q.v) + q.h * 3
      const rad = q.r * (1 - q.h * 0.45)
      pos[k * 3] = Math.cos(ang) * rad
      pos[k * 3 + 1] = q.h * HEIGHT
      pos[k * 3 + 2] = Math.sin(ang) * rad
    }
    geo.attributes.position.needsUpdate = true
  }

  return { update }
}
