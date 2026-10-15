// Procedural sound effects (Web Audio, no assets): can shake rattle, fizz hiss, can burst.
// Never throws; silent until the browser allows audio (first user gesture).
import { SFX } from './config.js'

let ctx = null
let master = null
let noise = null
let lastShake = -1
let fizz = null // { src, gain, filter } while the launch shake hiss runs

function ensure() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      const comp = ctx.createDynamicsCompressor() // keeps stacked sounds from clipping
      master = ctx.createGain()
      master.gain.value = SFX.master
      master.connect(comp).connect(ctx.destination)
      // One shared 2 s white-noise buffer feeds every sound.
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx.state === 'running' || ctx.state === 'suspended' ? ctx : null
  } catch {
    return null
  }
}

// Browsers block audio until a gesture: unlock on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => {
    ensure()
    for (const e of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(e, unlock, true)
  }
  for (const e of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(e, unlock, true)
}

// Filtered noise burst with an attack/decay envelope.
function noiseHit(t, { dur, vol, type = 'bandpass', f0, f1 = f0, q = 1, attack = 0.002 }) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(f0, t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(master)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

function tone(t, { dur, vol, f0, f1 = f0, type = 'sine' }) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

// One pump of the can in the hand: tin rattle + liquid slosh.
export function playShake() {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  if (t - lastShake < SFX.shakeMinGap) return
  lastShake = t
  const v = SFX.shake
  const r = () => 0.85 + Math.random() * 0.3
  noiseHit(t, { dur: 0.05, vol: 0.5 * v, f0: 3200 * r(), q: 2.5 }) // tin knock
  noiseHit(t + 0.07, { dur: 0.04, vol: 0.35 * v, f0: 2600 * r(), q: 2.5 })
  tone(t, { dur: 0.06, vol: 0.12 * v, f0: 1500 * r(), f1: 1100, type: 'triangle' }) // metallic ring
  noiseHit(t + 0.03, { dur: 0.22, vol: 0.5 * v, type: 'lowpass', f0: 1400, f1: 350, q: 0.7, attack: 0.04 }) // slosh
}

// Carbonation hiss that follows the shake intensity (0..1); call with 0 or stopFizz to end it.
export function setFizz(intensity) {
  if (intensity <= 0) return stopFizz()
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  if (!fizz) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 3500
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(gain).connect(master)
    src.start()
    fizz = { src, gain, filter }
  }
  fizz.gain.gain.setTargetAtTime(SFX.fizz * intensity, t, 0.08)
  fizz.filter.frequency.setTargetAtTime(3500 - 1200 * intensity, t, 0.1)
}

export function stopFizz() {
  if (!fizz) return
  const f = fizz
  fizz = null
  try {
    f.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
    f.src.stop(ctx.currentTime + 0.4)
  } catch {}
}

// The can bursts: sharp pop, deep thump, then a foamy spray that fades.
export function playBurst() {
  stopFizz()
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const v = SFX.burst
  noiseHit(t, { dur: 0.09, vol: 0.9 * v, type: 'highpass', f0: 1800, f1: 900, attack: 0.001 }) // crack
  tone(t, { dur: 0.35, vol: 0.9 * v, f0: 150, f1: 38 }) // thump
  tone(t, { dur: 0.08, vol: 0.25 * v, f0: 900, f1: 300, type: 'triangle' }) // can snap
  noiseHit(t + 0.02, { dur: 1.1, vol: 0.55 * v, type: 'bandpass', f0: 2800, f1: 900, q: 0.6, attack: 0.03 }) // jet whoosh
  noiseHit(t + 0.1, { dur: 1.8, vol: 0.3 * v, type: 'highpass', f0: 4500, f1: 2500, attack: 0.15 }) // foam fizz tail
}

// Hitting the ground: a soft thud, bigger with the impact speed (m/s).
let lastLand = 0
export function playLand(speed) {
  if (speed < 3 || !ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  if (t - lastLand < 0.15) return
  lastLand = t
  const k = Math.min(1, (speed - 3) / 25) // 0 = hop, 1 = big drop
  const v = SFX.land * (0.3 + 0.7 * k)
  tone(t, { dur: 0.22, vol: 0.8 * v, f0: 110 - 30 * k, f1: 40 })
  noiseHit(t, { dur: 0.14 + 0.15 * k, vol: 0.6 * v, type: 'lowpass', f0: 900 + 700 * k, f1: 200, attack: 0.003 })
  if (k > 0.4) noiseHit(t + 0.01, { dur: 0.5, vol: 0.25 * v, type: 'bandpass', f0: 2200, f1: 800, q: 0.5, attack: 0.02 }) // foam splat
}

// Wins gained: bright coin chime, a longer sparkle for bigger rewards.
export function playWins(big = false) {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const v = SFX.wins
  const notes = big ? [988, 1319, 1568, 1976] : [1319, 1976]
  notes.forEach((f, i) => {
    const at = t + i * 0.07
    tone(at, { dur: 0.45, vol: 0.28 * v, f0: f })
    tone(at, { dur: 0.25, vol: 0.1 * v, f0: f * 2.01, type: 'triangle' }) // metallic shimmer
  })
  noiseHit(t, { dur: 0.05, vol: 0.12 * v, type: 'highpass', f0: 6000 }) // coin tick
}

// Wins spent: a cash-register "ka-ching": mechanical key thunk, the drawer sliding open, a bright
// double bell with ringing partials, then a few coins jingling into the tray.
export function playSpend() {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const v = SFX.spend
  // "Ka": key press + drawer thunk.
  tone(t, { dur: 0.08, vol: 0.5 * v, f0: 240, f1: 90 })
  noiseHit(t, { dur: 0.03, vol: 0.45 * v, type: 'lowpass', f0: 2200, f1: 600, attack: 0.001 })
  noiseHit(t, { dur: 0.012, vol: 0.35 * v, type: 'highpass', f0: 4500, attack: 0.0005 })
  noiseHit(t + 0.04, { dur: 0.12, vol: 0.2 * v, type: 'bandpass', f0: 1200, f1: 2800, q: 1.2, attack: 0.04 }) // drawer slide
  // "Ching": two struck bell hits, each with inharmonic partials so it rings like metal.
  for (const [at, f, g] of [[0.11, 2093, 1], [0.2, 2637, 0.9]]) {
    const b = t + at
    for (const [ratio, amp, dur] of [[1, 0.3, 1.1], [2.76, 0.16, 0.55], [5.4, 0.08, 0.3], [8.93, 0.04, 0.15]]) {
      tone(b, { dur: dur * g, vol: amp * v * g, f0: f * ratio })
    }
    noiseHit(b, { dur: 0.012, vol: 0.2 * v, type: 'highpass', f0: 7000, attack: 0.0005 }) // strike
  }
  // Coins landing in the tray.
  for (let i = 0; i < 6; i++) {
    const at = t + 0.3 + i * 0.05 + Math.random() * 0.02
    const f = 2600 + Math.random() * 2200
    const g = 1 - i / 8
    tone(at, { dur: 0.14, vol: 0.1 * v * g, f0: f, f1: f * 0.97, type: 'triangle' })
    noiseHit(at, { dur: 0.012, vol: 0.1 * v * g, type: 'highpass', f0: 6000, attack: 0.0005 })
  }
}

// Button press: a soft rubbery "thock" body, a crisp surface click and a tiny soda "plip" on top.
export function playClick() {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const v = SFX.ui
  const r = 0.94 + Math.random() * 0.12
  tone(t, { dur: 0.09, vol: 0.55 * v, f0: 210 * r, f1: 85 }) // body
  noiseHit(t, { dur: 0.045, vol: 0.5 * v, type: 'lowpass', f0: 1800, f1: 500, attack: 0.001 }) // pad thump
  noiseHit(t, { dur: 0.012, vol: 0.45 * v, type: 'highpass', f0: 4200 * r, attack: 0.0005 }) // click edge
  tone(t + 0.012, { dur: 0.07, vol: 0.14 * v, f0: 520 * r, f1: 1050 * r }) // bubble plip
  noiseHit(t + 0.07, { dur: 0.03, vol: 0.14 * v, f0: 3600, q: 1.2, attack: 0.001 }) // release tick
}

// Hover: a light airy swish with a faint glassy shimmer.
let lastHover = 0
export function playHover() {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  if (t - lastHover < 0.05) return
  lastHover = t
  const v = SFX.ui
  noiseHit(t, { dur: 0.09, vol: 0.2 * v, f0: 2400, f1: 5200, q: 0.9, attack: 0.03 }) // swish up
  tone(t + 0.01, { dur: 0.08, vol: 0.06 * v, f0: 1900, f1: 2300, type: 'triangle' })
}

// Level up: rising bell arpeggio over a whoosh and a soft boom, ending in a sparkle shimmer.
export function playLevelUp() {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const v = SFX.levelUp
  noiseHit(t, { dur: 0.45, vol: 0.35 * v, type: 'bandpass', f0: 500, f1: 5000, q: 0.8, attack: 0.25 }) // riser
  tone(t, { dur: 0.5, vol: 0.5 * v, f0: 120, f1: 55 }) // boom
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // C major up
  notes.forEach((f, i) => {
    const at = t + 0.12 + i * 0.085
    const last = i === notes.length - 1
    const len = last ? 1.4 : 0.5
    tone(at, { dur: len, vol: 0.3 * v, f0: f }) // fundamental
    tone(at, { dur: len * 0.6, vol: 0.12 * v, f0: f * 2.76, type: 'triangle' }) // bell partial
    tone(at, { dur: len * 0.3, vol: 0.06 * v, f0: f * 5.4 }) // shimmer
  })
  const end = t + 0.12 + (notes.length - 1) * 0.085
  tone(end, { dur: 1.4, vol: 0.14 * v, f0: 659.25 }) // chord fill: E + G under the top note
  tone(end, { dur: 1.4, vol: 0.14 * v, f0: 783.99 })
  for (let i = 0; i < 6; i++) noiseHit(end + i * 0.07, { dur: 0.06, vol: 0.1 * v, type: 'highpass', f0: 6500 + Math.random() * 2500, attack: 0.001 }) // sparkles
}

// Every button-like element gets hover + click sounds (HUD, windows, prompts).
const UI = 'button, .pressable, [data-act], [role="button"]'
if (typeof document !== 'undefined') {
  let over = null
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return
    const el = e.target.closest?.(UI)
    if (el && el !== over && !el.disabled) playHover()
    over = el || null
  }, true)
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.(UI)) playClick()
  }, true)
}

// Reward claimed (daily): treasure-chest feel. A latch click and creak-free "open" sweep, a cascade of
// coins pouring down, then a warm rising harp-like glissando and sparkle.
export function playClaim() {
  if (!ensure() || ctx.state !== 'running') return
  const t = ctx.currentTime
  const v = SFX.claim
  noiseHit(t, { dur: 0.015, vol: 0.4 * v, type: 'highpass', f0: 3500, attack: 0.0005 }) // latch
  tone(t, { dur: 0.12, vol: 0.45 * v, f0: 160, f1: 70 }) // lid thump
  noiseHit(t + 0.05, { dur: 0.35, vol: 0.22 * v, type: 'bandpass', f0: 800, f1: 3500, q: 0.9, attack: 0.15 }) // magic swell
  // Coins: quick randomised metallic clinks that thin out.
  for (let i = 0; i < 12; i++) {
    const at = t + 0.12 + i * 0.045 + Math.random() * 0.02
    const f = 2200 + Math.random() * 2400
    const g = 1 - i / 14
    tone(at, { dur: 0.16, vol: 0.12 * v * g, f0: f, f1: f * 0.97, type: 'triangle' })
    tone(at, { dur: 0.1, vol: 0.05 * v * g, f0: f * 1.5 })
    noiseHit(at, { dur: 0.012, vol: 0.12 * v * g, type: 'highpass', f0: 6000, attack: 0.0005 })
  }
  // Harp glissando up a pentatonic scale, last note rings out.
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5, 1568]
  scale.forEach((f, i) => {
    const at = t + 0.25 + i * 0.055
    const last = i === scale.length - 1
    tone(at, { dur: last ? 1.5 : 0.45, vol: 0.2 * v, f0: f })
    tone(at, { dur: last ? 0.8 : 0.2, vol: 0.07 * v, f0: f * 2, type: 'triangle' })
  })
  const end = t + 0.25 + scale.length * 0.055
  for (let i = 0; i < 7; i++) noiseHit(end + i * 0.08, { dur: 0.06, vol: 0.09 * v, type: 'highpass', f0: 7000 + Math.random() * 2000, attack: 0.001 })
}
