import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { ARENA, COLORS, DISPLAY, LAUNCH_PAD, PORTAL, SHOP, SODA_ITEMS, SOUTH, TOWER, VOID_NPC, VOID_SODA } from './config.js'
import { addSolid, player } from './player.js'
import { checkerTexture, studBox, studTexture } from './textures.js'
import { makeLabel } from './labels.js'
import { sodaItem } from './sodaItems.js'
import { addZone } from './interact.js'
import { notify, remoteBelts, runningBelt, sodaStatus, state, subscribe } from './state.js'
import { net, onLeaderboard } from './net.js'
import { short } from './hud.js'

// The Shake Soda Escape lobby, north view from spawn: a walled studded arena,
// the numbered Soda Jump tower dead ahead with its launch pad, the World 2
// portal to its left, the Void Soda NPC to its right, the soda display along
// the east wall and the gold/blue shop pads in the west zone. Pure scenery
// plus colliders; no gameplay.

const PLASTIC = { roughness: 0.55, metalness: 0 }
export const solid = (minX, maxX, minZ, maxZ, top) => addSolid({ minX, maxX, minZ, maxZ, top })

// A box with studded plastic on every face, base at y.
export function brick(w, h, d, color, x, y, z, { studs = true, collide = true, emissive } = {}) {
  const map = studs ? studTexture(color) : null
  const mesh = new Mesh(
    studs ? studBox(w, h, d, map.userData.tileMetres) : new BoxGeometry(w, h, d),
    new MeshStandardMaterial({ color: studs ? '#ffffff' : color, map, emissive: emissive ?? '#000000', ...PLASTIC }),
  )
  mesh.position.set(x, y + h / 2, z)
  mesh.castShadow = mesh.receiveShadow = true
  if (collide) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h)
  return mesh
}

export const flat = (color, extra = {}) => new MeshStandardMaterial({ color, ...PLASTIC, ...extra })
export const glowMat = (color) => new MeshBasicMaterial({ color, toneMapped: false })

// Soft radial glow sprite (additive).
let glowTex = null
export function glow(color, size, opacity = 0.8) {
  if (!glowTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    glowTex = new CanvasTexture(c)
  }
  const s = new Sprite(new SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, fog: false }))
  s.scale.set(size, size, 1)
  return s
}

// --- Arena walls ----------------------------------------------------------------
export function buildWalls(group, style = {}) {
  const { minX, maxX, minZ, maxZ, capHeight: cap, wallThickness: t } = ARENA
  const h = style.height ?? ARENA.wallHeight
  const brickTex = checkerTexture(style.a ?? COLORS.wallA, style.b ?? COLORS.wallB)
  const capTex = studTexture(style.cap ?? COLORS.wallCap)
  const wallMat = new MeshStandardMaterial({ map: brickTex, ...PLASTIC })
  const capMat = new MeshStandardMaterial({ map: capTex, ...PLASTIC })
  const W = maxX - minX + t * 2
  const D = maxZ - minZ
  // [centre x, centre z, width (x), depth (z)]
  const walls = [
    [(minX + maxX) / 2, minZ - t / 2, W, t],
    [(minX + maxX) / 2, maxZ + t / 2, W, t],
    [minX - t / 2, (minZ + maxZ) / 2, t, D],
    [maxX + t / 2, (minZ + maxZ) / 2, t, D],
  ]
  for (const [x, z, w, d] of walls) {
    const body = new Mesh(studBox(w, h - cap, d, brickTex.userData.tileMetres), wallMat)
    // Checker rows start at the floor.
    body.position.set(x, (h - cap) / 2, z)
    body.receiveShadow = body.castShadow = true
    const top = new Mesh(studBox(w + 0.02, cap, d + 0.02, capTex.userData.tileMetres), capMat)
    top.position.set(x, h - cap / 2, z)
    top.castShadow = true
    group.add(body, top)
  }
}

// --- Soda Jump tower + launch pad -------------------------------------------------
const towerLabel = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(2)}K` : String(n))
function towerFaceTexture(label, hue) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = Math.round((256 * TOWER.segmentHeight) / TOWER.size) // same aspect as the face, so the number isn't stretched
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, c.height)
  grad.addColorStop(0, `hsl(${hue} 100% 58%)`)
  grad.addColorStop(1, `hsl(${hue} 95% 48%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(255,255,255,0.12)'
  g.fillRect(0, 0, c.width, 4)
  g.fillStyle = 'rgba(120,40,0,0.18)'
  g.fillRect(0, c.height - 4, c.width, 4)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const draw = () => {
    let px = Math.min(c.height * 0.62, 100)
    g.font = `700 ${px}px Fredoka, "Arial Rounded MT Bold", sans-serif`
    const w = g.measureText(label).width
    if (w > c.width - 40) {
      px *= (c.width - 40) / w // long labels shrink to fit the face
      g.font = `700 ${px}px Fredoka, "Arial Rounded MT Bold", sans-serif`
    }
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = Math.max(6, px * 0.15)
    g.strokeStyle = '#2b2b2b'
    g.strokeText(label, c.width / 2, c.height / 2 + 4)
    g.fillStyle = '#ffffff'
    g.fillText(label, c.width / 2, c.height / 2 + 4)
    tex.needsUpdate = true
  }
  // Repaint the number over a fresh background once the real font is in.
  const bg = g.getImageData(0, 0, c.width, c.height)
  draw()
  document.fonts?.load('700 92px Fredoka').then(() => {
    g.putImageData(bg, 0, 0)
    draw()
  }, () => {})
  return tex
}

export function buildTower(group) {
  const { x, z, size, segmentHeight: sh, segments, labelStep } = TOWER
  const geo = new BoxGeometry(size, sh, size)
  const tower = new Group() // the numbered shaft only: space.js keeps it visible when the rest of the lobby is hidden
  group.add(tower)
  for (let i = 0; i < segments; i++) {
    const hue = Math.round((i * 360) / segments) // one full rainbow up the tower, every segment its own color
    const side = new MeshStandardMaterial({ map: towerFaceTexture(towerLabel((i + 1) * labelStep), hue), ...PLASTIC })
    const capMat = flat(`hsl(${hue} 100% 40%)`)
    // Box material order: +x, -x, +y, -y, +z, -z.
    const seg = new Mesh(geo, [side, side, capMat, capMat, side, side])
    seg.position.set(x, sh * i + sh / 2, z)
    seg.castShadow = seg.receiveShadow = true
    tower.add(seg)
  }
  solid(x - size / 2, x + size / 2, z - size / 2, z + size / 2, sh * segments)

  // Launch pad: white rim, red disc, pulsing glow.
  const pad = new Group()
  const rim = new Mesh(new CylinderGeometry(LAUNCH_PAD.radius + 0.35, LAUNCH_PAD.radius + 0.45, 0.16, 48), flat('#ffffff'))
  rim.position.y = 0.08
  const disc = new Mesh(new CylinderGeometry(LAUNCH_PAD.radius, LAUNCH_PAD.radius, 0.2, 48), flat('#e8161c', { emissive: '#7a0006' }))
  disc.position.y = 0.1
  const ring = new Mesh(new TorusGeometry(LAUNCH_PAD.radius * 0.62, 0.07, 8, 48), new MeshBasicMaterial({ color: '#ffd0d0', transparent: true }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.21
  rim.receiveShadow = disc.receiveShadow = true
  const halo = glow('#ff4a3a', LAUNCH_PAD.radius * 3.2, 0.55)
  halo.position.y = 0.6
  pad.add(rim, disc, ring, halo)
  pad.position.set(LAUNCH_PAD.x, 0, LAUNCH_PAD.z)
  group.add(pad)

  const sign = makeLabel(
    [
      { text: 'SODA JUMP!', size: 72, fill: ['#fff35a', '#ffb000', '#ff7a00'] },
      { text: 'Step on to launch!', size: 40 },
    ],
    1.5,
  )
  sign.position.set(LAUNCH_PAD.x, 3.4, LAUNCH_PAD.z)
  group.add(sign)

  return { tower, update: (t) => {
    halo.material.opacity = 0.45 + Math.sin(t * 3) * 0.15
    // A ring ripples outward from the centre and fades at the rim.
    const phase = (t * 0.6) % 1
    ring.scale.set(0.4 + phase * 1.1, 0.4 + phase * 1.1, 1)
    ring.material.opacity = 1 - phase
  } }
}

// --- World 2 portal ---------------------------------------------------------------
// Swirl colours: [r, g, b] shader-space triples, or css colours (sRGB components passed through as-is).
const swirlVec = (c) => (typeof c === 'string' ? new Vector3(...new Color(c).convertLinearToSRGB().toArray()) : new Vector3(...c))
export const SWIRL_LOBBY = [[0.1, 0.02, 0.28], [0.5, 0.12, 0.95], [1, 0.65, 1]]
const swirlShader = (aspect, [deep, mid, hot] = SWIRL_LOBBY) => ({
  uniforms: { time: { value: 0 }, aspect: { value: aspect }, deep: { value: swirlVec(deep) }, mid: { value: swirlVec(mid) }, hot: { value: swirlVec(hot) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform float time; uniform float aspect; uniform vec3 deep; uniform vec3 mid; uniform vec3 hot; varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * 2.0;
      float r = length(p);
      float a = atan(p.y, p.x);
      float s = sin(a * 3.0 + log(r + 0.05) * 6.0 - time * 3.0);
      vec3 col = mix(deep, mid, smoothstep(-0.3, 0.9, s));
      col = mix(col, hot, smoothstep(0.35, 0.0, r) * 0.85);
      col += vec3(0.25, 0.05, 0.35) * smoothstep(0.6, 1.2, r);
      gl_FragColor = vec4(col, 1.0);
    }`,
})

// A stone arch with a swirling gateway. `o` re-skins it per world (worldScenes.js); the defaults are the lobby's World 2 portal.
export function buildPortal(group, o = {}) {
  const at = o.at ?? PORTAL
  const portal = new Group()
  const frameMat = flat(o.frame ?? '#2b3290', { roughness: 0.7 })
  const frameDark = flat(o.dark ?? '#1b1f5c', { roughness: 0.7 })
  const neon = glowMat(o.neon ?? '#ff38d6')
  const W = 3 // opening width
  const H = 3.6 // opening height up to where the arch starts
  const base = 0.45

  // Base slab with a neon lip.
  const slab = new Mesh(new BoxGeometry(6.4, base, 3.2), flat('#14152b'))
  slab.position.y = base / 2
  slab.castShadow = slab.receiveShadow = true
  const lip = new Mesh(new BoxGeometry(6.5, 0.08, 3.3), neon)
  lip.position.y = base - 0.02
  portal.add(slab, lip)

  // Pillars: stacked stone blocks, alternating shades.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const blk = new Mesh(new BoxGeometry(0.9, H / 4 - 0.04, 1.1), i % 2 ? frameDark : frameMat)
      blk.position.set(sx * (W / 2 + 0.45), base + (H / 4) * i + H / 8, 0)
      blk.castShadow = true
      portal.add(blk)
    }
    const trim = new Mesh(new BoxGeometry(0.1, H, 0.3), neon)
    trim.position.set(sx * (W / 2 + 0.03), base + H / 2, 0.1)
    portal.add(trim)
  }
  // Arch: blocks around a half circle.
  const R = W / 2 + 0.45
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI
    const blk = new Mesh(new BoxGeometry(0.9, 0.85, 1.1), i % 2 ? frameDark : frameMat)
    blk.position.set(Math.cos(a) * R, base + H + Math.sin(a) * R, 0)
    blk.rotation.z = a - Math.PI / 2
    blk.castShadow = true
    portal.add(blk)
  }
  const archTrim = new Mesh(new TorusGeometry(W / 2 + 0.03, 0.06, 6, 32, Math.PI), neon)
  archTrim.position.set(0, base + H, 0.1)
  portal.add(archTrim)

  // Swirl filling the opening (rectangle + half disc).
  const shape = new Shape()
  shape.moveTo(-W / 2, 0)
  shape.lineTo(W / 2, 0)
  shape.lineTo(W / 2, H)
  shape.absarc(0, H, W / 2, 0, Math.PI, false)
  shape.lineTo(-W / 2, 0)
  const geo = new ShapeGeometry(shape, 24)
  // ShapeGeometry UVs are raw shape coords; normalise to 0..1.
  const totalH = H + W / 2
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / W + 0.5, uv.getY(i) / totalH)
  const swirlMat = new ShaderMaterial({ ...swirlShader(W / totalH, o.swirl), side: DoubleSide })
  const swirl = new Mesh(geo, swirlMat)
  swirl.position.y = base
  portal.add(swirl)

  // Medallion on top of the arch.
  const orbMat = new ShaderMaterial(swirlShader(1, o.swirl))
  const orb = new Mesh(new CylinderGeometry(0.55, 0.55, 0.2, 32), orbMat)
  orb.rotation.x = Math.PI / 2
  orb.position.set(0, base + H + R + 0.55, 0)
  const orbRim = new Mesh(new TorusGeometry(0.58, 0.1, 8, 32), frameMat)
  orbRim.position.copy(orb.position)
  const orbGlow = glow(o.glow ?? '#b04dff', 2.4, 0.6)
  orbGlow.position.copy(orb.position)
  const innerGlow = glow(o.glow ?? '#a040ff', 4.5, 0.45)
  innerGlow.position.set(0, base + H * 0.6, 0.4)
  portal.add(orb, orbRim, orbGlow, innerGlow)

  const sign = makeLabel(
    [
      { text: o.title ?? 'Candy Cloud', size: 68, fill: ['#ffe25a', '#ffaa1c', '#ff7a12'] },
      { text: o.sub ?? 'Reach 20K studs', size: 46 },
    ],
    1.8,
  )
  sign.position.set(0, base + H + R + 1.5, 0)
  portal.add(sign)

  portal.position.set(at.x, 0, at.z)
  group.add(portal)
  solid(at.x - 3.2, at.x + 3.2, at.z - 1.6, at.z + 1.6, base)
  for (const sx of [-1, 1]) {
    const cx = at.x + sx * (W / 2 + 0.45)
    solid(cx - 0.45, cx + 0.45, at.z - 0.55, at.z + 0.55, base + H + R)
  }

  return (t) => {
    swirlMat.uniforms.time.value = t
    orbMat.uniforms.time.value = -t
    innerGlow.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.1
  }
}

// --- Blocky R6-style figure (the Void Soda NPC) -----------------------------------------
function blockyFigure({ skin, shirt, pants, hair, trim }) {
  const fig = new Group()
  const part = (w, h, d, mat, x, y, z) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    fig.add(m)
    return m
  }
  const skinM = flat(skin)
  const shirtM = flat(shirt)
  const pantsM = flat(pants)
  const hairM = flat(hair, { roughness: 0.8 })
  const trimM = glowMat(trim)
  part(0.38, 0.8, 0.38, pantsM, -0.2, 0.4, 0)
  part(0.38, 0.8, 0.38, pantsM, 0.2, 0.4, 0)
  part(0.78, 0.8, 0.4, shirtM, 0, 1.2, 0)
  part(0.8, 0.08, 0.42, trimM, 0, 1.0, 0)
  part(0.06, 0.8, 0.42, trimM, 0, 1.2, 0.0)
  part(0.36, 0.8, 0.38, shirtM, -0.58, 1.2, 0)
  // Right arm raised forward, holding a bottle of void soda.
  const arm = part(0.36, 0.8, 0.38, shirtM, 0.58, 1.25, 0.2)
  arm.rotation.x = -0.9
  part(0.37, 0.18, 0.39, skinM, -0.58, 0.82, 0)
  const head = part(0.46, 0.46, 0.46, skinM, 0, 1.85, 0)
  // Simple face: two eyes and a smile.
  const face = flat('#1a1a1a')
  part(0.06, 0.1, 0.02, face, -0.1, 1.9, 0.235)
  part(0.06, 0.1, 0.02, face, 0.1, 1.9, 0.235)
  part(0.18, 0.04, 0.02, face, 0, 1.76, 0.235)
  // Messy orange hair: a cap plus a few spikes.
  part(0.52, 0.18, 0.52, hairM, 0, 2.12, -0.02)
  part(0.5, 0.3, 0.12, hairM, 0, 1.95, -0.25)
  for (const [x, z, r] of [[-0.15, 0.1, 0.3], [0.15, 0.05, -0.3], [0, -0.15, 0], [0.18, -0.12, -0.5]]) {
    const spike = new Mesh(new ConeGeometry(0.13, 0.32, 5), hairM)
    spike.position.set(x, 2.3, z)
    spike.rotation.set(0.3, 0, r)
    fig.add(spike)
  }
  const bottle = new Mesh(new CylinderGeometry(0.11, 0.13, 0.42, 12), glowMat('#9b2cff'))
  bottle.position.set(0.58, 1.35, 0.72)
  const cap = new Mesh(new CylinderGeometry(0.06, 0.06, 0.1, 10), flat('#1b1b1b'))
  cap.position.set(0.58, 1.6, 0.72)
  fig.add(bottle, cap)
  head.userData.isHead = true
  return fig
}

function buildVoidNpc(group) {
  const npc = new Group()
  const padTop = 0.22
  const pad = new Mesh(new CylinderGeometry(1.6, 1.7, padTop, 40), flat('#241433'))
  pad.position.y = padTop / 2
  pad.receiveShadow = true
  const padRing = new Mesh(new TorusGeometry(1.62, 0.06, 8, 48), glowMat('#b13cff'))
  padRing.rotation.x = -Math.PI / 2
  padRing.position.y = padTop
  npc.add(pad, padRing)

  const fig = blockyFigure({ skin: '#f3c38f', shirt: '#17121f', pants: '#1d1d24', hair: '#e86a1c', trim: '#a93cff' })
  fig.position.y = padTop
  fig.scale.setScalar(1.05)
  npc.add(fig)
  const aura = glow('#9d3cff', 3.4, 0.45)
  aura.position.y = 1.4
  npc.add(aura)

  const { kind, name, price } = VOID_SODA
  const signLines = () => {
    const last = {
      equipped: { text: 'EQUIPPED', size: 44, fill: ['#e4ff5a', '#7dff2a'], outline: '#0b5a12', stroke: 12 },
      owned: { text: 'OWNED', size: 44, outline: '#0c3fa8', stroke: 12 },
      next: { text: `${short(price)} Wins`, size: 44, fill: '#ffe21a', stroke: 12 },
    }[sodaStatus(kind)]
    return [
      { text: name, size: 64, fill: ['#ff6bff', '#d025ff', '#8a1bff'] },
      { text: 'Always 200% Better', size: 40, fill: '#7dff3a', outline: '#3a0a6a' },
      last,
    ]
  }
  const sign = makeLabel(signLines(), 1.5)
  sign.position.y = 2.9
  npc.add(sign)
  let signStatus = sodaStatus(kind)
  subscribe(() => {
    const status = sodaStatus(kind)
    if (status === signStatus) return
    signStatus = status
    sign.userData.setLines(signLines())
  })

  // The Void Soda itself hovers beside the NPC like the display cans: hold E on the pad to buy / equip it.
  const canX = 1.3
  const canZ = 1.0
  const can = sodaItem(kind)
  can.position.set(canX, padTop + 0.9, canZ)
  can.scale.setScalar(1.1)
  npc.add(can)
  const canAura = glow('#9d3cff', 2.2, 0.4)
  canAura.position.set(canX, padTop + 1.4, canZ)
  npc.add(canAura)
  addZone({
    key: `soda:${kind}`,
    x: VOID_NPC.x + canX,
    y: padTop,
    z: VOID_NPC.z + canZ,
    prompt: () => {
      const status = sodaStatus(kind)
      if (status === 'equipped') return { text: `${name} equipped`, hold: false }
      if (status === 'owned') return { text: `Equip ${name}`, hold: true }
      return state.wins >= price ? { text: `Buy ${name} - ${short(price)} Wins`, hold: true } : { text: `Need ${short(price)} Wins`, hold: false }
    },
    run: () => {
      const bought = sodaStatus(kind) === 'next'
      if (bought) {
        if (state.wins < price) return `Need ${short(price)} Wins`
        state.wins -= price
        state.owned.add(kind)
      }
      state.equipped = kind
      notify()
      return bought ? `${name} unlocked & equipped!` : `${name} equipped!`
    },
  })

  npc.position.set(VOID_NPC.x, 0, VOID_NPC.z)
  group.add(npc)
  solid(VOID_NPC.x - 0.6, VOID_NPC.x + 0.6, VOID_NPC.z - 0.4, VOID_NPC.z + 0.4, 2.5)

  return (t) => {
    can.position.y = padTop + 0.95 + Math.sin(t * 2) * 0.08
    can.rotation.set(Math.sin(t * 1.3) * 0.1, t * 0.8, Math.cos(t * 1.1) * 0.14)
    fig.position.y = padTop + Math.sin(t * 1.6) * 0.03
    aura.material.opacity = 0.35 + Math.sin(t * 2.5) * 0.12
  }
}

// --- Soda display (east wall) --------------------------------------------------------

// Box whose top face slopes down to the floor at one Z end (dir -1: low at -Z, +1: low at +Z).
function rampBox(w, h, d, color, dir) {
  const map = studTexture(color)
  const geo = studBox(w, h, d, map.userData.tileMetres)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0 && Math.sign(pos.getZ(i)) === dir) pos.setY(i, -h / 2 + 0.02)
  }
  geo.computeVertexNormals()
  const mesh = new Mesh(geo, new MeshStandardMaterial({ map, ...PLASTIC }))
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

// Per-item sparkle styling: a starburst behind Orange Pop, twinkles round the rest.
const ITEM_FX = {
  orange: { rays: true, twinkles: 3, color: '#ffffff' },
  ufo: { twinkles: 5, color: '#ffe266' },
  trophy: { twinkles: 5, color: '#ffe680' },
  rainbow: { twinkles: 3, color: '#ffffff' },
}

function buildDisplay(group) {
  const { minZ, maxZ, maxX, ramp, front, back } = DISPLAY
  const red = '#f2261c'
  const redGlow = '#6b0a05' // emissive fill keeps the platform flat and bright, as in the reference
  const cyan = '#3fe0ff'
  const cz = (minZ + maxZ) / 2
  // Platform pieces take no shadows: the reference shows none on the red.
  const plat = (m) => {
    m.castShadow = m.receiveShadow = false
    return m
  }
  const tier = (t, tMinZ, tMaxZ, tRamp) => {
    const w = maxX - t.minX
    const x = (t.minX + maxX) / 2
    const flatLen = tMaxZ - tMinZ - tRamp * 2
    group.add(plat(brick(w, t.top, flatLen, red, x, 0, (tMinZ + tMaxZ) / 2, { emissive: redGlow })))
    for (const dir of [-1, 1]) {
      const r = plat(rampBox(w, t.top, tRamp, red, dir))
      r.material.emissive.set(redGlow)
      const rz = dir < 0 ? tMinZ + tRamp / 2 : tMaxZ - tRamp / 2
      r.position.set(x, t.top / 2, rz)
      group.add(r)
      // Walkable steps stand in for the slope: each no taller than the player can step up.
      const n = Math.ceil(t.top / 0.5)
      const stepLen = tRamp / n
      for (let k = 1; k <= n; k++) {
        const z0 = dir < 0 ? tMinZ + (k - 1) * stepLen : tMaxZ - k * stepLen
        solid(t.minX, maxX, z0, z0 + stepLen, (t.top * (k - 0.5)) / n)
      }
    }
  }
  tier(front, minZ, maxZ, ramp)
  tier(back, back.minZ, back.maxZ, back.ramp)

  // Thick yellow trim along the front of the platform, wrapping both ends.
  const trim = (w, d, x, z) => group.add(plat(brick(w, 0.1, d, '#ffe81a', x, 0, z, { studs: false, collide: false })))
  trim(0.7, maxZ - minZ, front.minX - 0.35, cz)
  const fw = maxX - front.minX
  trim(fw + 0.7, 0.7, front.minX - 0.35 + (fw + 0.7) / 2, minZ - 0.35)
  trim(fw + 0.7, 0.7, front.minX - 0.35 + (fw + 0.7) / 2, maxZ + 0.35)

  const items = []
  const signs = []
  const twinkles = []
  const rays = []
  const place = (list, t, labelHeight, labelSize, labelWorldHeight) => {
    list.forEach(({ kind, name, reward, price }, i) => {
      const x = t.itemX
      const z = t.z[i]
      const gold = kind === 'trophy'
      const pad = new Mesh(new BoxGeometry(2.6, 0.08, 2.6), flat(gold ? '#38e8a8' : cyan, { emissive: gold ? '#0f9a70' : '#0f8fb0' }))
      pad.position.set(x, t.top + 0.04, z)
      pad.receiveShadow = true
      group.add(pad)
      const item = sodaItem(kind)
      item.scale.setScalar(1.2)
      item.position.set(x, t.top, z)
      item.userData.baseY = t.top + 0.08
      item.userData.phase = i * 1.7 + t.top
      group.add(item)
      items.push(item)
      const signLines = () => {
        const status = sodaStatus(kind)
        const big = labelSize + 6
        const last = {
          equipped: { text: 'EQUIPPED', size: big, fill: ['#e4ff5a', '#7dff2a'], outline: '#0b5a12', stroke: 12 },
          owned: { text: 'OWNED', size: big, outline: '#0c3fa8', stroke: 12 },
          next: { text: `${short(price)} Wins`, size: big, fill: '#ffe21a', stroke: 12 },
          locked: { text: 'LOCKED', size: big, stroke: 12 },
        }[status]
        return [{ text: name, size: labelSize }, { text: reward, size: labelSize }, last]
      }
      const sign = makeLabel(signLines(), labelWorldHeight)
      sign.position.set(x, t.top + labelHeight, z)
      group.add(sign)
      signs.push({ kind, sign, signLines, status: sodaStatus(kind) })

      // Stand on the pad and hold E to equip this soda (or buy it, if it is the next one to unlock).
      addZone({
        key: `soda:${kind}`,
        x,
        y: t.top,
        z,
        prompt: () => {
          const status = sodaStatus(kind)
          if (status === 'equipped') return { text: `${name} equipped`, hold: false }
          if (status === 'owned') return { text: `Equip ${name}`, hold: true }
          if (status === 'locked') return { text: 'Locked - unlock the previous soda first', hold: false }
          return state.wins >= price ? { text: `Buy ${name} - ${short(price)} Wins`, hold: true } : { text: `Need ${short(price)} Wins`, hold: false }
        },
        run: () => {
          const bought = sodaStatus(kind) === 'next'
          if (bought) {
            if (state.wins < price) return `Need ${short(price)} Wins`
            state.wins -= price
            state.owned.add(kind)
          }
          state.equipped = kind
          notify()
          return bought ? `${name} unlocked & equipped!` : `${name} equipped!`
        },
      })

      const fx = ITEM_FX[kind] ?? { twinkles: 2, color: '#ffffff' }
      if (fx.rays) {
        const burst = fxSprite(raysTex(), '#fff2c0', 4.6, 1)
        burst.position.set(x, t.top + 0.85, z)
        group.add(burst)
        rays.push(burst)
      }
      for (let k = 0; k < fx.twinkles; k++) {
        const star = fxSprite(starTex(), fx.color, 0.85)
        group.add(star)
        twinkles.push({ star, x, z, y: t.top, phase: i * 2.3 + k * 1.9, ring: 0.7 + (k % 3) * 0.25, k })
      }
    })
  }
  place(SODA_ITEMS.front, front, 1.9, 40, 1.2)
  place(SODA_ITEMS.back, back, 2.5, 38, 1.1)
  // Repaint a sign whenever its status (equipped / owned / next / locked) changes.
  subscribe(() => {
    for (const s of signs) {
      const status = sodaStatus(s.kind)
      if (status === s.status) continue
      s.status = status
      s.sign.userData.setLines(s.signLines())
    }
  })

  return (t) => {
    for (const it of items) {
      const p = it.userData.phase
      // Hover and tilt gently rather than spinning.
      it.rotation.set(Math.sin(t * 1.3 + p) * 0.1, Math.sin(t * 0.7 + p) * 0.5, Math.cos(t * 1.1 + p) * 0.14)
      it.position.y = it.userData.baseY + 0.12 + Math.sin(t * 2 + p) * 0.08
    }
    for (const r of rays) {
      r.material.rotation = t * 0.5
      r.material.opacity = 0.75 + Math.sin(t * 5) * 0.15
    }
    for (const w of twinkles) {
      const a = t * 0.6 + w.phase
      w.star.position.set(w.x + Math.cos(a) * w.ring * 1.2, w.y + 0.5 + ((t * 0.3 + w.k * 0.21 + w.phase) % 1) * 1.4, w.z + Math.sin(a) * w.ring * 1.2)
      w.star.material.opacity = Math.max(0, Math.sin(t * 4 + w.phase * 2))
    }
  }
}

// --- West shop: soda multiplier treadmills -------------------------------------------------
// Treadmills, south to north: colours, billboard lines [text, fill, robux?], console height, optional effect.
const TREADMILLS = [
  { pillar: '#56649c', lintel: '#45d6ff', h: 2.4, lines: [['x1 Soda', ['#8fe3ff', '#3aa8ff']], ['FREE', ['#e4ff5a', '#7dff2a']]] },
  { pillar: '#3cd13c', lintel: '#7dff3a', h: 2.4, lines: [['x2 Soda', ['#f4ff6a', '#7dff2a']], ['Rebirth 3', ['#f4ff6a', '#b6ff2a']]] },
  { pillar: '#e8281c', lintel: '#ff4a2a', h: 2.4, lines: [['x4 Soda', ['#ffb03a', '#ff4a1a']], ['Rebirth 4', ['#f4ff6a', '#b6ff2a']]], fx: 'fire' },
  { pillar: '#22b83c', lintel: '#15151a', h: 3.2, lines: [['x8 Soda', ['#b6ff5a', '#3ad13a']], ['Rebirth 5', ['#e7ff7a', '#7dff3a']]], fx: 'pixels' },
  { pillar: '#ffd21a', lintel: '#ffb800', h: 3, lines: [['x16 Soda', ['#fff07a', '#ffc21a', '#ff9a0a']], ['Rebirth 6', ['#e7ff7a', '#ffd21a']]], fx: 'gold' },
  { pillar: '#2a9cff', lintel: '#1f5fe0', h: 3.4, lines: [['x32 Soda', ['#8fe3ff', '#3aa8ff', '#1a6cff']], ['Rebirth 7', ['#e7ff7a', '#7dff3a']]], fx: 'storm' },
]

const BELT = { length: 10, width: 4.4, rail: 2.4, consoleX: -4.4, height: 0.2 }

let beltTex = null
// Dark belt with a light tread band every metre across it.
function beltTexture() {
  if (beltTex) return beltTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#161a3c'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#262e66'
  g.fillRect(0, 0, 9, 64)
  beltTex = new CanvasTexture(c)
  beltTex.wrapS = beltTex.wrapT = RepeatWrapping
  beltTex.repeat.set(BELT.length, 1)
  beltTex.colorSpace = SRGBColorSpace
  beltTex.anisotropy = 8
  return beltTex
}

// --- Treadmill effects: textures + sprites ----------------------------------------------
const fxCache = {}
function fxTexture(name, w, h, draw) {
  if (fxCache[name]) return fxCache[name]
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  fxCache[name] = t
  return t
}

// Teardrop-ish flame: white-hot core fading through yellow and orange to nothing.
const flameTex = () =>
  fxTexture('flame', 128, 192, (g, w, h) => {
    g.translate(w / 2, h * 0.58)
    g.scale(1, 1.45)
    const r = w * 0.48
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.28, 'rgba(255,236,140,0.95)')
    grad.addColorStop(0.62, 'rgba(255,150,40,0.55)')
    grad.addColorStop(1, 'rgba(255,70,0,0)')
    g.fillStyle = grad
    g.fillRect(-r, -r * 1.3, r * 2, r * 2.6)
  })

// Four-point sparkle with a soft core.
const starTex = () =>
  fxTexture('star', 128, 128, (g, w, h) => {
    const c = w / 2
    const grad = g.createRadialGradient(c, c, 0, c, c, c * 0.5)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    for (const horizontal of [true, false]) {
      const lg = horizontal ? g.createLinearGradient(0, c, w, c) : g.createLinearGradient(c, 0, c, h)
      lg.addColorStop(0, 'rgba(255,255,255,0)')
      lg.addColorStop(0.5, 'rgba(255,255,255,1)')
      lg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = lg
      if (horizontal) g.fillRect(0, c - 2, w, 4)
      else g.fillRect(c - 2, 0, 4, h)
    }
  })

// Spiky starburst: long and short rays alternating around a hot centre.
const raysTex = () =>
  fxTexture('rays', 256, 256, (g, w) => {
    const c = w / 2
    g.translate(c, c)
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, c)
    grad.addColorStop(0, 'rgba(255,255,220,1)')
    grad.addColorStop(0.5, 'rgba(255,190,40,0.8)')
    grad.addColorStop(1, 'rgba(255,120,0,0)')
    g.fillStyle = grad
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const len = i % 2 ? c * 0.62 : c * 0.98
      const half = 0.1
      g.beginPath()
      g.moveTo(Math.cos(a - half) * 8, Math.sin(a - half) * 8)
      g.lineTo(Math.cos(a) * len, Math.sin(a) * len)
      g.lineTo(Math.cos(a + half) * 8, Math.sin(a + half) * 8)
      g.closePath()
      g.fill()
    }
    g.beginPath()
    g.arc(0, 0, c * 0.3, 0, Math.PI * 2)
    g.fill()
  })

// Four jagged lightning bolts with a wide blue glow and a white core; the bolt flips between them.
const lightningTextures = () =>
  [0, 1, 2, 3].map((v) =>
    fxTexture(`lightning${v}`, 128, 512, (g, w, h) => {
      let seed = v * 131 + 7
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
      const pts = []
      for (let y = h; y >= 0; y -= 40) pts.push([w / 2 + (y === h ? 0 : (rnd() - 0.5) * 46), y])
      const stroke = (lw, col, blur) => {
        g.lineJoin = g.lineCap = 'round'
        g.shadowColor = 'rgba(60,150,255,1)'
        g.shadowBlur = blur
        g.strokeStyle = col
        g.lineWidth = lw
        g.beginPath()
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
        g.stroke()
      }
      stroke(30, 'rgba(40,120,255,0.55)', 40)
      stroke(12, 'rgba(150,210,255,0.95)', 18)
      stroke(4, '#ffffff', 6)
    }),
  )

// Additive billboard; height is size * stretch. Callers animate scale/position/opacity.
function fxSprite(tex, color, size, opacity = 1, stretch = 1) {
  const s = new Sprite(new SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, fog: false }))
  s.scale.set(size, size * stretch, 1)
  return s
}

const cubeGeo = new BoxGeometry(0.26, 0.26, 0.26)

// Effects for one treadmill, in its local frame (belt along X, console at consoleX).
// Particles are sprites/cubes recycled on a loop; lighting is a tinted point light
// that flickers with the effect.
function treadmillFx(g, spec, { rail, H, consoleX }, updaters) {
  const addLight = (color, intensity, x, y, z) => {
    const light = new PointLight(color, intensity, 14, 2)
    light.position.set(x, y, z)
    g.add(light)
    return light
  }
  const hash = (i, m) => ((i * 37 + 11) % m) / m // stable pseudo-random 0..1 per index

  if (spec.fx === 'fire') {
    const flames = Array.from({ length: 18 }, () => {
      const f = fxSprite(flameTex(), '#ffffff', 1, 0.9)
      f.center.set(0.5, 0.2)
      g.add(f)
      return f
    })
    const embers = Array.from({ length: 14 }, () => {
      const e = fxSprite(starTex(), '#ffb040', 0.35)
      g.add(e)
      return e
    })
    const floor = glow('#ff5a10', 7, 0.5)
    floor.position.set(-2, 0.5, 0)
    g.add(floor)
    const light = addLight('#ff6a20', 40, -2, 1.5, 0)
    updaters.push((t) => {
      flames.forEach((f, i) => {
        const p = (t * 0.9 + i / 18) % 1
        const w = 1.5 * (1 - p) + 0.35
        f.scale.set(w, w * 2.1, 1)
        f.position.set(-3.6 + hash(i, 11) * 3.4, 0.5 + p * 1.9, (hash(i + 5, 9) - 0.5) * 3.4)
        f.material.opacity = 0.95 * Math.sin(Math.min(p * 1.2, 1) * Math.PI * 0.5) * (1 - p * 0.6)
        f.material.color.setHSL(0.03 + 0.09 * (1 - p), 1, 0.55 + 0.2 * (1 - p))
      })
      embers.forEach((e, i) => {
        const p = (t * 0.6 + i * 0.071) % 1
        e.position.set(-3.8 + hash(i, 13) * 4.2 + Math.sin(t * 3 + i) * 0.3, 0.4 + p * 3.2, (hash(i + 3, 9) - 0.5) * 3.2)
        e.material.opacity = 1 - p
      })
      floor.material.opacity = 0.45 + Math.sin(t * 11) * 0.1
      light.intensity = 32 + Math.sin(t * 17) * 8 + Math.sin(t * 9.3) * 6
    })
  } else if (spec.fx === 'pixels') {
    // Glowing green voxels swelling and shrinking above the belt.
    const mats = ['#4dff4a', '#c8ff80']
    const cubes = Array.from({ length: 36 }, (_, i) => {
      const m = new Mesh(cubeGeo, new MeshBasicMaterial({ color: mats[i % 2], transparent: true, toneMapped: false }))
      g.add(m)
      return m
    })
    const sparks = Array.from({ length: 8 }, () => {
      const s = fxSprite(starTex(), '#7dff7a', 0.5)
      g.add(s)
      return s
    })
    const haze = glow('#2aff40', 6, 0.35)
    haze.position.set(0, 0.5, 0)
    g.add(haze)
    const light = addLight('#3aff5a', 28, 0, 1.4, 0)
    updaters.push((t) => {
      cubes.forEach((c, i) => {
        const p = (t * 0.25 + i / 36) % 1
        const k = 0.7 + 0.8 * Math.sin(p * Math.PI)
        c.position.set(-3 + hash(i, 17) * 5.5, 0.35 + p * 2.4, (hash(i + 7, 11) - 0.5) * 3.4)
        c.scale.setScalar(k)
        c.rotation.set(t * 0.8 + i, t * 1.1 + i, 0)
        c.material.opacity = 0.9 * Math.sin(p * Math.PI)
      })
      sparks.forEach((s, i) => {
        s.position.set(-3 + hash(i, 7) * 6, 0.6 + ((t * 0.5 + i * 0.13) % 1) * 2.4, (hash(i + 2, 5) - 0.5) * 3)
        s.material.opacity = Math.max(0, Math.sin(t * 5 + i * 2))
      })
      haze.material.opacity = 0.3 + Math.sin(t * 3) * 0.08
      light.intensity = 26 + Math.sin(t * 6) * 5
    })
  } else if (spec.fx === 'gold') {
    // Flame streams racing along both rails, a spinning starburst behind the sign, twinkling stars.
    const perRail = 14
    const flames = []
    for (const sz of [-rail, rail]) {
      for (let i = 0; i < perRail; i++) {
        const f = fxSprite(flameTex(), '#ffd23a', 1.1, 0.9, 2.2)
        f.center.set(0.5, 0.15)
        g.add(f)
        flames.push({ f, sz, i })
      }
    }
    const stars = Array.from({ length: 10 }, () => {
      const s = fxSprite(starTex(), '#ffe680', 0.5)
      g.add(s)
      return s
    })
    const burst = fxSprite(raysTex(), '#ffffff', 9, 0.9)
    burst.position.set(consoleX + 0.5, H + 1.3, 0)
    g.add(burst)
    const aura = glow('#ffc21a', 7, 0.5)
    aura.position.set(0, 1, 0)
    g.add(aura)
    const light = addLight('#ffc030', 45, 0, 1.5, 0)
    updaters.push((t) => {
      flames.forEach(({ f, sz, i }) => {
        const p = (t * 0.6 + i / perRail) % 1
        f.position.set(-4.3 + p * 8.6, 0.45 + Math.sin(t * 9 + i) * 0.06, sz)
        f.material.opacity = 0.95 * Math.pow(Math.sin(p * Math.PI), 0.7)
      })
      stars.forEach((s, i) => {
        s.position.set(-4 + hash(i, 9) * 8, 0.7 + hash(i + 4, 7) * 2, (hash(i + 1, 11) - 0.5) * 4.6)
        s.material.opacity = Math.max(0, Math.sin(t * 4 + i * 1.9))
      })
      burst.material.rotation = t * 0.3
      burst.material.opacity = 0.8 + Math.sin(t * 6) * 0.15
      light.intensity = 40 + Math.sin(t * 13) * 8
    })
  } else if (spec.fx === 'storm') {
    // Wide glowing lightning leaning out from the console, with white shards swirling round it.
    const texs = lightningTextures()
    const mats = [0, 1].map(
      () => new MeshBasicMaterial({ map: texs[0], transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false }),
    )
    const bolts = new Group()
    mats.forEach((m, i) => {
      const plane = new Mesh(new PlaneGeometry(3.4, 14), m)
      plane.position.y = 7
      plane.rotation.y = (i * Math.PI) / 2
      bolts.add(plane)
    })
    bolts.position.set(consoleX + 0.4, 0.3, 0.4)
    bolts.rotation.z = -0.2
    g.add(bolts)
    const shards = Array.from({ length: 16 }, () => {
      const s = fxSprite(starTex(), '#cfe6ff', 0.4)
      g.add(s)
      return s
    })
    const halo = glow('#3a8cff', 8, 0.5)
    halo.position.set(consoleX + 0.6, 1.4, 0)
    g.add(halo)
    const light = addLight('#4a8cff', 60, consoleX + 1, 2.5, 0.5)
    let wait = 0
    updaters.push((t, dt) => {
      wait -= dt
      if (wait <= 0) {
        wait = 0.07 + Math.random() * 0.08
        const map = texs[Math.floor(Math.random() * 4)]
        for (const m of mats) {
          m.map = map
          m.opacity = 0.7 + Math.random() * 0.3
        }
      }
      shards.forEach((s, i) => {
        const a = t * (1.5 + (i % 3) * 0.4) + i
        const r = 0.8 + (i % 4) * 0.35
        s.position.set(consoleX + 0.8 + Math.cos(a) * r * 1.4, 0.8 + ((t * 0.8 + i * 0.13) % 1) * 3.5, 0.4 + Math.sin(a) * r)
        s.scale.setScalar(0.35 + 0.35 * Math.abs(Math.sin(t * 7 + i)))
        s.material.rotation = t * 3 + i
        s.material.opacity = Math.max(0, Math.sin(t * 6 + i * 1.7))
      })
      halo.material.opacity = 0.45 + Math.sin(t * 8) * 0.15
      light.intensity = 55 + Math.sin(t * 21) * 15
    })
  } else {
    // Quiet units: a soft glow on the console and a few sparkles drifting up.
    const glowTop = glow(spec.lintel, 3.5, 0.5)
    glowTop.position.set(consoleX + 0.3, H + 0.3, 0)
    g.add(glowTop)
    const stars = Array.from({ length: 6 }, () => {
      const s = fxSprite(starTex(), spec.lintel, 0.4)
      g.add(s)
      return s
    })
    const light = addLight(spec.lintel, 12, consoleX + 1, H, 0)
    updaters.push((t) => {
      stars.forEach((s, i) => {
        const p = (t * 0.3 + i / 6) % 1
        s.position.set(consoleX + 0.5 + hash(i, 7) * 3, 0.5 + p * 2.2, (hash(i + 3, 5) - 0.5) * 3.6)
        s.material.opacity = Math.sin(p * Math.PI)
      })
      glowTop.material.opacity = 0.45 + Math.sin(t * 2 + spec.h) * 0.1
      light.intensity = 11 + Math.sin(t * 2) * 2
    })
  }
}

// One treadmill, built along +X (belt runs from the wall out into the arena)
// with the console arch at the wall end; sits on the platform at (x, top, z).
function treadmill(group, spec, x, z, top, updaters, index) {
  const g = new Group()
  const { length, width, rail, consoleX, height } = BELT
  const H = spec.h
  const noHit = { collide: false }

  g.add(brick(length, height, width, '#161a3c', 0, 0, 0, { studs: false, collide: false }))
  // Own texture clone per belt so only the belt being run on scrolls (towards +X, under a runner facing the console).
  const tex = beltTexture().clone()
  tex.needsUpdate = true
  const belt = new Mesh(new PlaneGeometry(length, width), new MeshStandardMaterial({ map: tex, ...PLASTIC }))
  updaters.push((t, dt) => {
    if (runningBelt() === index || remoteBelts.has(index)) tex.offset.x = (tex.offset.x - player.moveSpeed * dt) % 1 // one tile = 1 m
  })
  belt.rotation.x = -Math.PI / 2
  belt.position.y = height + 0.01
  belt.receiveShadow = true
  g.add(belt)
  solid(x - length / 2, x + length / 2, z - width / 2, z + width / 2, top + height)

  for (const sz of [-rail, rail]) {
    g.add(brick(length + 0.2, 0.45, 0.5, spec.pillar, 0, 0, sz, noHit))
    g.add(brick(0.7, H, 0.7, spec.pillar, consoleX, 0, sz, noHit))
    solid(x + consoleX - 0.35, x + consoleX + 0.35, z + sz - 0.35, z + sz + 0.35, top + H)
  }
  g.add(brick(0.4, 1.1, width - 0.4, '#14173a', consoleX, H - 1.1, 0, { studs: false, collide: false }))
  g.add(brick(0.9, 0.55, rail * 2 + 0.9, spec.lintel, consoleX, H, 0, noHit))

  const sign = makeLabel(
    spec.lines.map(([text, fill, robux]) => ({ text, size: 72, stroke: 16, fill, robux, robuxColor: '#7dff3a' })),
    2.1,
    { onTop: true },
  )
  sign.position.set(consoleX, H + 0.8, 0)
  g.add(sign)

  const tint = glow(spec.pillar, 5, 0.3)
  tint.position.set(consoleX + 1, 1.2, 0)
  g.add(tint)

  treadmillFx(g, spec, { rail, H, consoleX }, updaters)

  g.position.set(x, top, z)
  group.add(g)
}

// The six treadmills on their platform (west wall); `theme` themes the platform + trim (worldShop.js).
export function buildShop(group, { platform = '#f2261c', trimColor = '#ffd21a' } = {}) {
  const { minX, maxX, minZ, maxZ, top, ramp, gateX, gateZ } = SHOP
  const red = platform
  const w = maxX - minX
  const cx = (minX + maxX) / 2
  const flatLen = maxZ - minZ - ramp * 2
  group.add(brick(w, top, flatLen, red, cx, 0, (minZ + maxZ) / 2))
  if (ramp > 0) {
    for (const dir of [-1, 1]) {
      const r = rampBox(w, top, ramp, red, dir)
      const rz = dir < 0 ? minZ + ramp / 2 : maxZ - ramp / 2
      r.position.set(cx, top / 2, rz)
      group.add(r)
      solid(minX, maxX, rz - ramp / 2, rz + ramp / 2, top / 2)
    }
  }
  // Yellow trim wraps the arena side and both ends of the platform.
  const trim = (bw, bd, bx, bz) => group.add(brick(bw, 0.14, bd, trimColor, bx, 0, bz, { studs: false, collide: false }))
  trim(0.35, maxZ - minZ + 0.7, maxX + 0.17, (minZ + maxZ) / 2)
  trim(w, 0.35, cx, minZ - 0.17)
  trim(w, 0.35, cx, maxZ + 0.17)

  const updaters = []
  TREADMILLS.forEach((spec, i) => treadmill(group, spec, gateX, gateZ[i], top, updaters, i))
  return (t, dt) => updaters.forEach((u) => u(t, dt))
}

// --- South wall: leaderboards ---------------------------------------------
const FONT = 'Fredoka, "Arial Rounded MT Bold", sans-serif'

// Canvas texture painted now and again once Fredoka has loaded; `draw` must paint the whole canvas.
function paintedTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  const paint = () => {
    g.clearRect(0, 0, w, h)
    draw(g, w, h)
    tex.needsUpdate = true
  }
  paint()
  document.fonts?.load(`700 40px Fredoka`).then(paint, () => {})
  tex.userData.repaint = paint
  return tex
}

function outlinedText(g, text, x, y, size, fill, align = 'center', outline = '#000') {
  g.font = `700 ${size}px ${FONT}`
  g.textAlign = align
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = Math.max(4, size * 0.16)
  g.strokeStyle = outline
  g.strokeText(text, x, y)
  g.fillStyle = fill
  g.fillText(text, x, y)
}

// Placeholder standings, shown until the server's leaderboard arrives (net.js) or while offline.
const TOP_SODA = [
  ['SodaKing', '1.94Qd'], ['FizzyBoi', '1.80Qd'], ['Bubblez', '862Qa'], ['ColaCrusher', '700Qa'],
  ['Rgj2103', '409Qa'], ['PopRocket', '160Qa'], ['ShakeMaster', '9.56Qa'], ['LemonLord', '2.56Qa'],
]
const TOP_REBIRTHS = [
  ['ShakeMaster', '681'], ['SodaKing', '669'], ['Rgj2103', '652'], ['FizzyBoi', '632'],
  ['PopRocket', '601'], ['Bubblez', '586'], ['ColaCrusher', '565'], ['LemonLord', '565'],
]

const BOARD_ROWS = 8 // backend LEADERBOARD_ROWS

// rows: [[name, value]]; setRows([{ name, value, me }]) (board.userData) repaints with live standings, `me` highlights the viewer.
function leaderboard(title, placeholder, { frame, header, rowFill, rowEdge }) {
  const board = new Group()
  let rows = placeholder.map(([name, value]) => ({ name, value }))
  const noHit = { collide: false }
  board.add(brick(7.6, 0.6, 1.4, frame, 0, 0, 0, noHit))
  board.add(brick(6.4, 6.0, 0.8, frame, 0, 0.6, 0, noHit))
  board.add(brick(7.8, 1.3, 1.0, header, 0, 6.6, 0, noHit))
  for (const sx of [-1, 1]) board.add(brick(0.8, 0.7, 1.0, header, sx * 4.2, 7.2, 0, noHit))

  const titleTex = paintedTexture(512, 96, (g, w, h) => outlinedText(g, title, w / 2, h / 2 + 2, 58, '#ffffff'))
  const titlePlane = new Mesh(new PlaneGeometry(6.8, 1.275), new MeshBasicMaterial({ map: titleTex, transparent: true }))
  titlePlane.position.set(0, 7.25, 0.52)

  const panelTex = paintedTexture(512, 560, (g, w, h) => {
    const rowH = h / BOARD_ROWS
    rows.slice(0, BOARD_ROWS).forEach(({ name, value, me }, i) => {
      const y = i * rowH
      g.fillStyle = me ? '#1f8a2a' : rowEdge
      g.fillRect(0, y + 3, w, rowH - 6)
      g.fillStyle = me ? '#6cff5a' : rowFill
      g.fillRect(6, y + 9, w - 12, rowH - 18)
      const mid = y + rowH / 2
      outlinedText(g, `#${i + 1}`, 18, mid, 34, '#ffffff', 'left')
      outlinedText(g, name.length > 13 ? `${name.slice(0, 12)}…` : name, 92, mid, 28, '#ffffff', 'left')
      outlinedText(g, value, w - 18, mid, 30, '#ffffff', 'right')
    })
  })
  const panel = new Mesh(new PlaneGeometry(5.2, 5.4), new MeshBasicMaterial({ map: panelTex }))
  panel.position.set(0, 3.6, 0.41)
  board.add(titlePlane, panel)
  board.userData.setRows = (next) => {
    rows = next
    panelTex.userData.repaint()
  }
  return board
}

function buildSouth(group) {
  const { boardZ, topSodaX, topRebirthsX } = SOUTH
  const boards = [
    [topSodaX, leaderboard('Top Soda', TOP_SODA, { frame: '#ff9a1a', header: '#ffd21a', rowFill: '#ffe23a', rowEdge: '#ff8a10' })],
    [topRebirthsX, leaderboard('Top Rebirths', TOP_REBIRTHS, { frame: '#2a9cff', header: '#5ad0ff', rowFill: '#ffe23a', rowEdge: '#1e7ae0' })],
  ]
  // Live standings from the server; an empty board (offline) keeps the placeholders.
  const rowsFor = (rows, fmt) => rows.map((r) => ({ name: r.name, value: fmt(r.value), me: r.id === net.sessionId }))
  onLeaderboard(({ soda, rebirths }) => {
    if (soda.length) boards[0][1].userData.setRows(rowsFor(soda, short))
    if (rebirths.length) boards[1][1].userData.setRows(rowsFor(rebirths, (v) => String(Math.floor(v))))
  })
  for (const [x, board] of boards) {
    // Built facing +Z; turn to face north into the arena.
    board.rotation.y = Math.PI
    board.position.set(x, 0, boardZ)
    group.add(board)
    solid(x - 3.9, x + 3.9, boardZ - 0.7, boardZ + 0.7, 8)
  }

  return () => {}
}

// Builds the whole lobby. Returns { group, update(time, dt) }.
export function createLobby() {
  const group = new Group()
  buildWalls(group)
  const { tower, update: updateTower } = buildTower(group)
  const updaters = [updateTower, buildPortal(group), buildVoidNpc(group), buildDisplay(group), buildShop(group), buildSouth(group)]
  return {
    group,
    tower,
    update(t, dt) {
      for (const u of updaters) u(t, dt)
    },
  }
}
