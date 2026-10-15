// Summit cinematic: a black hole tears open in front of the player at the top of the sky, debris and light
// spiral into it, and the player is sucked in (spinning + shrinking). `onSwap` fires when it swallows them
// (screen is black) so worlds.js can load the next world; `banner()` then shows "WORLD UNLOCKED <name>".
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial,
  Points, PointsMaterial, RingGeometry, SphereGeometry, Sprite, SpriteMaterial,
} from 'three'
import './blackhole.css'
import { baseGravity, player } from './player.js'
import { getYaw } from './camera.js'
import { playBurst } from './sfx.js'

const OPEN = 1.3 // s the hole opens
const PULL = 2.1 // s the player spirals in
const TOTAL = OPEN + PULL
const DIST = 9 // m in front of the player
const PARTS = 420
const TAU = Math.PI * 2
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (t) => t * t * (3 - 2 * t)

function glowTexture(inner, outer) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

// Accretion disc: bright hot rim fading outward, with swirl streaks.
function discTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 128, 60, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,190,80,0.95)')
  grad.addColorStop(0.5, 'rgba(190,60,255,0.55)')
  grad.addColorStop(1, 'rgba(60,20,160,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  g.globalCompositeOperation = 'destination-in'
  const mask = g.createConicGradient(0, 128, 128)
  for (let i = 0; i <= 8; i++) mask.addColorStop(i / 8, i % 2 ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,1)')
  g.fillStyle = mask
  g.fillRect(0, 0, 256, 256)
  return new CanvasTexture(c)
}

export function createBlackHole(scene) {
  const group = new Group()
  group.visible = false
  const core = new Mesh(new SphereGeometry(1, 32, 24), new MeshBasicMaterial({ color: 0x000000, fog: false }))
  const disc = new Mesh(
    new RingGeometry(1.05, 3.6, 64, 1),
    new MeshBasicMaterial({ map: discTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }),
  )
  disc.rotation.x = Math.PI / 2 - 0.35
  const halo = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(190,110,255,0.7)', 'rgba(90,30,200,0)'), blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }))
  halo.scale.setScalar(11)

  // Debris: each particle orbits the hole on a spiral that tightens over time.
  const pos = new Float32Array(PARTS * 3)
  const seed = Array.from({ length: PARTS }, () => ({ r: 2.5 + Math.random() * 12, a: Math.random() * TAU, y: (Math.random() - 0.5) * 3, s: 0.6 + Math.random() * 1.4 }))
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  const dust = new Points(geo, new PointsMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,200,255,0)'), size: 0.55, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false, color: 0xffd9ff }))
  dust.frustumCulled = false
  group.add(core, disc, halo, dust)
  scene.add(group)

  const flash = document.createElement('div')
  flash.className = 'bh-flash'
  const vignette = document.createElement('div')
  vignette.className = 'bh-vig'
  const bannerEl = document.createElement('div')
  bannerEl.className = 'bh-banner'
  bannerEl.hidden = true
  document.body.append(vignette, flash, bannerEl)

  let t = -1 // < 0 idle
  let swapped = false
  let onSwap = null
  const centre = { x: 0, y: 0, z: 0 }
  const start = { x: 0, y: 0, z: 0 }
  let startAng = 0
  let startR = 0

  const state = { active: false, scale: 1, spin: 0, tumble: 0, shake: 0 }

  function play(swap) {
    if (t >= 0) return
    t = 0
    swapped = false
    onSwap = swap
    state.active = true
    const p = player.position
    start.x = p.x
    start.y = p.y
    start.z = p.z
    const yaw = getYaw()
    centre.x = p.x - Math.sin(yaw) * DIST
    centre.z = p.z - Math.cos(yaw) * DIST
    centre.y = p.y + 1.2
    startAng = Math.atan2(p.z - centre.z, p.x - centre.x)
    startR = DIST
    player.locked = true
    player.gravity = 0
    group.position.set(centre.x, centre.y, centre.z)
    group.visible = true
    playBurst()
  }

  function finish() {
    t = -1
    state.active = false
    state.scale = 1
    state.spin = state.tumble = state.shake = 0
    group.visible = false
    player.gravity = baseGravity()
  }

  function update(dt, time) {
    if (t < 0) return
    t += dt
    const open = ease(clamp01(t / OPEN))
    const pull = clamp01((t - OPEN) / PULL)
    const k = pull * pull // accelerating inward

    // Hole size / look
    const s = 0.01 + open * 2.4 * (1 - 0.75 * ease(clamp01((pull - 0.85) / 0.15)))
    core.scale.setScalar(s * 0.55)
    disc.scale.setScalar(s)
    disc.rotation.z += dt * (2 + 8 * pull)
    halo.scale.setScalar(s * 5)
    halo.material.opacity = 0.4 + 0.3 * Math.sin(time * 14)
    dust.material.opacity = open

    // Debris spiral: radius shrinks with `pull`, angular speed grows toward the centre.
    const a = geo.attributes.position
    for (let i = 0; i < PARTS; i++) {
      const d = seed[i]
      const rr = Math.max(0.05, d.r * (1 - Math.min(1, (open * 0.15 + pull * 1.2) * d.s * 0.85)))
      const ang = d.a + (t * 2.2 + 14 * k) * d.s * (3 / (0.6 + rr * 0.35))
      a.setXYZ(i, Math.cos(ang) * rr, d.y * (rr / 8), Math.sin(ang) * rr)
    }
    a.needsUpdate = true

    // Player: lifted toward the hole, orbiting tighter and faster, shrinking into it.
    if (pull > 0) {
      const r = startR * (1 - k)
      const ang = startAng + pull * pull * TAU * 3.2
      player.position.x = centre.x + Math.cos(ang) * r
      player.position.z = centre.z + Math.sin(ang) * r
      player.position.y = start.y + (centre.y - start.y) * k
      state.scale = Math.max(0.02, 1 - k * 0.98)
      state.spin = pull * 28 * pull
      state.tumble = pull * 9
    } else {
      state.scale = 1
      state.spin = 0
      state.tumble = 0
      player.position.y = start.y + Math.sin(t * 6) * 0.15 * open // hover as the hole opens
    }
    player.velocity.x = player.velocity.y = player.velocity.z = 0
    state.shake = 0.35 + 0.65 * Math.max(open * 0.5, pull)

    vignette.style.opacity = String(0.9 * Math.max(open * 0.55, pull))
    if (t >= TOTAL - 0.35) {
      const f = clamp01((t - (TOTAL - 0.35)) / 0.35)
      flash.style.opacity = String(f)
      flash.style.background = f < 0.5 ? '#fff' : '#000'
    }
    if (t >= TOTAL && !swapped) {
      swapped = true
      group.visible = false
      state.scale = 1
      state.spin = state.tumble = 0
      onSwap?.() // loads the next world while the screen is covered
      finish()
      flash.style.transition = vignette.style.transition = 'opacity 0.8s ease'
      setTimeout(() => {
        vignette.style.opacity = flash.style.opacity = '0'
        setTimeout(() => (flash.style.transition = vignette.style.transition = ''), 900)
      }, 150)
    }
  }

  function banner(title, name, card) {
    bannerEl.hidden = false
    bannerEl.style.setProperty('--top', card.top)
    bannerEl.style.setProperty('--bot', card.bot)
    bannerEl.style.setProperty('--edge', card.edge)
    bannerEl.innerHTML = `<div class="bh-sub o">${title}</div><div class="bh-name o">${name}</div>${Array.from({ length: 16 }, (_, i) => `<i style="--a:${(i / 16) * 360}deg;--d:${(i % 4) * 0.08}s"></i>`).join('')}`
    bannerEl.classList.remove('show')
    void bannerEl.offsetWidth
    bannerEl.classList.add('show')
    clearTimeout(banner.timer)
    banner.timer = setTimeout(() => (bannerEl.hidden = true), 4200)
  }

  return { state, play, update, banner }
}
