// "Press E" interactions. Zones are registered by the scenery (lobby.js); each frame the
// nearest one in range drives the on-screen prompt, and holding E for INTERACT.holdMs
// against the same zone confirms it. Releasing early, or walking to another zone, resets
// the timer. A zone whose prompt has `hold: false` (e.g. "Equipped") shows plain text and
// cannot be confirmed. Same gate as Laser-Escape's systems/interact.js + interactHold.js.
import { INTERACT } from './config.js'
import { isInteractDown } from './input.js'
import { getActiveWorld, getBuildWorld, player } from './player.js'
import { createPrompt } from './prompt.js'

const zones = []
let ui = null
let say = () => {}
let ownerKey = null
let startedAt = 0

// zone: { key, x, y, z, prompt() -> { text, hold } | null, run() }. Belongs to the world being built
// (setBuildWorld in player.js); only the active world's zones can be used.
export function addZone(zone) {
  zones.push({ ...zone, world: getBuildWorld() })
}

export function initInteract({ say: toast }) {
  ui = createPrompt()
  say = toast
}

function nearest() {
  if (player.locked || document.body.classList.contains('win-open')) return null
  const p = player.position
  const r2 = INTERACT.padRange * INTERACT.padRange
  let best = null
  let bestD = r2
  for (const z of zones) {
    if (z.world !== getActiveWorld() || Math.abs(p.y - z.y) > INTERACT.padHeight) continue
    const d = (p.x - z.x) ** 2 + (p.z - z.z) ** 2
    if (d <= bestD) {
      bestD = d
      best = z
    }
  }
  return best
}

export function step() {
  if (!ui) return
  const zone = nearest()
  const info = zone?.prompt()
  if (!zone || !info) {
    ownerKey = null
    ui.hide()
    return
  }
  if (!info.hold || !isInteractDown()) {
    ownerKey = null
    ui.show(info.text, info.hold, 0)
    return
  }
  if (ownerKey !== zone.key) {
    ownerKey = zone.key
    startedAt = performance.now()
  }
  const progress = Math.min(1, (performance.now() - startedAt) / INTERACT.holdMs)
  ui.show(info.text, true, progress)
  if (progress >= 1) {
    ownerKey = null
    const msg = zone.run()
    if (msg) say(msg)
  }
}
