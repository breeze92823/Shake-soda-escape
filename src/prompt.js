// The "hold E" prompt: a keycap ringed by a fill that completes over the hold, plus a label.
// On phones the whole card is the E button (touch.css restyles it and moves it by the thumb).
import './prompt.css'
import { touchInteract } from './input.js'
import { isTouch } from './device.js'

const RING_R = 16
const RING_C = 2 * Math.PI * RING_R

export function createPrompt() {
  const el = document.createElement('div')
  el.className = 'prompt'
  el.hidden = true
  el.innerHTML = `
    <kbd><svg viewBox="0 0 40 40"><circle class="ring" cx="20" cy="20" r="${RING_R}" /></svg><span>E</span></kbd>
    <b></b>`
  document.body.appendChild(el)
  const kbd = el.querySelector('kbd')
  const ring = el.querySelector('.ring')
  const label = el.querySelector('b')
  ring.style.strokeDasharray = RING_C

  if (isTouch) {
    const end = () => {
      touchInteract.down = false
      el.classList.remove('on')
    }
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId)
      touchInteract.down = true
      el.classList.add('on')
      e.preventDefault()
      e.stopPropagation()
    })
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end)
  }

  let text = null
  let keyed = null
  let shown = 0
  return {
    // hold: show the keycap (this prompt can be confirmed); progress: 0..1 of the hold so far.
    show(msg, hold, progress) {
      if (msg !== text) label.textContent = text = msg
      if (hold !== keyed) {
        kbd.hidden = !hold
        keyed = hold
      }
      if (progress !== shown) {
        ring.style.strokeDashoffset = RING_C * (1 - progress)
        el.classList.toggle('holding', progress > 0)
        shown = progress
      }
      if (el.hidden) el.hidden = false
    },
    hide() {
      if (el.hidden) return
      el.hidden = true
      if (touchInteract.down) touchInteract.down = false
      el.classList.remove('on')
    },
  }
}
