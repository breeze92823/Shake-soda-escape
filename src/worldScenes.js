import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import { ARENA, PORTAL, VOID_NPC, WORLDS } from './config.js'
import { player, respawn } from './player.js'
import { makeLabel } from './labels.js'
import { buildWorldShop } from './worldShop.js'
import { brick, buildPortal, buildTower, buildWalls, flat, glow, glowMat, solid } from './lobby.js'

// The themed worlds behind the Summit (worlds.js builds one on first visit). Every world shares the lobby's
// layout skeleton -- walls, the numbered Soda Jump tower + launch pad, a portal back to the lobby and one on to
// the next world -- and adds its own scenery, colliders and animation. A builder returns update(time, dt).
// Free ground for scenery: everything inside ARENA except the spawn -> pad corridor and the portals.

const TAU = Math.PI * 2

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

let dotTex = null
const dot = () =>
  (dotTex ??= canvasTex(32, 32, (g) => {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
  }))

// Keep-outs: the spawn -> launch pad corridor, the tower, the pad and both portals.
const blocked = (x, z) =>
  (Math.abs(x) < 4 && z > -21 && z < 9) ||
  (Math.abs(x) < 6.5 && z < -20) ||
  Math.hypot(x + 9, z + 27) < 6.5 ||
  Math.hypot(x - 10, z + 27) < 6.5 ||
  (x < -13.5 && z > -32 && z < 16) || // treadmill shop
  (x > 13 && z > -14 && z < 12) // soda shelf

// n scattered points inside the arena (with `margin` to the walls), at least `gap` apart and outside the keep-outs.
function spots(rand, n, { gap = 3, margin = 2.5, taken = [] } = {}) {
  const out = []
  for (let tries = 0; out.length < n && tries < n * 60; tries++) {
    const x = ARENA.minX + margin + rand() * (ARENA.maxX - ARENA.minX - margin * 2)
    const z = ARENA.minZ + margin + rand() * (ARENA.maxZ - ARENA.minZ - margin * 2)
    if (blocked(x, z) || [...out, ...taken].some((p) => Math.hypot(p[0] - x, p[1] - z) < gap)) continue
    out.push([x, z])
  }
  return out
}

// Soft round particles that drift through a box following the player (snow, embers, bubbles).
function driftField(rand, { count, w, h, d, color, size, speed, sway = 0.4, opacity = 0.8, up = true, additive = false }) {
  const pos = new Float32Array(count * 3)
  const seed = Array.from({ length: count }, () => rand())
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * w
    pos[i * 3 + 1] = rand() * h
    pos[i * 3 + 2] = (rand() - 0.5) * d
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  const points = new Points(
    geo,
    new PointsMaterial({ map: dot(), color, size, transparent: true, opacity, depthWrite: false, ...(additive && { blending: AdditiveBlending }) }),
  )
  points.frustumCulled = false
  return {
    points,
    update(t, dt) {
      const a = geo.attributes.position
      for (let i = 0; i < count; i++) {
        let y = a.getY(i) + (up ? 1 : -1) * speed * (0.6 + seed[i] * 0.8) * dt
        if (y > h) y -= h
        else if (y < 0) y += h
        a.setY(i, y)
        a.setX(i, a.getX(i) + Math.sin(t * 0.8 + seed[i] * 6.28) * sway * dt)
      }
      a.needsUpdate = true
      points.position.set(player.position.x, 0, player.position.z)
    },
  }
}

const portalLook = (def) => ({
  frame: def.portal?.frame,
  dark: def.portal?.dark,
  neon: def.portal?.neon,
  glow: def.portal?.neon,
  swirl: def.portal ? [def.portal.dark, def.portal.frame, def.portal.neon] : undefined,
})

// Walls, tower + pad, the two portals and the welcome sign: what every world has.
function base(g, def, index) {
  buildWalls(g, def.walls)
  const { tower, update: updateTower } = buildTower(g)
  const updaters = [updateTower]
  const lobby = WORLDS[0]
  const next = WORLDS[index + 1]
  updaters.push(buildWorldShop(g, def))
  updaters.push(buildPortal(g, { at: PORTAL, title: lobby.short, sub: 'Back to the lobby', ...portalLook(next ?? def) }))
  if (next) updaters.push(buildPortal(g, { at: VOID_NPC, title: next.short, sub: 'Reach 20K studs', ...portalLook(next) }))
  const sign = makeLabel(
    [
      { text: def.name, size: 66, fill: ['#ffffff', '#ffe9a8', '#ffd24a'] },
      { text: `x${def.winsMult} Wins  •  x${def.sodaMult} Soda`, size: 42, fill: '#9dff5c' },
    ],
    1.7,
  )
  sign.position.set(0, 3.2, 9)
  g.add(sign)
  return { tower, updaters }
}

// --- 1. Candy Cloud Kingdom ---------------------------------------------------------------------
function candy(g, rand) {
  const wedge = (a, b) =>
    canvasTex(128, 128, (c) => {
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? a : b
        c.beginPath()
        c.moveTo(64, 64)
        c.arc(64, 64, 90, (i / 16) * TAU, ((i + 1) / 16) * TAU)
        c.fill()
      }
    })
  const pastel = ['#ff8ac8', '#ffd84a', '#7ae0ff', '#9cff8a', '#c49bff', '#ffa56a']
  const swirls = pastel.map((p) => wedge(p, '#ffffff'))
  const stickMat = flat('#ffffff')
  const lollies = []
  const taken = []
  for (const [x, z] of spots(rand, 16, { gap: 4 })) {
    taken.push([x, z])
    const h = 3.4 + rand() * 3
    const k = Math.floor(rand() * pastel.length)
    const lolly = new Group()
    const stick = new Mesh(new CylinderGeometry(0.14, 0.14, h, 10), stickMat)
    stick.position.y = h / 2
    const r = 1.2 + rand() * 0.6
    const disc = new Mesh(new CylinderGeometry(r, r, 0.3, 32), new MeshStandardMaterial({ map: swirls[k], roughness: 0.35 }))
    disc.rotation.x = Math.PI / 2
    disc.position.y = h + r * 0.6
    stick.castShadow = disc.castShadow = true
    lolly.add(stick, disc)
    lolly.position.set(x, 0, z)
    lolly.rotation.y = rand() * TAU
    g.add(lolly)
    solid(x - 0.2, x + 0.2, z - 0.2, z + 0.2, h)
    lollies.push({ lolly, phase: rand() * TAU })
  }
  // Gumdrops: glossy half-spheres.
  for (const [x, z] of spots(rand, 18, { gap: 2.2, taken })) {
    const r = 0.5 + rand() * 0.7
    const m = new Mesh(new SphereGeometry(r, 18, 10, 0, TAU, 0, Math.PI / 2), flat(pastel[Math.floor(rand() * pastel.length)], { roughness: 0.2 }))
    m.position.set(x, 0, z)
    m.castShadow = true
    g.add(m)
    solid(x - r * 0.6, x + r * 0.6, z - r * 0.6, z + r * 0.6, r * 0.5)
  }
  // Candy canes: striped shaft + hook.
  const stripes = canvasTex(64, 64, (c) => {
    c.fillStyle = '#fff'
    c.fillRect(0, 0, 64, 64)
    c.fillStyle = '#ff2a4a'
    for (let i = -2; i < 6; i++) {
      c.beginPath()
      c.moveTo(i * 16, 0)
      c.lineTo(i * 16 + 16, 0)
      c.lineTo(i * 16 + 48, 64)
      c.lineTo(i * 16 + 32, 64)
      c.fill()
    }
  })
  stripes.wrapS = stripes.wrapT = RepeatWrapping
  const caneMat = new MeshStandardMaterial({ map: stripes, roughness: 0.3 })
  for (const x of [-24, 24]) {
    for (const z of [-8, 6, 16]) {
      const cane = new Group()
      const shaft = new Mesh(new CylinderGeometry(0.22, 0.22, 3.6, 12), caneMat)
      shaft.position.y = 1.8
      const hook = new Mesh(new TorusGeometry(0.7, 0.22, 10, 20, Math.PI), caneMat)
      hook.position.set(x < 0 ? 0.7 : -0.7, 3.6, 0)
      if (x > 0) hook.rotation.z = Math.PI / 2 + Math.PI / 2
      cane.add(shaft, hook)
      cane.position.set(x, 0, z)
      cane.traverse((o) => (o.castShadow = true))
      g.add(cane)
    }
  }
  // Marshmallow staircase up to a sky ledge.
  const steps = ['#ffb3dd', '#ffe08a', '#a8f0ff', '#c9b3ff']
  steps.forEach((col, i) => g.add(brick(4, 0.5 * (i + 1), 4, col, -13 - i * 3.6, 0, 12)))
  // Cotton-candy clouds drifting beyond the low walls.
  const cloudMat = new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffb5e1', emissiveIntensity: 0.5, roughness: 1 })
  const blob = new SphereGeometry(1, 16, 12)
  const clouds = []
  for (let i = 0; i < 16; i++) {
    const c = new Group()
    for (let k = 0; k < 5; k++) {
      const p = new Mesh(blob, cloudMat)
      p.position.set((k - 2) * 1.4, Math.sin(k * 2) * 0.4, rand() - 0.5)
      p.scale.setScalar(1.3 - Math.abs(k - 2) * 0.22)
      c.add(p)
    }
    const a = (i / 16) * TAU
    const rad = 40 + rand() * 25
    c.position.set(Math.cos(a) * rad, 5 + rand() * 12, -7 + Math.sin(a) * rad)
    c.scale.setScalar(1.6 + rand() * 2)
    g.add(c)
    clouds.push({ c, y: c.position.y, phase: rand() * TAU })
  }
  return (t) => {
    for (const l of lollies) l.lolly.rotation.y += 0.004 + Math.sin(t + l.phase) * 0.001
    for (const c of clouds) c.c.position.y = c.y + Math.sin(t * 0.5 + c.phase) * 0.8
  }
}

// --- 2. Neon Cola Space Station -----------------------------------------------------------------
function neon(g, rand) {
  // Glowing grid laid over the deck.
  const grid = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    c.strokeStyle = '#00f0ff'
    c.lineWidth = 5
    c.strokeRect(0, 0, w, h)
    c.strokeStyle = 'rgba(255,56,214,0.55)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(w / 2, 0)
    c.lineTo(w / 2, h)
    c.moveTo(0, h / 2)
    c.lineTo(w, h / 2)
    c.stroke()
  })
  grid.wrapS = grid.wrapT = RepeatWrapping
  const W = ARENA.maxX - ARENA.minX
  const D = ARENA.maxZ - ARENA.minZ
  grid.repeat.set(W / 4, D / 4)
  const deck = new Mesh(new PlaneGeometry(W, D), new MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }))
  deck.rotation.x = -Math.PI / 2
  deck.position.set(0, 0.03, (ARENA.minZ + ARENA.maxZ) / 2)
  g.add(deck)

  // Neon pillars.
  const pillars = []
  const taken = []
  const hues = ['#00f0ff', '#ff38d6']
  for (const [x, z] of spots(rand, 12, { gap: 5 })) {
    taken.push([x, z])
    const col = hues[pillars.length % 2]
    const h = 3 + rand() * 4
    const body = new Mesh(new CylinderGeometry(0.35, 0.45, h, 10), flat('#12143a', { emissive: col, emissiveIntensity: 0.25 }))
    body.position.set(x, h / 2, z)
    const cap = new Mesh(new CylinderGeometry(0.5, 0.5, 0.18, 10), glowMat(col))
    cap.position.set(x, h + 0.09, z)
    const halo = glow(col, 3.2, 0.7)
    halo.position.set(x, h + 0.4, z)
    body.castShadow = true
    g.add(body, cap, halo)
    solid(x - 0.45, x + 0.45, z - 0.45, z + 0.45, h)
    pillars.push({ halo, phase: rand() * TAU })
  }

  // Cola reactors: glass tube, glowing cola core, spinning rings.
  const rings = []
  const cores = []
  for (const x of [-9, 9]) {
    const z = 14
    const base = new Mesh(new CylinderGeometry(2.6, 2.9, 0.6, 24), flat('#1a1d4a'))
    base.position.set(x, 0.3, z)
    const tube = new Mesh(new CylinderGeometry(2, 2, 7, 24, 1, true), new MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.28, roughness: 0.1, side: DoubleSide }))
    tube.position.set(x, 4.1, z)
    const core = new Mesh(new CylinderGeometry(1.35, 1.35, 6.6, 20), new MeshBasicMaterial({ color: '#ff7a1a', toneMapped: false }))
    core.position.set(x, 4.1, z)
    const lamp = glow('#ff9a3a', 9, 0.5)
    lamp.position.set(x, 4.1, z)
    base.castShadow = true
    g.add(base, tube, core, lamp)
    cores.push({ core, lamp })
    for (const y of [1.6, 4.1, 6.6]) {
      const ring = new Mesh(new TorusGeometry(2.25, 0.09, 8, 36), glowMat(y === 4.1 ? '#ff38d6' : '#00f0ff'))
      ring.rotation.x = Math.PI / 2
      ring.position.set(x, y, z)
      g.add(ring)
      rings.push(ring)
    }
    solid(x - 2.6, x + 2.6, z - 2.6, z + 2.6, 7.6)
  }

  // Low-gravity stair of glowing hex columns: hop between them.
  const hexMat = flat('#1a1d4a', { emissive: '#2a3cff', emissiveIntensity: 0.25 })
  for (let i = 0; i < 5; i++) {
    const h = 1.4 * (i + 1)
    const x = -8 + (i % 2 ? 2 : -2)
    const z = -4 - i * 4
    const col = new Mesh(new CylinderGeometry(1.5, 1.7, h, 6), hexMat)
    col.position.set(x, h / 2, z)
    const lip = new Mesh(new CylinderGeometry(1.52, 1.52, 0.08, 6), glowMat(i % 2 ? '#ff38d6' : '#00f0ff'))
    lip.position.set(x, h + 0.04, z)
    col.castShadow = true
    g.add(col, lip)
    solid(x - 1.3, x + 1.3, z - 1.3, z + 1.3, h)
  }

  // A ringed planet and a moon in the sky.
  const bands = canvasTex(256, 128, (c, w, h) => {
    const cols = ['#ff7ad8', '#8a5cff', '#3cd8ff', '#ffb36a', '#6a4cff']
    for (let y = 0; y < h; y += 8) {
      c.fillStyle = cols[Math.floor(y / 8 + Math.sin(y * 0.2)) % cols.length]
      c.fillRect(0, y, w, 8)
    }
  })
  const planet = new Mesh(new SphereGeometry(55, 40, 24), new MeshBasicMaterial({ map: bands, fog: false }))
  planet.position.set(-130, 75, -190)
  const ring = new Mesh(new RingGeometry(72, 100, 64), new MeshBasicMaterial({ color: '#d9c4ff', transparent: true, opacity: 0.45, side: DoubleSide, fog: false }))
  ring.position.copy(planet.position)
  ring.rotation.x = Math.PI / 2.4
  const moon = new Mesh(new SphereGeometry(12, 24, 16), new MeshBasicMaterial({ color: '#b9c4e8', fog: false }))
  moon.position.set(120, 55, -160)
  g.add(planet, ring, moon)

  return (t) => {
    pillars.forEach((p, i) => (p.halo.material.opacity = 0.5 + Math.sin(t * 2 + p.phase) * 0.25))
    rings.forEach((r, i) => (r.rotation.z = t * (i % 2 ? -1.2 : 1.2)))
    for (const c of cores) {
      c.lamp.material.opacity = 0.4 + Math.sin(t * 3) * 0.12
      c.core.scale.x = c.core.scale.z = 1 + Math.sin(t * 3) * 0.04
    }
    planet.rotation.y = t * 0.02
  }
}

// --- 3. Frozen Soda Glacier -----------------------------------------------------------------------
function glacier(g, rand) {
  const iceMat = new MeshStandardMaterial({ color: '#bfeaff', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: '#3a8ac8', emissiveIntensity: 0.18 })
  const taken = []
  // Ice spikes.
  for (const [x, z] of spots(rand, 20, { gap: 3.5 })) {
    taken.push([x, z])
    const h = 2 + rand() * 5
    const r = 0.5 + rand() * 0.9
    const spike = new Mesh(new ConeGeometry(r, h, 6), iceMat)
    spike.position.set(x, h / 2, z)
    spike.rotation.y = rand() * TAU
    spike.castShadow = true
    g.add(spike)
    solid(x - r * 0.45, x + r * 0.45, z - r * 0.45, z + r * 0.45, h * 0.7)
  }
  // Frozen soda bottles frozen into the ice.
  const bottleCols = ['#e8161c', '#ff8a17', '#7a3cff', '#3fd62a']
  for (const [x, z] of spots(rand, 5, { gap: 6, margin: 4, taken })) {
    taken.push([x, z])
    const b = new Group()
    const col = bottleCols[Math.floor(rand() * bottleCols.length)]
    const body = new Mesh(new CylinderGeometry(0.9, 0.9, 3, 16), new MeshStandardMaterial({ color: col, transparent: true, opacity: 0.8, roughness: 0.15 }))
    body.position.y = 1.5
    const neck = new Mesh(new CylinderGeometry(0.35, 0.9, 0.8, 16), body.material)
    neck.position.y = 3.4
    const cap = new Mesh(new CylinderGeometry(0.4, 0.4, 0.3, 16), flat('#e8e8f0'))
    cap.position.y = 3.95
    const frost = new Mesh(new SphereGeometry(1.4, 12, 8, 0, TAU, 0, Math.PI / 2), iceMat)
    frost.scale.y = 0.6
    body.castShadow = true
    b.add(body, neck, cap, frost)
    b.position.set(x, 0, z)
    b.rotation.z = (rand() - 0.5) * 0.35
    g.add(b)
    solid(x - 0.9, x + 0.9, z - 0.9, z + 0.9, 3.9)
  }
  // Snow mounds.
  const snow = flat('#ffffff', { roughness: 0.9 })
  for (const [x, z] of spots(rand, 14, { gap: 2.5, taken })) {
    const r = 0.8 + rand() * 1.4
    const m = new Mesh(new SphereGeometry(r, 16, 10), snow)
    m.scale.y = 0.45
    m.position.set(x, 0, z)
    m.receiveShadow = true
    g.add(m)
  }
  // Aurora curtains over the far wall.
  const auroraMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float time; varying vec2 vUv;
      void main() {
        float wave = sin(vUv.x * 7.0 + time * 0.5) * 0.5 + 0.5;
        float rays = sin(vUv.x * 38.0 + sin(vUv.x * 5.0 + time) * 2.0) * 0.5 + 0.5;
        float band = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        vec3 col = mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.3, 1.0), vUv.y + 0.25 * sin(vUv.x * 3.0 + time * 0.4));
        gl_FragColor = vec4(col, band * (0.18 + 0.4 * wave * rays));
      }`,
  })
  for (const [x, z, ry] of [[0, -160, 0], [-110, -110, 0.7], [110, -110, -0.7]]) {
    const c = new Mesh(new PlaneGeometry(220, 90, 1, 1), auroraMat)
    c.position.set(x, 70, z)
    c.rotation.y = ry
    g.add(c)
  }
  const flakes = driftField(rand, { count: 380, w: 70, h: 28, d: 70, color: '#ffffff', size: 0.28, speed: 2.4, sway: 0.7, up: false })
  g.add(flakes.points)
  return (t, dt) => {
    auroraMat.uniforms.time.value = t
    flakes.update(t, dt)
  }
}

// --- 4. Volcano Lava Soda -------------------------------------------------------------------------
function volcano(g, rand) {
  const LAVA_EDGE = 18.5 // |x| beyond this is lava: touching it sends you back to the spawn
  const lavaMat = new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float time; varying vec2 vP;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 p = vP * 0.35 + vec2(0.0, -time * 0.22);
        float f = n(p) * 0.6 + n(p * 2.3 + time * 0.15) * 0.4;
        vec3 col = mix(vec3(0.55, 0.03, 0.0), vec3(1.0, 0.8, 0.12), smoothstep(0.3, 0.8, f));
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  const D = ARENA.maxZ - ARENA.minZ
  for (const sx of [-1, 1]) {
    const w = ARENA.maxX - LAVA_EDGE
    const river = new Mesh(new PlaneGeometry(w, D), lavaMat)
    river.rotation.x = -Math.PI / 2
    river.position.set(sx * (LAVA_EDGE + w / 2), 0.05, (ARENA.minZ + ARENA.maxZ) / 2)
    g.add(river)
    const lamp = glow('#ff6a1a', 22, 0.35)
    lamp.position.set(sx * 22, 2, 0)
    g.add(lamp)
    // Dark rock lip along the lava's inner bank.
    g.add(brick(1.2, 0.4, D, '#2a1a18', sx * (LAVA_EDGE - 0.6), 0, (ARENA.minZ + ARENA.maxZ) / 2, { collide: false }))
  }

  // Basalt columns, plus a climbable staircase of them.
  const rock = flat('#3a2e2c', { roughness: 0.9 })
  const hot = flat('#3a2e2c', { emissive: '#ff4a0a', emissiveIntensity: 0.35, roughness: 0.9 })
  const taken = []
  for (const [x, z] of spots(rand, 16, { gap: 3.2, margin: 3 })) {
    if (Math.abs(x) > LAVA_EDGE - 2) continue
    taken.push([x, z])
    const h = 1 + rand() * 4
    const r = 0.7 + rand() * 0.5
    const m = new Mesh(new CylinderGeometry(r, r * 1.1, h, 6), rand() > 0.7 ? hot : rock)
    m.position.set(x, h / 2, z)
    m.rotation.y = rand() * TAU
    m.castShadow = m.receiveShadow = true
    g.add(m)
    solid(x - r * 0.85, x + r * 0.85, z - r * 0.85, z + r * 0.85, h)
  }
  for (let i = 0; i < 6; i++) {
    const h = 0.5 * (i + 1)
    const x = 12 + (i % 2 ? 1.6 : -1.6)
    const z = 14 - i * 2.4
    const m = new Mesh(new CylinderGeometry(1.1, 1.2, h, 6), rock)
    m.position.set(x, h / 2, z)
    m.castShadow = true
    g.add(m)
    solid(x - 1, x + 1, z - 1, z + 1, h)
  }

  // Geysers: erupt in turn and throw the player skyward.
  const geysers = []
  const plumeMat = new MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.6, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })
  ;[[-9, 8], [9, 4], [0, 14], [-10, -8], [11, -10]].forEach(([x, z], i) => {
    const vent = new Mesh(new TorusGeometry(1.1, 0.35, 8, 20), rock)
    vent.rotation.x = Math.PI / 2
    vent.position.set(x, 0.2, z)
    const plume = new Mesh(new CylinderGeometry(0.5, 1.0, 1, 14, 1, true), plumeMat)
    plume.position.set(x, 0, z)
    const flare = glow('#ff9a3a', 4, 0.6)
    flare.position.set(x, 0.6, z)
    g.add(vent, plume, flare)
    geysers.push({ x, z, plume, flare, phase: i * 1.7 })
  })
  const PERIOD = 6.5
  const ERUPT = 1.6

  // The volcano on the horizon.
  const cone = new Mesh(new ConeGeometry(70, 90, 28, 1, true), new MeshStandardMaterial({ color: '#2a1a18', roughness: 1, side: DoubleSide, fog: false }))
  cone.position.set(-90, 45, -225)
  const crater = glow('#ff6a1a', 70, 0.75)
  crater.position.set(-90, 94, -225)
  g.add(cone, crater)

  const embers = driftField(rand, { count: 260, w: 60, h: 22, d: 60, color: '#ff8a2a', size: 0.22, speed: 3, sway: 0.9, additive: true })
  g.add(embers.points)

  return (t, dt) => {
    lavaMat.uniforms.time.value = t
    embers.update(t, dt)
    crater.material.opacity = 0.6 + Math.sin(t * 1.7) * 0.15
    for (const gy of geysers) {
      const c = (t + gy.phase) % PERIOD
      const k = c < ERUPT ? Math.sin((c / ERUPT) * Math.PI) : 0
      const hgt = 0.01 + k * 9
      gy.plume.scale.set(1, hgt, 1)
      gy.plume.position.y = hgt / 2
      gy.plume.material.opacity = 0.6
      gy.flare.material.opacity = 0.3 + k * 0.6
      const p = player.position
      if (k > 0.35 && !player.locked && Math.hypot(p.x - gy.x, p.z - gy.z) < 1.4 && p.y < 3) {
        player.velocity.y = 15
        player.grounded = false
      }
    }
    const p = player.position
    if (!player.locked && p.y < 0.4 && Math.abs(p.x) > LAVA_EDGE) respawn()
  }
}

// --- 5. Underwater Fizz Reef ------------------------------------------------------------------------
function reef(g, rand) {
  const coralCols = ['#ff6a8a', '#ff9a4a', '#ffd24a', '#c06aff', '#ff5ad2', '#4ad8c0']
  const taken = []
  // Coral clusters.
  for (const [x, z] of spots(rand, 18, { gap: 3.2 })) {
    taken.push([x, z])
    const col = coralCols[Math.floor(rand() * coralCols.length)]
    const mat = flat(col, { roughness: 0.6 })
    const c = new Group()
    if (rand() > 0.45) {
      // Branching coral: tilted tines with round tips.
      const tines = 4 + Math.floor(rand() * 3)
      for (let i = 0; i < tines; i++) {
        const h = 1.2 + rand() * 1.8
        const tine = new Mesh(new CylinderGeometry(0.1, 0.2, h, 8), mat)
        const tip = new Mesh(new SphereGeometry(0.2, 8, 8), mat)
        const arm = new Group()
        tine.position.y = h / 2
        tip.position.y = h
        arm.add(tine, tip)
        arm.rotation.set((rand() - 0.5) * 0.9, 0, (rand() - 0.5) * 0.9)
        c.add(arm)
      }
      solid(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 1.4)
    } else {
      // Brain coral dome.
      const r = 0.7 + rand() * 0.8
      const dome = new Mesh(new IcosahedronGeometry(r, 1), new MeshStandardMaterial({ color: col, roughness: 0.7, flatShading: true }))
      dome.scale.y = 0.75
      dome.position.y = r * 0.35
      c.add(dome)
      solid(x - r * 0.7, x + r * 0.7, z - r * 0.7, z + r * 0.7, r * 0.7)
    }
    c.position.set(x, 0, z)
    c.traverse((o) => (o.castShadow = true))
    g.add(c)
  }
  // Kelp strands that sway.
  const kelpMat = flat('#2ea84a', { roughness: 0.8 })
  const kelp = []
  for (const [x, z] of spots(rand, 22, { gap: 1.8, margin: 1.5, taken })) {
    const h = 3 + rand() * 4
    const k = new Group()
    const blade = new Mesh(new BoxGeometry(0.35, h, 0.06), kelpMat)
    blade.position.y = h / 2
    k.add(blade)
    k.position.set(x, 0, z)
    g.add(k)
    kelp.push({ k, phase: rand() * TAU })
  }
  // A giant sunken cola can, half buried.
  const can = new Group()
  const canBody = new Mesh(new CylinderGeometry(2, 2, 6, 24), flat('#e8161c', { roughness: 0.3, metalness: 0.4 }))
  const label = new Mesh(new CylinderGeometry(2.02, 2.02, 2, 24), flat('#ffffff'))
  const top = new Mesh(new CylinderGeometry(1.7, 2, 0.4, 24), flat('#c8ccd8', { metalness: 0.7, roughness: 0.3 }))
  top.position.y = 3.2
  can.add(canBody, label, top)
  can.rotation.set(0, 0.5, Math.PI / 2 - 0.25)
  can.position.set(8, 1.4, 15)
  can.traverse((o) => (o.castShadow = true))
  g.add(can)
  solid(8 - 3.2, 8 + 3.2, 15 - 2, 15 + 2, 2.6)

  // Light shafts from the surface.
  const shaftMat = new MeshBasicMaterial({ color: '#bff8ff', transparent: true, opacity: 0.09, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
  const shafts = []
  for (const [x, z] of [[-15, -10], [12, 6], [-6, 14], [20, -22], [-20, 8]]) {
    const s = new Mesh(new CylinderGeometry(0.4, 4, 30, 16, 1, true), shaftMat)
    s.position.set(x, 15, z)
    g.add(s)
    shafts.push(s)
  }
  // Fish schools circling overhead.
  const fishMat = [flat('#ffb02a'), flat('#4ad8ff'), flat('#ff5a8a')]
  const schools = []
  ;[[-10, 2, 7], [12, -4, 9], [0, -12, 11]].forEach(([cx, cz, rad], si) => {
    const fish = []
    for (let i = 0; i < 6; i++) {
      const f = new Group()
      const body = new Mesh(new SphereGeometry(0.4, 10, 8), fishMat[si])
      body.scale.set(1.5, 0.8, 0.5)
      const tail = new Mesh(new ConeGeometry(0.28, 0.5, 6), fishMat[si])
      tail.rotation.z = Math.PI / 2
      tail.position.x = -0.75
      f.add(body, tail)
      g.add(f)
      fish.push({ f, a: (i / 6) * TAU + rand(), dy: rand() * 2 })
    }
    schools.push({ fish, cx, cz, rad, y: 4 + si * 1.6, speed: 0.5 + si * 0.1 })
  })
  // Jellyfish.
  const jellies = []
  for (const [x, z] of [[-18, -14], [6, -2], [18, 14]]) {
    const j = new Group()
    const bell = new Mesh(new SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#ff9ad5', emissive: '#ff5ad2', emissiveIntensity: 0.5, transparent: true, opacity: 0.7 }))
    j.add(bell)
    for (let i = 0; i < 6; i++) {
      const t = new Mesh(new CylinderGeometry(0.04, 0.02, 1.8, 5), new MeshBasicMaterial({ color: '#ffb5e8', transparent: true, opacity: 0.6 }))
      const a = (i / 6) * TAU
      t.position.set(Math.cos(a) * 0.55, -0.9, Math.sin(a) * 0.55)
      j.add(t)
    }
    const aura = glow('#ff7ad8', 5, 0.35)
    aura.position.y = 0.2
    j.add(aura)
    j.position.set(x, 6, z)
    g.add(j)
    jellies.push({ j, y: 6, phase: rand() * TAU })
  }
  const bubbles = driftField(rand, { count: 240, w: 60, h: 22, d: 60, color: '#d8fbff', size: 0.3, speed: 1.6, sway: 0.5, opacity: 0.6 })
  g.add(bubbles.points)

  return (t, dt) => {
    bubbles.update(t, dt)
    for (const k of kelp) k.k.rotation.z = Math.sin(t * 0.9 + k.phase) * 0.14
    shafts.forEach((s, i) => (s.rotation.z = Math.sin(t * 0.3 + i) * 0.05))
    for (const s of schools) {
      for (const f of s.fish) {
        const a = f.a + t * s.speed
        f.f.position.set(s.cx + Math.cos(a) * s.rad, s.y + Math.sin(t + f.dy) * 0.6 + f.dy * 0.3, s.cz + Math.sin(a) * s.rad)
        f.f.rotation.y = -a - Math.PI / 2
      }
    }
    for (const j of jellies) {
      j.j.position.y = j.y + Math.sin(t * 0.8 + j.phase) * 1.2
      j.j.scale.y = 1 + Math.sin(t * 2.2 + j.phase) * 0.1
    }
  }
}

const THEMES = { candy, neon, glacier, volcano, reef }

// Builds the scenery of one themed world into `g`; returns { tower, update(time, dt) }.
export function buildWorldScene(g, def) {
  const index = WORLDS.findIndex((w) => w.id === def.id)
  const rand = mulberry32(index * 7919 + 13)
  const { tower, updaters } = base(g, def, index)
  updaters.push(THEMES[def.id](g, rand))
  return {
    tower,
    update(t, dt) {
      for (const u of updaters) u(t, dt)
    },
  }
}
