// Rebirth window (Rebirth tile): current vs next rebirth (Soda multiplier and
// required level), level progress, Rebirth (resets the level) and Skip Rebirth
// (Bloxbux, keeps levels; no store yet: toasts). Lives inside the HUD root, in
// the same 1920x991 reference space.
import './rebirth.css'
import { REBIRTH } from './config.js'
import { canRebirth, rebirth, rebirthLevel, rebirthMult, spendWins, state, subscribe } from './state.js'
import { ICONS } from './icons.js'
import { short } from './hud.js'

const cell = (cls, ico, bind) => `<div class="rb-cell ${cls}">${ico}<span class="o" data-rb="${bind}"></span></div>`

function template() {
  const cup = `<i>${ICONS.cup}</i>`
  return `
  <div class="rb-win">
    <div class="rb-body">
      <div class="rb-col rb-l"><b data-rb="nowName"></b></div>
      <div class="rb-col rb-r"><b data-rb="nextName"></b></div>
      ${cell('rb-soda rb-l', cup, 'nowMult')}
      <i class="rb-arrow r1">${ICONS.chevrons}</i>
      ${cell('rb-soda rb-r', cup, 'nextMult')}
      ${cell('rb-lvl rb-l', '', 'nowLvl')}
      <i class="rb-arrow r2">${ICONS.chevrons}</i>
      ${cell('rb-lvl rb-r', '', 'nextLvl')}
      <p class="rb-warn o-thin">Rebirthing resets your level!</p>
      <div class="rb-bar"><div class="fill" data-rb="fill"></div><span class="o-thin" data-rb="progress"></span></div>
      <button class="rb-btn rb-go pressable" data-rb-act="rebirth"><span class="o">Rebirth</span></button>
      <button class="rb-btn rb-skip pressable" data-rb-act="skip">
        <span class="o-thin">Skip Rebirth</span><small class="o-thin">KEEP LEVELS!</small>
        <b class="price"><i>${ICONS.trophy}</i><span class="o-thin">${short(REBIRTH.skipPrice)}</span></b>
      </button>
    </div>
    <div class="rb-head">
      <i class="rb-icon">${ICONS.rebirth}</i>
      <h2 class="o">Rebirth</h2>
      <button class="rb-close pressable" data-rb-act="close" aria-label="Close">${ICONS.close}</button>
    </div>
  </div>`
}

export function createRebirthWindow(hudRoot, say) {
  const root = document.createElement('div')
  root.className = 'anchor a-c rb'
  root.hidden = true
  root.innerHTML = template()
  hudRoot.appendChild(root)

  const bind = {}
  root.querySelectorAll('[data-rb]').forEach((el) => (bind[el.dataset.rb] = el))

  const close = () => {
    root.hidden = true
    document.body.classList.remove('win-open')
  }
  const open = () => {
    window.dispatchEvent(new Event('win-close')) // one window at a time
    document.exitPointerLock?.()
    root.hidden = false
    document.body.classList.add('win-open')
    root.classList.remove('pop')
    void root.offsetWidth // restart the pop-in
    root.classList.add('pop')
  }
  window.addEventListener('win-close', close) // Escape (input.js)

  const ACTIONS = {
    close,
    rebirth: () => {
      if (rebirth()) say(`Rebirth ${state.rebirths}! x${rebirthMult(state.rebirths).toFixed(1)} Soda`)
      else say(`Reach Level ${rebirthLevel(state.rebirths)} to Rebirth!`)
    },
    skip: () => {
      if (!spendWins(REBIRTH.skipPrice)) return say(`Need ${short(REBIRTH.skipPrice)} Wins`)
      rebirth({ keepLevel: true })
      say(`Rebirth ${state.rebirths}! Levels kept - x${rebirthMult(state.rebirths).toFixed(1)} Soda`)
    },
  }
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-rb-act]')
    if (el) ACTIONS[el.dataset.rbAct]()
  })

  subscribe((s) => {
    const n = s.rebirths
    const need = rebirthLevel(n)
    bind.nowName.textContent = `Rebirth ${n}`
    bind.nextName.textContent = `Rebirth ${n + 1}`
    bind.nowMult.textContent = `x${rebirthMult(n).toFixed(1)} Soda`
    bind.nextMult.textContent = `x${rebirthMult(n + 1).toFixed(1)} Soda`
    bind.nowLvl.textContent = `Level ${need}`
    bind.nextLvl.textContent = `Level ${rebirthLevel(n + 1)}`
    bind.progress.textContent = `Level ${Math.min(s.level, need)}/${need}`
    bind.fill.style.width = `${Math.min(100, (s.level / need) * 100)}%`
    root.classList.toggle('ready', canRebirth())
  })

  return { open, close, toggle: () => (root.hidden ? open() : close()) }
}
