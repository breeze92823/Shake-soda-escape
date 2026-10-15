// Procedural soda item models (the east-wall display and the can in every avatar's hand).
// Each is built upright with its base on y = 0, roughly 1-1.4 m tall.
import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import { WORLD_SODAS } from './config.js'

const flat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })

export function sodaItem(kind) {
  const g = new Group()
  const add = (mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  switch (kind) {
    case 'cola': {
      // Red can with a white chevron logo.
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 128
      const x = c.getContext('2d')
      x.fillStyle = '#e3121c'
      x.fillRect(0, 0, 256, 128)
      x.strokeStyle = '#ffffff'
      x.lineWidth = 16
      x.lineJoin = 'round'
      x.beginPath()
      x.moveTo(100, 30)
      x.lineTo(140, 64)
      x.lineTo(100, 98)
      x.stroke()
      const tex = new CanvasTexture(c)
      tex.colorSpace = SRGBColorSpace
      add(new Mesh(new CylinderGeometry(0.38, 0.38, 1.0, 24), flat('#ffffff', { map: tex })), 0, 0.5, 0)
      add(new Mesh(new CylinderGeometry(0.33, 0.38, 0.06, 24), flat('#cfd3d8', { metalness: 0.6, roughness: 0.3 })), 0, 1.03, 0)
      break
    }
    case 'orange':
      add(new Mesh(new SphereGeometry(0.48, 24, 16), flat('#ff8c12')), 0, 0.48, 0)
      add(new Mesh(new CylinderGeometry(0.04, 0.05, 0.16, 6), flat('#5a3a1a')), 0, 1.0, 0)
      break
    case 'lemon': {
      const body = add(new Mesh(new SphereGeometry(0.5, 24, 16), flat('#ffd81a')), 0, 0.42, 0)
      body.scale.set(1.15, 0.85, 1)
      const pin = add(new Mesh(new TorusGeometry(0.22, 0.05, 8, 24), flat('#33c43a')), 0.32, 0.95, 0)
      pin.rotation.y = Math.PI / 2
      add(new Mesh(new BoxGeometry(0.16, 0.2, 0.16), flat('#2e8a2e')), 0, 0.85, 0)
      break
    }
    case 'cherry':
      add(new Mesh(new SphereGeometry(0.5, 24, 16), flat('#d0101a', { roughness: 0.35 })), 0, 0.5, 0)
      add(new Mesh(new CylinderGeometry(0.035, 0.035, 0.5, 6), flat('#3d2a12')), 0.05, 1.15, 0).rotation.z = -0.3
      add(new Mesh(new SphereGeometry(0.12, 10, 8), flat('#2fae2f')), 0.18, 1.3, 0).scale.set(1.4, 0.5, 0.8)
      break
    case 'slush':
      add(new Mesh(new CylinderGeometry(0.42, 0.3, 0.95, 24), flat('#2fd2ff', { roughness: 0.3 })), 0, 0.48, 0)
      add(new Mesh(new SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), flat('#e8fbff', { transparent: true, opacity: 0.85 })), 0, 0.95, 0)
      add(new Mesh(new CylinderGeometry(0.04, 0.04, 0.7, 8), flat('#ff3b5c')), 0.1, 1.35, 0).rotation.z = -0.25
      break
    case 'strawberry':
      add(new Mesh(new BoxGeometry(0.8, 0.95, 0.8), flat('#ff7ad6')), 0, 0.48, 0)
      add(new Mesh(new BoxGeometry(0.82, 0.12, 0.82), flat('#ffffff')), 0, 1.0, 0)
      add(new Mesh(new BoxGeometry(0.5, 0.3, 0.06), flat('#ff3fb0')), 0, 0.5, 0.41)
      break
    case 'ufo': {
      // Grape UFO: glassy cyan ball with a pink straw.
      add(new Mesh(new SphereGeometry(0.5, 24, 16), flat('#4fe8ff', { emissive: '#0a8fb0', transparent: true, opacity: 0.92, roughness: 0.25 })), 0, 0.5, 0)
      add(new Mesh(new CylinderGeometry(0.04, 0.04, 0.8, 8), flat('#ff3fb0')), 0.12, 1.12, 0).rotation.z = -0.3
      break
    }
    case 'lime': {
      // Lime Lab: green conical flask.
      const glass = flat('#5cff4a', { emissive: '#1a7a10', transparent: true, opacity: 0.9 })
      add(new Mesh(new CylinderGeometry(0.12, 0.45, 0.7, 20), glass), 0, 0.35, 0)
      add(new Mesh(new CylinderGeometry(0.12, 0.12, 0.35, 12), glass), 0, 0.87, 0)
      add(new Mesh(new CylinderGeometry(0.15, 0.15, 0.1, 12), flat('#7a4a1e')), 0, 1.08, 0)
      break
    }
    case 'cream':
      // Cream Float: yellow cup topped with a scoop and a cherry.
      add(new Mesh(new CylinderGeometry(0.38, 0.3, 0.8, 24), flat('#ffd23a')), 0, 0.4, 0)
      add(new Mesh(new SphereGeometry(0.36, 20, 12), flat('#fff6e0')), 0, 0.85, 0)
      add(new Mesh(new SphereGeometry(0.09, 10, 8), flat('#e3121c')), 0, 1.22, 0)
      break
    case 'galaxy': {
      // Galaxy Shake: round purple potion bottle.
      add(new Mesh(new SphereGeometry(0.42, 24, 16), flat('#a42cff', { emissive: '#3a0a6a', roughness: 0.3 })), 0, 0.42, 0)
      add(new Mesh(new CylinderGeometry(0.11, 0.13, 0.3, 12), flat('#d9b3ff', { transparent: true, opacity: 0.85 })), 0, 0.92, 0)
      add(new Mesh(new CylinderGeometry(0.13, 0.13, 0.1, 12), flat('#5a3a1a')), 0, 1.1, 0)
      break
    }
    case 'rainbow': {
      // Rainbow Juice: cup in stacked colour bands with a straw.
      const bands = ['#ff2a2a', '#ff9a1a', '#ffe11a', '#3ad13a', '#2a8cff', '#9b3cff']
      bands.forEach((col, i) => add(new Mesh(new CylinderGeometry(0.33, 0.3, 0.16, 20), flat(col)), 0, 0.08 + i * 0.16, 0))
      add(new Mesh(new CylinderGeometry(0.04, 0.04, 0.6, 8), flat('#ffffff')), 0.1, 1.15, 0).rotation.z = -0.25
      break
    }
    case 'void': {
      // Void Soda: near-black can with a glowing purple band and a swirl-ringed rim.
      const glow = flat('#b13cff', { emissive: '#8a1bff', emissiveIntensity: 1.2 })
      add(new Mesh(new CylinderGeometry(0.38, 0.38, 1.0, 24), flat('#150a22', { metalness: 0.4, roughness: 0.3 })), 0, 0.5, 0)
      add(new Mesh(new CylinderGeometry(0.39, 0.39, 0.22, 24), glow), 0, 0.5, 0)
      add(new Mesh(new CylinderGeometry(0.33, 0.38, 0.06, 24), flat('#7a3cff', { metalness: 0.6, roughness: 0.3 })), 0, 1.03, 0)
      add(new Mesh(new TorusGeometry(0.46, 0.03, 8, 32), glow), 0, 0.5, 0).rotation.x = Math.PI / 2
      break
    }
    case 'trophy': {
      // Gold goblet: round foot, stem, bowl and a crown of spikes round the rim.
      const gold = flat('#ffc61a', { metalness: 0.5, roughness: 0.3, emissive: '#6a4300' })
      add(new Mesh(new CylinderGeometry(0.35, 0.4, 0.12, 20), gold), 0, 0.06, 0)
      add(new Mesh(new CylinderGeometry(0.07, 0.12, 0.4, 12), gold), 0, 0.32, 0)
      add(new Mesh(new CylinderGeometry(0.46, 0.18, 0.55, 24), gold), 0, 0.8, 0)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        add(new Mesh(new ConeGeometry(0.1, 0.3, 6), gold), Math.cos(a) * 0.4, 1.22, Math.sin(a) * 0.4)
      }
      break
    }
    default: {
      // World sodas (WORLD_SODAS): a can, bottle or cup in the soda's colours.
      const look = Object.values(WORLD_SODAS).flat().find((s) => s.kind === kind)?.look
      if (!look) break
      const glowing = look.glow ? { emissive: look.accent, emissiveIntensity: 0.35 } : {}
      const body = flat(look.color, { roughness: 0.35, ...glowing })
      const trim = flat(look.accent, look.glow ? { emissive: look.accent, emissiveIntensity: 1 } : {})
      const metal = flat('#cfd3d8', { metalness: 0.6, roughness: 0.3 })
      if (look.shape === 'can') {
        add(new Mesh(new CylinderGeometry(0.38, 0.38, 1.0, 24), body), 0, 0.5, 0)
        add(new Mesh(new CylinderGeometry(0.39, 0.39, 0.24, 24), trim), 0, 0.5, 0)
        add(new Mesh(new CylinderGeometry(0.33, 0.38, 0.06, 24), metal), 0, 1.03, 0)
      } else if (look.shape === 'bottle') {
        add(new Mesh(new SphereGeometry(0.44, 24, 16), body), 0, 0.44, 0)
        add(new Mesh(new CylinderGeometry(0.11, 0.15, 0.4, 12), body), 0, 0.95, 0)
        add(new Mesh(new CylinderGeometry(0.15, 0.15, 0.12, 12), trim), 0, 1.2, 0)
      } else {
        add(new Mesh(new CylinderGeometry(0.4, 0.3, 0.8, 24), body), 0, 0.4, 0)
        add(new Mesh(new SphereGeometry(0.37, 20, 12), flat('#ffffff', { roughness: 0.5 })), 0, 0.85, 0)
        add(new Mesh(new CylinderGeometry(0.04, 0.04, 0.7, 8), trim), 0.12, 1.3, 0).rotation.z = -0.25
      }
      break
    }
  }
  return g
}
