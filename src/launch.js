// Soda Jump launch sequence: step on the pad -> controls lock -> the player grabs the can with
// both hands -> shakes it -> it bursts -> the player rockets LAUNCH.height metres straight up,
// then falls under normal gravity and gets control back on touchdown.
//
// Phases: idle -> grab -> shake -> rise -> fall -> land -> idle. `launch` is the read-only state
// the animator (pose), camera (framing / shake) and player (input lock) consume.
import { LAUNCH, LAUNCH_PAD, SFX, SPACE } from './config.js'
import { launchStuds } from './state.js'
import { baseGravity, player } from './player.js'
import { getYaw } from './camera.js'
import { createLaunchFx } from './launchFx.js'
import { playBurst, playCanShake, playCharge, setFizz, stopFizz } from './sfx.js'

const TAU = Math.PI * 2
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (t) => t * t * (3 - 2 * t)

export const launch = {
  phase: 'idle',
  t: 0, // s in the current phase
  hold: false, // pose both hands on the can
  grab: 0, // 0..1 raising the can into both hands
  intensity: 0, // 0..1 shake strength
  charge: 0, // 0..1 pressure build-up just before the burst (can bulges)
  shakePhase: 0, // radians, advances faster as the shake builds
  canGone: false, // the can has burst
  boost: 0, // 0..1 camera widening (FOV / boom)
  shake: 0, // 0..1 camera shake amplitude
  warp: 0, // 0..1 the 20K Summit was hit: light burst + 'next world' (flightHud, player glow)
  speed: 0, // 0..1 vertical speed while flying (speed lines, extra FOV)
  peak: 0, // studs this launch will reach (state.launchStuds at the burst)
  altitude: 0, // studs now: peak x (real height / real apex). Virtual, drives the sky + flight HUD
}
const landListeners = new Set()
export function onLaunchLand(fn) {
  landListeners.add(fn)
  return () => landListeners.delete(fn)
}
let apexY = 1 // real feet height of this launch's apex

let fx = null
let lastShakeCycle = 0
let chargeSfx = false // pressure riser played for this shake
let armed = true
let impulse = 0 // burst kick for the camera shake, decays
let sinceBurst = null // s since the can burst while the jet / column / fountain are still alive

export function initLaunch(scene) {
  fx = createLaunchFx()
  scene.add(fx.group)
}

function setPhase(next) {
  launch.phase = next
  launch.t = 0
}

const distToPad = () => Math.hypot(player.position.x - LAUNCH_PAD.x, player.position.z - LAUNCH_PAD.z)

// Turns `from` toward `to` the short way, exponentially.
function turnToward(from, to, rate, dt) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + diff * (1 - Math.exp(-rate * dt))
}

// Drops the sequence on the spot (world warp): the player is handed back, gravity restored.
export function cancelLaunch() {
  launch.hold = launch.canGone = false
  launch.intensity = launch.charge = launch.peak = launch.altitude = launch.warp = 0
  stopFizz()
  player.gravity = baseGravity()
  sinceBurst = null
  armed = false
  setPhase('idle')
}

export function updateLaunch(dt, camera, pixelHeight) {
  const p = player.position
  launch.t += dt
  if (launch.phase !== 'idle' && !player.locked) {
    // Something else took the player (respawn / teleport): abandon the sequence.
    launch.hold = launch.canGone = false
    launch.intensity = 0
    stopFizz()
    player.gravity = baseGravity()
    setPhase('idle')
  }

  switch (launch.phase) {
    case 'idle':
      if (!armed && distToPad() > LAUNCH.rearmDistance) armed = true
      if (armed && player.grounded && p.y < 0.5 && distToPad() < LAUNCH.triggerRadius) {
        armed = false
        player.locked = true
        launch.hold = true
        launch.canGone = false
        launch.shakePhase = 0
        lastShakeCycle = 0
        chargeSfx = false
        setPhase('grab')
      }
      break

    case 'grab':
    case 'shake': {
      // Glide to the pad centre and face the camera so the shake is seen from the front.
      const k = 1 - Math.exp(-LAUNCH.alignRate * dt)
      p.x += (LAUNCH_PAD.x - p.x) * k
      p.z += (LAUNCH_PAD.z - p.z) * k
      player.velocity.x = player.velocity.z = 0
      player.facing = turnToward(player.facing, getYaw(), LAUNCH.alignRate, dt)

      if (launch.phase === 'grab') {
        launch.grab = ease(clamp01(launch.t / LAUNCH.grab))
        if (launch.t >= LAUNCH.grab) setPhase('shake')
        break
      }
      launch.grab = 1
      const u = clamp01(launch.t / LAUNCH.shake)
      launch.intensity = ease(clamp01(u * 1.25)) // builds fast, then stays at full
      launch.shakePhase = (launch.shakePhase + TAU * LAUNCH.shakeHz * (0.35 + 0.65 * launch.intensity) * dt) % (TAU * 1000)
      const canX = p.x + Math.sin(player.facing) * LAUNCH.canForward
      const canZ = p.z + Math.cos(player.facing) * LAUNCH.canForward
      const open = clamp01((u - 0.35) / 0.5) // 0 = sealed, only water inside
      if (launch.charge < SFX.preBurstGap) setFizz(launch.intensity * open)
      else stopFizz() // a beat of near-silence before the pop
      if (Math.floor(launch.shakePhase / TAU) !== lastShakeCycle) {
        lastShakeCycle = Math.floor(launch.shakePhase / TAU)
        playCanShake(launch.intensity, open)
      }
      if (launch.charge <= 0) fx?.hiss(canX, p.y + LAUNCH.canHeight, canZ, launch.intensity, dt) // mist hiss until the pressure build-up
      // Pressure build-up just before the pop: the can bulges, foam leaks and swells on the pad.
      launch.charge = clamp01((launch.t - (LAUNCH.shake - LAUNCH.fx.chargeTime)) / LAUNCH.fx.chargeTime)
      if (launch.charge > 0 && !chargeSfx) {
        chargeSfx = true
        playCharge(LAUNCH.fx.chargeTime)
      }
      if (launch.charge > 0) fx?.charge(canX, p.y + LAUNCH.canHeight, canZ, p.y, launch.charge, dt)
      if (launch.t >= LAUNCH.shake) {
        launch.charge = 0
        sinceBurst = 0
        // BURST: the can pops and the pressure throws the player up exactly `height` metres.
        launch.canGone = true
        launch.hold = false
        launch.intensity = 0
        impulse = 1
        playBurst()
        launch.peak = launchStuds()
        // 0 at the minimum launch (baseStuds) -> 1 at the Summit, so the plain launch rises exactly LAUNCH.height.
        const s0 = Math.sqrt(SPACE.baseStuds / SPACE.summit)
        const k = Math.max(0, (Math.sqrt(launch.peak / SPACE.summit) - s0) / (1 - s0))
        const rise = LAUNCH.height + (LAUNCH.maxHeight - LAUNCH.height) * k
        apexY = p.y + rise
        // Lower gravity for the flight so the apex takes riseTime seconds (not ~2): g = 2 * rise / T^2.
        const riseTime = LAUNCH.riseTimeMin + (LAUNCH.riseTimeMax - LAUNCH.riseTimeMin) * k
        player.gravity = -Math.min(-baseGravity(), (2 * rise) / (riseTime * riseTime))
        player.velocity.y = Math.sqrt(2 * -player.gravity * rise)
        player.grounded = false
        fx?.burst(
          p.x + Math.sin(player.facing) * LAUNCH.canForward, p.y + LAUNCH.canHeight, p.z + Math.cos(player.facing) * LAUNCH.canForward, p.y,
        )
        setPhase('rise')
      }
      break
    }

    case 'rise':
      player.velocity.x = player.velocity.z = 0
      fx?.trail(p.x, p.y, p.z, 1, dt)
      if (player.velocity.y <= 0) setPhase('fall')
      break

    case 'fall':
      player.velocity.x = player.velocity.z = 0
      fx?.trail(p.x, p.y, p.z, Math.max(0, 1 - launch.t / 0.8), dt)
      if (player.grounded && launch.t > 0.3) {
        player.gravity = baseGravity()
        setPhase('land')
        const peak = launch.peak
        launch.peak = 0
        for (const fn of landListeners) fn(peak)
      }
      break

    case 'land':
      if (launch.t >= LAUNCH.landLock) {
        player.locked = false
        launch.canGone = false
        setPhase('idle')
      }
      break
  }

  // The cola jet under the feet is what pushes the player: attached while they rise, cut off after
  // jetTime. A thin foam column then marks the path up from the pad and fades; the pad keeps fountaining.
  if (sinceBurst !== null) {
    sinceBurst += dt
    const F = LAUNCH.fx
    const jet = sinceBurst < F.jetTime ? 1 - 0.5 * (sinceBurst / F.jetTime) ** 2 : 0
    const column = sinceBurst < F.jetTime ? 1 : clamp01(1 - (sinceBurst - F.jetTime) / F.columnTime)
    const fountain = clamp01(1 - sinceBurst / F.fountainTime)
    fx?.jet(p.x, p.y, p.z, 0, jet, dt)
    fx?.column(LAUNCH_PAD.x, LAUNCH_PAD.z, 0, p.y, p.x, p.z, column)
    fx?.fountain(LAUNCH_PAD.x, 0, LAUNCH_PAD.z, fountain, dt)
    if (sinceBurst > F.jetTime + F.columnTime && fountain <= 0) sinceBurst = null
  }

  // Virtual altitude follows the real height, so the sky changes in step with the rise and fall.
  const flying = launch.phase === 'rise' || launch.phase === 'fall'
  launch.altitude = flying ? launch.peak * clamp01(p.y / apexY) : 0

  const atSummit = flying && launch.peak >= SPACE.summit && launch.altitude >= SPACE.summit * 0.97
  launch.warp += ((atSummit ? 1 : 0) - launch.warp) * (1 - Math.exp(-(atSummit ? 6 : 1.2) * dt))
  if (launch.warp < 0.001) launch.warp = 0
  launch.speed = flying ? clamp01(Math.abs(player.velocity.y) / 90) : 0
  const airborne = launch.phase === 'rise' || launch.phase === 'fall'
  launch.boost += ((airborne ? 1 : 0) - launch.boost) * (1 - Math.exp(-LAUNCH.camEase * dt))
  impulse *= Math.exp(-5 * dt)
  launch.shake = Math.max(launch.intensity * launch.intensity * 0.6, launch.charge * 0.9, impulse, launch.speed * 0.35)
  if (sinceBurst !== null && sinceBurst < LAUNCH.fx.jetTime) launch.shake = Math.max(launch.shake, 0.5) // the jet rumbles

  fx?.update(dt, camera, pixelHeight)
}
