// WASD/arrows move (camera-relative, consumed by player.js), right-drag look +
// wheel zoom (consumed by camera.js), edge-triggered jump (cleared by player.js).
export const inputState = {
  move: { x: 0, z: 0 }, // x = strafe (+ right), z = forward (+ forward)
  look: { dx: 0, dy: 0 }, // raw pixels since the camera last read them
  zoom: 0, // wheel notches since the camera last read them (+ = away)
  jump: false,
}

// One wheel notch per WheelEvent.deltaMode (pixels, lines, pages), so a trackpad
// and a mouse zoom at the same rate.
const NOTCH_PER_DELTA = [1 / 100, 1 / 3, 1]

// E (or the touch prompt) physically held right now; interact.js times the hold.
export const touchInteract = { down: false }
// Left button / finger held on the world: main.js gains soda while true.
export const pointerHeld = { down: false }

// Touch "click": a stationary finger on the world (tap, or hold after HOLD_MS). Moving past TAP_SLOP cancels it.
const TAP_SLOP = 8
const HOLD_MS = 450
const taps = new Map() // pointerId -> { x, y, holding, timer }
function tapStart(e) {
  const t = { x: e.clientX, y: e.clientY, at: performance.now(), holding: false, timer: 0 }
  t.timer = setTimeout(() => {
    t.holding = true
    pointerHeld.down = true
  }, HOLD_MS)
  taps.set(e.pointerId, t)
}
function tapDrop(id) {
  const t = taps.get(id)
  if (!t) return
  clearTimeout(t.timer)
  taps.delete(id)
  if (t.holding && !taps.size) pointerHeld.down = false
}
export const isInteractDown = () => held.has('KeyE') || touchInteract.down

const held = new Set()
let orbiting = false // right-drag fallback where pointer lock is refused
let canvas = null
let lockEverGranted = false
let armed = false

const locked = () => !!canvas && document.pointerLockElement === canvas
// Pointer lock can reject (sandboxed frame, post-Escape cooldown); that is not a fault.
function requestLock() {
  if (!canvas || locked()) return
  const r = canvas.requestPointerLock?.()
  if (r instanceof Promise) r.catch(() => {})
}

function recomputeMove() {
  let x = 0
  let z = 0
  if (held.has('KeyW') || held.has('ArrowUp')) z += 1
  if (held.has('KeyS') || held.has('ArrowDown')) z -= 1
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1
  inputState.move.x = x
  inputState.move.z = z
}

export function install(showMenu, canvasEl) {
  canvas = canvasEl
  document.addEventListener('pointerlockchange', () => {
    if (locked()) {
      lockEverGranted = true
      orbiting = false
    } else {
    }
  })
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'Escape') {
      if (document.body.classList.contains('win-open')) window.dispatchEvent(new Event('win-close')) // close the open window first
      else showMenu()
    }
    else if (!armed) {
      armed = true // the first keypress is a user gesture: take the mouse without a click
      requestLock()
    }
    held.add(e.code)
    if (e.code === 'Space') inputState.jump = true
    recomputeMove()
  })
  window.addEventListener('keyup', (e) => {
    held.delete(e.code)
    recomputeMove()
  })
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      // touch.js owns touch (stick, look, buttons). A finger only counts as a click when it stays put:
      // dragging to move or look must not earn soda.
      if (e.target.tagName === 'CANVAS' && !document.body.classList.contains('win-open')) tapStart(e)
      return
    }
    if (e.target.tagName === 'CANVAS' && e.button === 0 && !document.body.classList.contains('win-open')) pointerHeld.down = true
    const onWorld = e.target.tagName === 'CANVAS'
    if (e.button === 2 && !lockEverGranted) orbiting = true
    if (e.button === 0 && onWorld && !document.body.classList.contains('win-open')) {
      // A click on the world takes the cursor (resuming play after Escape).
      armed = true
      requestLock()
    }
  })
  window.addEventListener('pointermove', (e) => {
    const t = taps.get(e.pointerId)
    if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) tapDrop(e.pointerId)
  })
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') {
      const t = taps.get(e.pointerId)
      if (t && !t.holding && performance.now() - t.at < 300) {
        // Quick tap: one click's worth of soda.
        pointerHeld.down = true
        setTimeout(() => !taps.size && (pointerHeld.down = false), 90)
      }
      tapDrop(e.pointerId)
      return
    }
    if (e.button === 0) pointerHeld.down = false
    if (e.button === 2) orbiting = false
  })
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return
    if (!orbiting && !locked()) return
    inputState.look.dx += e.movementX || 0
    inputState.look.dy += e.movementY || 0
  })
  // Only the game world zooms: a wheel aimed at a HUD panel must not also move the camera.
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target.tagName !== 'CANVAS') return
      e.preventDefault()
      if (document.body.classList.contains('win-open')) return // a window is open: no camera zoom
      inputState.zoom += e.deltaY * (NOTCH_PER_DELTA[e.deltaMode] ?? NOTCH_PER_DELTA[0])
    },
    { passive: false },
  )
  window.addEventListener('pointercancel', (e) => (e.pointerType === 'touch' ? tapDrop(e.pointerId) : (pointerHeld.down = false)))
  window.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('blur', () => {
    held.clear()
    touchInteract.down = false
    pointerHeld.down = false
    orbiting = false
    inputState.jump = false
    recomputeMove()
  })
}
