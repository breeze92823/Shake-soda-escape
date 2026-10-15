// Player progress shown by the HUD. Plain object + change listeners; gameplay
// mutates `state` then calls notify().
import { AURAS, DEFAULT_SODA, HUD_START, REBIRTH, SHOP, SODA_GAIN, SODA_ITEMS, SPACE, VOID_SODA, levelXp } from './config.js'
import { player } from './player.js'

// equipped = soda item in every avatar's hand; passes = owned boost passes ('soda' | 'wins').
// dailyDay = next day (0-6) of the daily reward cycle, dailyClaimedAt = epoch ms of the last claim (0 = never).
export const state = { ...HUD_START, equipped: DEFAULT_SODA, owned: new Set([DEFAULT_SODA]), passes: new Set(), record: 0, sodaBoostUntil: 0, auras: new Set(), aura: null, dailyDay: 0, dailyClaimedAt: 0 }

// Wall clock, corrected to the server's once it has told us the time (net.js), so daily-reward timers and the
// soda boost can't be skipped by changing the device clock.
let clockOffset = 0
export const setServerTime = (ms) => Number.isFinite(ms) && (clockOffset = ms - Date.now())
export const now = () => Date.now() + clockOffset

export const auraMult = () => AURAS.find((a) => a.id === state.aura)?.mult ?? 1

const GAIN = Object.fromEntries([...SODA_ITEMS.front, ...SODA_ITEMS.back, VOID_SODA].map((i) => [i.kind, i.gain]))
const ORDER = [...SODA_ITEMS.front, ...SODA_ITEMS.back].map((i) => i.kind)
// 'equipped' | 'owned' | 'next' (buyable now) | 'locked' (an earlier soda isn't owned yet). Void Soda is always buyable.
export function sodaStatus(kind) {
  if (state.equipped === kind) return 'equipped'
  if (state.owned.has(kind)) return 'owned'
  if (kind === VOID_SODA.kind) return 'next'
  return ORDER.find((k) => !state.owned.has(k)) === kind ? 'next' : 'locked'
}

// Peak altitude (studs) of the next launch: the soda total (at least baseStuds), capped by the equipped soda.
export function launchStuds() {
  const cap = Math.max(SPACE.baseStuds, SPACE.summit * Math.min(1, (GAIN[state.equipped] ?? 1) / SPACE.summitGain))
  return Math.round(Math.min(cap, Math.max(SPACE.baseStuds, state.soda)))
}
export const landReward = (studs) => Math.round(studs * SPACE.winsPerStud * (state.passes.has('wins') ? 2 : 1))

// Pay `price` Wins; returns false (and changes nothing) when the player can't afford it.
export function spendWins(price) {
  if (state.wins < price) return false
  state.wins -= price
  notify()
  return true
}

const listeners = new Set()
export function subscribe(fn) {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}
export function notify() {
  listeners.forEach((fn) => fn(state))
}

// At rebirth n: the Soda multiplier and the level needed to rebirth again.
export const rebirthMult = (n) => 1 + n * REBIRTH.multStep
export const rebirthLevel = (n) => REBIRTH.levelBase + n * REBIRTH.levelStep
export const canRebirth = () => state.level >= rebirthLevel(state.rebirths)

// Rebirth now (level reset) or via Skip Rebirth (keepLevel). Returns false when not ready.
export function rebirth({ keepLevel = false } = {}) {
  if (!keepLevel && !canRebirth()) return false
  state.rebirths++
  if (!keepLevel) Object.assign(state, { level: 1, xp: 0, xpNext: levelXp(1) })
  notify()
  return true
}

// Click/hold on the world: +item gain x treadmill x rebirth multiplier soda and level xp. The cooldown
// is real, so mashing can't beat holding. hud.js floats the "+N" pop and plays the sound.
// x1..x32 while the player stands on an unlocked treadmill belt, else 1.
// Index of the belt the player stands on, or -1.
export function treadmillAt() {
  const { gateX, gateZ, belt } = SHOP
  if (Math.abs(player.position.x - gateX) > belt.length / 2) return -1
  return gateZ.findIndex((z) => Math.abs(player.position.z - z) <= belt.width / 2)
}
// Belt the player is standing on AND has unlocked (it runs, the player runs, soda auto-gains), else -1.
export function runningBelt() {
  const i = treadmillAt()
  return i >= 0 && state.rebirths >= SHOP.rebirths[i] ? i : -1
}
export function treadmillMult() {
  const i = treadmillAt()
  return i >= 0 && state.rebirths >= SHOP.rebirths[i] ? SHOP.mults[i] : 1
}

let lastGain = -Infinity
const gainListeners = new Set()
export function onSodaGain(fn) {
  gainListeners.add(fn)
  return () => gainListeners.delete(fn)
}
export function gainSoda() {
  const t = performance.now()
  if (t - lastGain < SODA_GAIN.interval * 1000) return
  lastGain = t
  const gained = (GAIN[state.equipped] ?? 1) * treadmillMult() * rebirthMult(state.rebirths) * auraMult() * (state.passes.has('soda') ? 2 : 1) * (now() < state.sodaBoostUntil ? 2 : 1)
  state.soda += gained
  state.xp += gained
  // Levels stop at the current rebirth's cap (Level 10 at Rebirth 0); rebirth to go further.
  const cap = rebirthLevel(state.rebirths)
  while (state.level < cap && state.xp >= state.xpNext) {
    state.xp -= state.xpNext
    state.level += 1
    state.xpNext = levelXp(state.level)
  }
  if (state.level >= cap) state.xp = Math.min(state.xp, state.xpNext)
  notify()
  for (const fn of gainListeners) fn(gained)
}
