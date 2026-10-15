// Soda Jump visual effects, as real shaken soda: glassy bubbles that rise, wobble and pop, creamy
// foam clumps, fine mist and ballistic droplets. One pooled point system; the fragment shader draws
// each kind (bubble rim + highlight, bubbly foam, soft mist, shiny droplet). Particles live in
// preallocated typed arrays, nothing is allocated per frame. Plus a flash sprite and a shockwave ring.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial,
  CylinderGeometry, Points, RingGeometry, ShaderMaterial, Sprite, SpriteMaterial,
} from 'three'
import { LAUNCH } from './config.js'
import { isTouch } from './device.js'

const F = LAUNCH.fx
const MAX = Math.floor(LAUNCH.maxParticles * (isTouch ? LAUNCH.mobileParticleScale : 1))
const S = MAX / LAUNCH.maxParticles // burst density: 1 on desktop, less on phones
const BUBBLE = 0
const FOAM = 1
const MIST = 2
const DROP = 3
const colors = (list) => list.map((c) => new Color(c))
const FOAM_COLORS = colors(F.foamColors)
const MIST_COLORS = colors(F.mistColors)
const DROP_COLORS = colors(F.dropletColors)
const WHITE = new Color('#ffffff')

function softTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

const VERTEX = `
  attribute float size; attribute float alpha; attribute float kind; attribute float seed;
  varying float vA; varying float vK; varying float vS; varying vec3 vC; uniform float scale;
  void main() {
    vA = alpha; vK = kind; vS = seed; vC = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(size * scale / max(0.1, -mv.z), 300.0);
    gl_Position = projectionMatrix * mv;
  }`

const FRAGMENT = `
  uniform float time; uniform float wobble;
  varying float vA; varying float vK; varying float vS; varying vec3 vC;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    if (vK < 0.5) {
      // Bubble: squash and stretch as it rises, mostly clear with a bright rim and two reflections.
      float q = 1.0 + wobble * sin(time * 9.0 + vS * 40.0);
      p = vec2(p.x * q, p.y / q);
      float d = length(p);
      if (d > 1.0) discard;
      float rim = smoothstep(0.62, 0.93, d) * (1.0 - smoothstep(0.95, 1.0, d));
      vec3 film = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + atan(p.y, p.x) * 1.5 + vS * 6.28); // thin-film tint
      vec3 tint = mix(vec3(1.0), film, 0.5);
      float hi = smoothstep(0.26, 0.0, length(p - vec2(-0.38, 0.4)));
      float lo = smoothstep(0.14, 0.0, length(p - vec2(0.42, -0.4))) * 0.5;
      float a = 0.07 + rim * 0.7 + hi + lo;
      gl_FragColor = vec4(mix(tint, vec3(1.0), clamp(hi + lo, 0.0, 1.0)), clamp(a, 0.0, 1.0) * vA);
    } else if (vK < 1.5) {
      // Foam: a creamy blob of tiny bubbles (cell pattern with darker film edges).
      float d = length(p);
      if (d > 1.0) discard;
      vec2 g = p * 3.2 + vS * 13.0;
      vec2 cell = floor(g);
      vec2 f = fract(g) - 0.5 - (vec2(hash(cell + 7.0), hash(cell + 3.0)) - 0.5) * 0.35;
      float r = 0.27 + 0.18 * hash(cell);
      float bd = length(f);
      float edge = smoothstep(r - 0.07, r, bd) * (1.0 - smoothstep(r, r + 0.07, bd));
      float shine = smoothstep(r * 0.55, 0.0, length(f - vec2(-0.08, 0.08))) * 0.35;
      vec3 c = vC * (0.9 + 0.1 * hash(cell)) * (1.0 - 0.2 * edge) + shine;
      gl_FragColor = vec4(c, smoothstep(1.0, 0.45, d) * 0.92 * vA);
    } else if (vK < 2.5) {
      // Mist: soft, thin vapor.
      float d = length(p);
      float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.0) * 0.42;
      gl_FragColor = vec4(vC, a * vA);
    } else {
      // Droplet: small liquid bead, darker edge, bright highlight.
      float d = length(p);
      if (d > 1.0) discard;
      float hi = smoothstep(0.35, 0.0, length(p - vec2(-0.3, 0.35)));
      vec3 c = mix(vC * 0.85, vec3(1.0), hi);
      gl_FragColor = vec4(c, (0.55 + 0.4 * smoothstep(0.4, 0.95, d) + hi * 0.3) * smoothstep(1.0, 0.85, d) * vA);
    }
  }`

export function createLaunchFx() {
  const group = new Group()
  const tex = softTexture()

  // --- particle pool ---
  const pos = new Float32Array(MAX * 3)
  const col = new Float32Array(MAX * 3)
  const size = new Float32Array(MAX)
  const alpha = new Float32Array(MAX)
  const kindA = new Float32Array(MAX)
  const seedA = new Float32Array(MAX)
  const vel = new Float32Array(MAX * 3)
  const life = new Float32Array(MAX) // remaining s
  const maxLife = new Float32Array(MAX)
  const size0 = new Float32Array(MAX)
  const grow = new Float32Array(MAX) // size multiplier at end of life
  const lift = new Float32Array(MAX) // vertical acceleration (buoyancy up, gravity down)
  const drag = new Float32Array(MAX)
  const turb = new Float32Array(MAX) // sideways wander
  const pops = new Uint8Array(MAX) // 1 = ends with a pop
  let cursor = 0
  let time = 0
  let hissAcc = 0
  let prevTrailY = null

  const geo = new BufferGeometry()
  const attr = (name, array, n) => geo.setAttribute(name, new BufferAttribute(array, n).setUsage(35048))
  attr('position', pos, 3)
  attr('color', col, 3)
  attr('size', size, 1)
  attr('alpha', alpha, 1)
  attr('kind', kindA, 1)
  attr('seed', seedA, 1)
  const mat = new ShaderMaterial({
    uniforms: { scale: { value: 600 }, time: { value: 0 }, wobble: { value: F.wobble } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  group.add(points)

  // --- flash + ring ---
  const flash = new Sprite(new SpriteMaterial({ map: tex, color: '#fff3d0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }))
  flash.visible = false
  const ring = new Mesh(new RingGeometry(0.85, 1, 48), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  group.add(flash, ring)
  let flashT = 1
  let ringT = 1

  const rnd = (a) => (Math.random() - 0.5) * 2 * a
  const pick = (list) => list[(Math.random() * list.length) | 0]

  function spawn(kind, x, y, z, vx, vy, vz, s, ttl, g, up, dr, tb, color) {
    const i = cursor
    cursor = (cursor + 1) % MAX
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z
    vel[i * 3] = vx
    vel[i * 3 + 1] = vy
    vel[i * 3 + 2] = vz
    kindA[i] = kind
    seedA[i] = Math.random()
    size0[i] = size[i] = s
    life[i] = maxLife[i] = ttl
    grow[i] = g
    lift[i] = up
    drag[i] = dr
    turb[i] = tb
    pops[i] = 0
    col[i * 3] = color.r
    col[i * 3 + 1] = color.g
    col[i * 3 + 2] = color.b
    return i
  }

  // Many small bubbles, few big ones.
  const bubbleSize = () => F.bubbleMin + Math.pow(Math.random(), 3) * F.bubbleSpread
  function bubble(x, y, z, vx, vy, vz, s = bubbleSize(), ttl = 0.9 + Math.random() * 1.3) {
    const i = spawn(BUBBLE, x, y, z, vx, vy, vz, s, ttl, 1 + Math.random() * 0.15, F.bubbleLift * (0.6 + s * 2), F.bubbleDrag, F.bubbleTurbulence, WHITE)
    pops[i] = Math.random() < F.bubblePop ? 1 : 0
  }
  const foam = (x, y, z, vx, vy, vz, s, ttl) => spawn(FOAM, x, y, z, vx, vy, vz, s, ttl, 2.2 + Math.random(), 0.8, F.foamDrag, 0.6, pick(FOAM_COLORS))
  const mist = (x, y, z, vx, vy, vz, s, ttl) => spawn(MIST, x, y, z, vx, vy, vz, s, ttl, 3 + Math.random() * 1.5, 0.6, 1.2, 1, pick(MIST_COLORS))
  const drop = (x, y, z, vx, vy, vz, s = 0.06 + Math.random() * 0.08, ttl = 0.6 + Math.random() * 0.8) =>
    spawn(DROP, x, y, z, vx, vy, vz, s, ttl, 0.8, F.dropletGravity, F.dropletDrag, 0, pick(DROP_COLORS))

  const n = (k) => Math.max(1, Math.floor(k * S))

  // --- jet + column: streaky cola/foam cones. Narrow end up (at the feet), wide end down. ---
  const coneGeo = new CylinderGeometry(0.3, 1, 1, 20, 1, true)
  function makeCone(c0, c1) {
    const material = new ShaderMaterial({
      uniforms: { time: { value: 0 }, strength: { value: 0 }, len: { value: 1 }, c0: { value: new Color(c0) }, c1: { value: new Color(c1) } },
      vertexShader: `
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          vUv = uv; vN = normalMatrix * normal;
          vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float time; uniform float strength; uniform float len; uniform vec3 c0; uniform vec3 c1;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          float d = 1.0 - vUv.y; // 0 at the feet, 1 at the far end
          float flow = time * 22.0;
          // Long streaks running along the jet, torn up further out.
          float n = vnoise(vec2(vUv.x * 18.0, d * len * 0.35 + flow)) * 0.6 + vnoise(vec2(vUv.x * 41.0, d * len * 0.9 + flow * 1.7)) * 0.4;
          float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 0.7);
          float a = (1.0 - d) * (1.0 - d) * (0.35 + 0.65 * n) * edge * smoothstep(0.0, 0.04, d + 0.04) * strength;
          gl_FragColor = vec4(mix(c0, c1, smoothstep(0.0, 0.8, d)) * (0.9 + 0.2 * n), clamp(a * 1.25, 0.0, 0.95));
        }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
    const mesh = new Mesh(coneGeo, material)
    mesh.visible = false
    mesh.frustumCulled = false
    group.add(mesh)
    return { mesh, material, level: 0, touched: false }
  }
  let lastDt = 1 / 60
  const jetCone = makeCone(F.jetColors[0], F.jetColors[1])
  const columnCone = makeCone('#fff1dc', '#f0d6b0')
  // Eases the strength (a cut-off still fades in ~0.1 s) and stretches the cone between two points.
  function placeCone(cone, x, z, topY, bottomY, radius, target, dt) {
    cone.touched = true
    cone.level += (target - cone.level) * (1 - Math.exp(-16 * dt))
    const len = topY - bottomY
    cone.mesh.visible = cone.level > 0.01 && len > 0.2
    if (!cone.mesh.visible) return
    cone.mesh.position.set(x, (topY + bottomY) / 2, z)
    cone.mesh.scale.set(radius, len, radius)
    cone.material.uniforms.strength.value = cone.level
    cone.material.uniforms.len.value = len
  }

  return {
    group,

    // Pressure build-up: foam leaks out of the can's top and swells out along the pad.
    charge(x, y, z, footY, amount, dt) {
      const k = Math.random() < amount * 140 * dt ? 1 : 0
      for (let i = 0; i < k; i++) {
        foam(x + rnd(0.1), y + 0.55, z + rnd(0.1), rnd(0.9), 1.5 + Math.random() * 2.5, rnd(0.9), 0.3 + Math.random() * 0.3, 0.5 + Math.random() * 0.4)
        const a = Math.random() * Math.PI * 2
        foam(x, footY + 0.15, z, Math.cos(a) * (1 + 2 * amount), 0.3 + Math.random() * 0.6, Math.sin(a) * (1 + 2 * amount), 0.4 + Math.random() * 0.3, 0.5 + Math.random() * 0.4)
      }
    },

    // The cola jet pinned under the player's feet (cone + hard spray), pushing them up.
    jet(x, y, z, groundY, strength, dt) {
      placeCone(jetCone, x, z, y + 0.1, Math.max(groundY, y - F.jetLength), F.jetRadius, strength, dt)
      const count = Math.round(strength * 300 * dt * S + Math.random())
      for (let k = 0; k < count; k++) {
        const r = Math.random() * 0.3
        const a = Math.random() * Math.PI * 2
        const px = x + Math.cos(a) * r
        const pz = z + Math.sin(a) * r
        if (Math.random() < 0.55) foam(px, y, pz, Math.cos(a) * 1.8, -10 - Math.random() * 12, Math.sin(a) * 1.8, 0.35 + Math.random() * 0.4, 0.35 + Math.random() * 0.35)
        else drop(px, y, pz, Math.cos(a) * 2.5, -12 - Math.random() * 14, Math.sin(a) * 2.5)
      }
    },

    // Thin foam column from the pad up to the player: the path of the launch, fading out.
    column(padX, padZ, padY, topY, topX, topZ, strength) {
      placeCone(columnCone, (padX + topX) / 2, (padZ + topZ) / 2, topY, padY, F.columnRadius, strength, lastDt)
    },

    // The pad keeps erupting after the player has gone.
    fountain(x, y, z, strength, dt) {
      const count = Math.round(strength * 110 * dt * S + Math.random() * strength)
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 1.6
        const vy = 4 + Math.random() * 8
        if (Math.random() < 0.6) foam(x, y + 0.2, z, Math.cos(a) * r, vy, Math.sin(a) * r, 0.5 + Math.random() * 0.5, 0.8 + Math.random() * 0.8)
        else drop(x, y + 0.2, z, Math.cos(a) * r * 1.5, vy * 1.3, Math.sin(a) * r * 1.5)
      }
    },

    // Fizz while the can is shaken: bubbles streaming up from its mouth, spitting droplets when it gets violent.
    hiss(x, y, z, intensity, dt) {
      // No bubbles anywhere: a fine mist hiss from the can's mouth, with droplets once it gets violent.
      hissAcc += (6 + 50 * intensity) * dt
      while (hissAcc >= 1) {
        hissAcc -= 1
        mist(x + rnd(0.1), y + 0.5, z + rnd(0.1), rnd(0.5), 0.8 + Math.random() * 1.2, rnd(0.5), 0.35 + Math.random() * 0.25, 0.5 + Math.random() * 0.4)
        if (Math.random() < 0.5 * intensity) drop(x + rnd(0.06), y + 0.55, z + rnd(0.06), rnd(1.2), 2 + Math.random() * 3, rnd(1.2))
      }
    },

    // The can bursts: foam eruption, bubble cloud, droplet spray, plus the jet that throws the player up.
    burst(x, y, z, footY) {
      // A real burst has no bubbles: any left from the shake vanish without popping.
      for (let i = 0; i < MAX; i++) if (kindA[i] === BUBBLE) life[i] = 0
      for (let k = 0; k < n(60); k++) {
        // Foam fountain: a cone of clumps out of the can.
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 2.2
        foam(x, y, z, Math.cos(a) * r, 4 + Math.random() * 7, Math.sin(a) * r, 0.5 + Math.random() * 0.6, 0.9 + Math.random() * 0.9)
      }
      for (let k = 0; k < n(45); k++) {
        // Big liquid blobs flung out where the bubble cloud used to be.
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 4.5
        drop(x, y, z, Math.cos(a) * r, rnd(2) + 2.5, Math.sin(a) * r, 0.12 + Math.random() * 0.1)
      }
      for (let k = 0; k < n(130); k++) {
        const a = Math.random() * Math.PI * 2
        const r = 2 + Math.random() * 7
        drop(x, y, z, Math.cos(a) * r, 1 + Math.random() * 7, Math.sin(a) * r)
      }
      for (let k = 0; k < n(30); k++) mist(x + rnd(0.3), y + rnd(0.3), z + rnd(0.3), rnd(2.5), 1 + Math.random() * 2, rnd(2.5), 1 + Math.random(), 1.2 + Math.random())
      // Ground splash: foam, bubbles and droplets rolling out from the pad.
      for (let k = 0; k < n(60); k++) {
        const a = Math.random() * Math.PI * 2
        const r = 3 + Math.random() * 7
        foam(x, footY + 0.2, z, Math.cos(a) * r, 0.4 + Math.random() * 2.5, Math.sin(a) * r, 0.5 + Math.random() * 0.5, 0.7 + Math.random() * 0.8)
        if (k % 2 === 0) drop(x, footY + 0.2, z, Math.cos(a) * r * 0.7, 0.5 + Math.random() * 2, Math.sin(a) * r * 0.7)
      }
      // Jet beneath the feet: dense and fast, breaking into droplets and bubbles.
      for (let k = 0; k < n(70); k++) {
        foam(x + rnd(0.2), footY + 0.4, z + rnd(0.2), rnd(1.4), -4 - Math.random() * 10, rnd(1.4), 0.4 + Math.random() * 0.4, 0.4 + Math.random() * 0.5)
        drop(x, footY + 0.3, z, rnd(2.2), -3 - Math.random() * 10, rnd(2.2))
        if (k % 2 === 0) mist(x, footY + 0.3, z, rnd(1.8), -2 - Math.random() * 6, rnd(1.8), 0.6, 0.6)
      }
      flashT = 0
      flash.position.set(x, y, z)
      flash.visible = true
      ringT = 0
      ring.position.set(x, footY + 0.15, z)
      ring.visible = true
    },

    // Bubbles and vapor shed behind the rocket (and a thinning wisp on the way down).
    trail(x, y, z, strength, dt) {
      // Spread the new particles along the path travelled this frame so a fast rocket leaves no gaps.
      const from = prevTrailY === null ? y : Math.min(y + 2, Math.max(y - 2, prevTrailY))
      prevTrailY = y
      const count = Math.round(strength * 130 * dt * S + Math.random())
      for (let k = 0; k < count; k++) {
        const yy = from + (y - from) * Math.random() + rnd(0.3)
        const px = x + rnd(0.35)
        const pz = z + rnd(0.35)
        const roll = Math.random()
        if (roll < 0.55) mist(px, yy, pz, rnd(0.8), -0.5 - Math.random() * 1.5, rnd(0.8), 0.7 + Math.random() * 0.6, 0.8 + Math.random() * 0.8)
        else foam(px, yy, pz, rnd(1), -1 - Math.random() * 2, rnd(1), 0.35 + Math.random() * 0.35, 0.6 + Math.random() * 0.6)
      }
      if (strength <= 0) prevTrailY = null
    },

    // pixelHeight = drawing-buffer height; sizes are metres, so convert with the camera's projection.
    update(dt, camera, pixelHeight) {
      time += dt
      lastDt = dt
      for (const cone of [jetCone, columnCone]) {
        cone.material.uniforms.time.value = time
        if (!cone.touched) {
          // Nobody drove it this frame: fade out and hide.
          cone.level *= Math.exp(-16 * dt)
          cone.mesh.visible = cone.mesh.visible && cone.level > 0.01
          cone.material.uniforms.strength.value = cone.level
        }
        cone.touched = false
      }
      mat.uniforms.time.value = time
      mat.uniforms.scale.value = pixelHeight / (2 * Math.tan((camera.fov * Math.PI) / 360))
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) {
          alpha[i] = 0
          continue
        }
        life[i] -= dt
        const kind = kindA[i]
        const u = 1 - Math.max(0, life[i]) / maxLife[i] // 0 -> 1 over the life
        const k = Math.exp(-drag[i] * dt)
        const wander = turb[i] * dt
        const seed = seedA[i] * 40
        vel[i * 3] = vel[i * 3] * k + Math.sin(time * 2.7 + seed) * wander
        vel[i * 3 + 1] = vel[i * 3 + 1] * k + lift[i] * dt
        vel[i * 3 + 2] = vel[i * 3 + 2] * k + Math.cos(time * 2.3 + seed * 1.7) * wander
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
        size[i] = size0[i] * (1 + (grow[i] - 1) * u)

        if (life[i] <= 0) {
          alpha[i] = 0
          if (kind === BUBBLE && pops[i]) {
            // Pop: a tiny ring of droplets where the bubble was.
            const m = Math.max(2, Math.floor(5 * S))
            for (let j = 0; j < m; j++) {
              const a = (j / m) * Math.PI * 2 + Math.random()
              const sp = 0.8 + Math.random() * 1.2
              drop(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], Math.cos(a) * sp, 0.5 + Math.random(), Math.sin(a) * sp, 0.035, 0.3 + Math.random() * 0.15)
            }
          }
          continue
        }
        const fadeIn = Math.min(1, u * 12)
        const fadeOut = kind === MIST ? 1 - u : kind === BUBBLE && pops[i] ? 1 : 1 - u * u * u
        alpha[i] = fadeIn * fadeOut * (kind === BUBBLE ? 1 : 0.9)
      }
      for (const name of ['position', 'color', 'size', 'alpha', 'kind', 'seed']) geo.attributes[name].needsUpdate = true

      if (flashT < 1) {
        flashT = Math.min(1, flashT + dt / 0.45)
        flash.material.opacity = 1 - flashT
        flash.scale.setScalar(2 + flashT * 9)
        if (flashT >= 1) flash.visible = false
      }
      if (ringT < 1) {
        ringT = Math.min(1, ringT + dt / 0.7)
        ring.material.opacity = (1 - ringT) * 0.9
        ring.scale.setScalar(0.5 + ringT * 8)
        if (ringT >= 1) ring.visible = false
      }
    },
  }
}
