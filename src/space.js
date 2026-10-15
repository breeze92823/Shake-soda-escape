// Outer-space environment: the launch's virtual altitude (studs) darkens the sky to black, fades in stars
// and a nebula, drops the clouds and rainbows, tightens the fog so the ground dissolves below, and finally
// hides the ground + lobby. Everything reuses the existing sky shader and fog (no extra geometry), and
// nothing is touched while the altitude is unchanged.
import { Color } from 'three'
import { COLORS, FOG, LIGHT, SPACE } from './config.js'

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

// `tower` (a child of `lobby`) stays visible at every altitude and ignores the fog, so the shaft is always there to see.
export function createSpace({ sky, decor, ground, lobby, tower, fog, hemi }) {
  const day = new Color(COLORS.horizon)
  const night = new Color(SPACE.spaceColor)
  const u = sky.material.uniforms
  let last = -1
  let towerFog = true
  const setTowerFog = (on) => {
    if (on === towerFog) return
    towerFog = on
    tower.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) {
        m.fog = on
        m.needsUpdate = true
      }
    })
  }
  return {
    update(altitude) {
      if (altitude === last) return
      last = altitude
      const dark = smooth(SPACE.darkFrom, SPACE.darkTo, altitude)
      u.dark.value = dark
      u.stars.value = smooth(SPACE.starsFrom, SPACE.starsTo, altitude)
      u.nebula.value = smooth(SPACE.nebulaFrom, SPACE.nebulaTo, altitude)
      decor.userData.setFade(1 - smooth(0, SPACE.decorFade, dark))
      fog.color.copy(day).lerp(night, dark)
      fog.near = lerp(FOG.near, SPACE.fogNear, dark)
      fog.far = lerp(FOG.far, SPACE.fogFar, dark)
      hemi.intensity = LIGHT.hemiIntensity * (1 - SPACE.hemiDim * dark)
      const scenery = dark < SPACE.hideScenery
      ground.visible = scenery
      for (const child of lobby.children) child.visible = scenery || child === tower
      setTowerFog(dark < 0.05)
    },
  }
}
