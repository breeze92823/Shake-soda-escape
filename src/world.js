import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  ShaderMaterial,
  BackSide,
  DoubleSide,
  Group,
  MeshLambertMaterial,
  RingGeometry,
} from 'three'
import { COLORS, FOG, GROUND_SIZE, GROUND_Y, LIGHT, MATERIAL_PBR } from './config.js'
import { studTexture } from './textures.js'

// Everything is procedural: the baseplate studs are painted to a canvas once,
// the sky is a gradient shader with a rainbow and clouds, the lights are plain
// three lights. No imported assets.

// Studded green baseplate, like a Roblox Baseplate part.
export function createGround() {
  const map = studTexture(COLORS.baseplate, 0.5, 0.55).clone()
  const tile = map.userData.tileMetres
  map.repeat.set(GROUND_SIZE / tile, GROUND_SIZE / tile)
  map.needsUpdate = true
  const mesh = new Mesh(new PlaneGeometry(GROUND_SIZE, GROUND_SIZE), new MeshStandardMaterial({ map, ...MATERIAL_PBR.GROUND }))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = GROUND_Y
  mesh.receiveShadow = true
  return mesh
}

// Day gradient that darkens into outer space with altitude (space.js drives the uniforms): `dark` fades
// the blue to black, `stars` and `nebula` fade the night layers in. All procedural, drawn on the sky sphere only.
export function createSky() {
  const mesh = new Mesh(
    new SphereGeometry(250, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new Color(COLORS.zenith) },
        bottom: { value: new Color(COLORS.horizon) },
        dark: { value: 0 },
        stars: { value: 0 },
        nebula: { value: 0 },
      },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform float dark; uniform float stars; uniform float nebula; varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          vec3 col = mix(bottom, top, smoothstep(0.0, 0.6, d.y));
          if (dark > 0.001) {
            float n = fbm(d * 2.4);
            vec3 neb = mix(vec3(0.05, 0.12, 0.7), vec3(0.85, 0.12, 0.4), fbm(d * 3.0 + 7.0)) * pow(n, 2.2) * 2.6;
            float core = pow(max(dot(d, normalize(vec3(-0.7, 0.1, -0.7))), 0.0), 10.0);
            neb += vec3(1.0, 0.4, 0.3) * core * 0.9;
            vec3 g = d * 150.0;
            float star = step(0.985, hash(floor(g))) * smoothstep(0.25, 0.0, length(fract(g) - 0.5));
            vec3 night = vec3(0.004, 0.004, 0.02) + neb * nebula + vec3(star) * stars;
            col = mix(col, night, dark);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  )
  mesh.renderOrder = -1
  return mesh
}

function makeRainbow(position, inner, outer) {
  const rainbow = new Mesh(
    new RingGeometry(inner, outer, 96, 1, 0, Math.PI),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { inner: { value: inner }, outer: { value: outer }, fade: { value: 1 } },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float inner; uniform float outer; uniform float fade; varying vec2 vP;
        vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main() {
          float t = (length(vP) - inner) / (outer - inner);
          float edge = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
          // Outer edge red, inner edge violet.
          gl_FragColor = vec4(mix(hue((1.0 - t) * 0.78), vec3(1.0), 0.12), 0.8 * edge * fade);
        }`,
    }),
  )
  rainbow.position.set(...position)
  rainbow.lookAt(0, 0, 0)
  rainbow.renderOrder = -1
  return rainbow
}

// Rainbow arcs and puffy clouds, drawn behind everything (no fog, no depth write)
// so they read as part of the sky even though they sit past the sky sphere.
export function createSkyDecor() {
  const group = new Group()

  // Each arc is centred below the horizon and faces the arena, so only its
  // upper part shows: one climbing out of the east wall past the tower, a
  // bigger one spanning the west wall.
  const rainbows = [makeRainbow([220, -118, -127], 330, 352), makeRainbow([-300, -60, -10], 230, 248)]
  group.add(...rainbows)

  const cloudMat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#c9dcff', emissiveIntensity: 0.55, fog: false, transparent: true })
  const blob = new SphereGeometry(1, 20, 14)
  // [x, y, z, scale] of each cloud; each is a cluster of flattened spheres.
  const clouds = [
    [70, 32, -190, 15],
    [-95, 62, -170, 9],
    [-30, 78, -210, 7],
    [150, 50, -60, 10],
    [-150, 40, 40, 11],
    [40, 55, 190, 12],
  ]
  const puffs = [
    [0, 0, 0, 1.5], [1.4, -0.3, 0.2, 1.2], [-1.4, -0.35, 0, 1.15], [0.6, 0.75, 0, 1.05],
    [-0.7, 0.6, -0.2, 0.95], [2.5, -0.6, 0, 0.85], [-2.5, -0.6, 0.2, 0.8], [0, -0.5, 0.8, 1.1],
  ]
  for (const [x, y, z, k] of clouds) {
    const cloud = new Group()
    for (const [px, py, pz, r] of puffs) {
      const m = new Mesh(blob, cloudMat)
      m.position.set(px, py, pz)
      m.scale.set(r, r * 0.85, r)
      cloud.add(m)
    }
    cloud.position.set(x, y, z)
    cloud.scale.setScalar(k)
    cloud.lookAt(0, y, 0)
    group.add(cloud)
  }
  // 1 = full day, 0 = gone (space.js): clouds and rainbows dissolve as the sky darkens.
  group.userData.setFade = (f) => {
    cloudMat.opacity = f
    for (const r of rainbows) r.material.uniforms.fade.value = f
    group.visible = f > 0.01
  }
  return group
}

// Hemisphere fill + one shadow-casting sun. The sun's shadow box follows the
// player so a small map covers the whole play area at full resolution.
export function createLights() {
  const hemi = new HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemiIntensity)
  const sun = new DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity)
  const offset = { x: LIGHT.sunPosition[0], y: LIGHT.sunPosition[1], z: LIGHT.sunPosition[2] }
  sun.castShadow = true
  sun.shadow.mapSize.set(LIGHT.shadowMapSize, LIGHT.shadowMapSize)
  const r = LIGHT.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 150 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03

  const follow = (x, z) => {
    sun.position.set(x + offset.x, offset.y, z + offset.z)
    sun.target.position.set(x, 0, z)
    sun.target.updateMatrixWorld()
  }
  follow(0, 0)
  return { hemi, sun, follow }
}

export const createFog = () => new Fog(COLORS.horizon, FOG.near, FOG.far)
