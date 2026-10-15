// Outer-space environment: the launch's virtual altitude (studs) darkens the sky to black, fades in stars
// and a nebula, drops the clouds and rainbows, tightens the fog so the ground dissolves below, and finally
// hides the ground + lobby. On the way up the sky passes through atmosphere layers (ATMOSPHERE stops: horizon /
// zenith colours) and the cloud decks (world.js) are shown while flying. Everything reuses the existing sky
// shader and fog, and nothing is touched while the altitude is unchanged.
import { Color } from 'three'
import { COLORS, SPACE, worldDef } from './config.js'

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

// Sky colours per altitude (studs): troposphere -> stratosphere -> mesosphere -> thermosphere glow.
// The first stop is the active world's own sky (setWorld); the climb into space is the same in every world.
const ATMOSPHERE = [
  { alt: 0, horizon: COLORS.horizon, zenith: COLORS.zenith },
  { alt: 150, horizon: '#7fc4ff', zenith: '#1a5cf0' },
  { alt: 600, horizon: '#ffcf9a', zenith: '#2a4fd0' }, // golden stratosphere haze
  { alt: 1500, horizon: '#ff9fb8', zenith: '#3b2fa8' }, // rose mesosphere
  { alt: 3000, horizon: '#a47bff', zenith: '#1b1470' }, // violet thermosphere
  { alt: 5000, horizon: '#3a4fd0', zenith: '#070a30' },
]
const stopColors = ATMOSPHERE.map((s) => ({ alt: s.alt, horizon: new Color(s.horizon), zenith: new Color(s.zenith) }))
const mixHorizon = new Color()
const mixZenith = new Color()
function atmosphereAt(alt) {
  let i = 0
  while (i < stopColors.length - 2 && alt > stopColors[i + 1].alt) i++
  const a = stopColors[i]
  const b = stopColors[i + 1]
  const t = Math.min(1, Math.max(0, (alt - a.alt) / (b.alt - a.alt)))
  mixHorizon.copy(a.horizon).lerp(b.horizon, t)
  mixZenith.copy(a.zenith).lerp(b.zenith, t)
}

// `world` = { group, tower, ground } of the active world (setWorld); its `tower` stays visible at every altitude
// and ignores the fog, so the shaft is always there to see.
export function createSpace({ sky, decor, decks, fog, hemi }) {
  const night = new Color(SPACE.spaceColor)
  const u = sky.material.uniforms
  let last = -1
  let towerFog = true
  let world = null
  let def = worldDef('lobby')
  const setTowerFog = (on) => {
    if (on === towerFog) return
    towerFog = on
    world.tower.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) {
        m.fog = on
        m.needsUpdate = true
      }
    })
  }
  const space = {
    setWorld(entry, nextDef) {
      world = entry
      def = nextDef
      stopColors[0].horizon.set(def.sky.horizon)
      stopColors[0].zenith.set(def.sky.zenith)
      towerFog = true
      world.tower.traverse((o) => {
        for (const m of [].concat(o.material ?? [])) m.fog = true
      })
      last = -1
      space.update(0)
    },
    update(altitude) {
      if (altitude === last || !world) return
      last = altitude
      const flightDark = smooth(SPACE.darkFrom, SPACE.darkTo, altitude)
      const dark = Math.max(def.baseDark ?? 0, flightDark)
      atmosphereAt(altitude)
      u.bottom.value.copy(mixHorizon)
      u.top.value.copy(mixZenith)
      u.dark.value = dark
      u.stars.value = Math.max(def.baseStars ?? 0, smooth(SPACE.starsFrom, SPACE.starsTo, altitude))
      u.nebula.value = Math.max(def.baseNebula ?? 0, smooth(SPACE.nebulaFrom, SPACE.nebulaTo, altitude))
      u.limb.value = smooth(100, 900, altitude) * (1 - 0.4 * dark) // bright atmosphere rim on the horizon
      decor.userData.setFade(def.decor === false ? 0 : 1 - smooth(0, SPACE.decorFade, dark))
      decks.userData.setFade(altitude > 0 ? 1 - smooth(0.6, 0.95, dark) : 0)
      fog.color.copy(mixHorizon).lerp(night, dark)
      fog.near = lerp(def.fog.near, SPACE.fogNear, flightDark)
      fog.far = lerp(def.fog.far, SPACE.fogFar, flightDark)
      hemi.intensity = def.light.hemiIntensity * (1 - SPACE.hemiDim * flightDark)
      const scenery = dark < SPACE.hideScenery
      world.ground.visible = scenery
      for (const child of world.group.children) child.visible = scenery || child === world.tower
      setTowerFog(dark < 0.05)
    },
  }
  return space
}
