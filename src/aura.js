// Aura window (Aura tile): scrolling list of AURAS, each bought once with Wins and equipped one at a
// time; the equipped aura multiplies every soda gain (state.js auraMult). Same HUD reference space and
// window frame as the Rebirth window (rebirth.css).
import './aura.css'
import { AURAS } from './config.js'
import { notify, spendWins, state, subscribe } from './state.js'
import { ICONS } from './icons.js'
import { short } from './hud.js'

function template() {
  const rows = AURAS.map(
    (a, i) => `
    <div class="au-row${a.rainbow ? ' rainbow' : ''}" data-au-row="${i}" style="--top:${a.top};--bot:${a.bot};--edge:${a.edge};--hue:${a.hue}deg">
      <b class="au-name o">${a.name}</b>
      <span class="au-boost o-thin"><i>${ICONS.cup}</i>x${a.mult} Soda Boost</span>
      <i class="au-ico">${ICONS.aura}</i>
      <button class="au-btn pressable" data-au-act="pick" data-au-i="${i}">
        <i class="au-trophy">${ICONS.trophy}</i><span class="o" data-au="btn"></span>
      </button>
    </div>`,
  ).join('')
  return `
  <div class="rb-win au-win">
    <div class="rb-body"><div class="au-list">${rows}</div></div>
    <div class="rb-head">
      <i class="rb-icon au-icon">${ICONS.aura}</i>
      <h2 class="o">Auras</h2>
      <button class="rb-close pressable" data-au-act="close" aria-label="Close">${ICONS.close}</button>
    </div>
  </div>`
}

export function createAuraWindow(hudRoot, say) {
  const root = document.createElement('div')
  root.className = 'anchor a-c rb au'
  root.hidden = true
  root.innerHTML = template()
  hudRoot.appendChild(root)

  const rows = [...root.querySelectorAll('[data-au-row]')]
  const list = root.querySelector('.au-list')

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
  window.addEventListener('win-close', close) // Escape (input.js) + other windows

  const pick = (el) => {
    const a = AURAS[el.dataset.auI]
    if (!state.auras.has(a.id)) {
      if (!spendWins(a.price)) return say(`Need ${short(a.price)} Wins`)
      state.auras.add(a.id)
      state.aura = a.id
      say(`${a.name} unlocked! x${a.mult} Soda`)
    } else if (state.aura === a.id) {
      state.aura = null
      say(`${a.name} unequipped`)
    } else {
      state.aura = a.id
      say(`${a.name} equipped! x${a.mult} Soda`)
    }
    notify()
  }
  const ACTIONS = { close, pick }
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-au-act]')
    if (el) ACTIONS[el.dataset.auAct](el)
  })

  subscribe((s) => {
    rows.forEach((row, i) => {
      const a = AURAS[i]
      const owned = s.auras.has(a.id)
      const equipped = s.aura === a.id
      row.classList.toggle('owned', owned)
      row.classList.toggle('equipped', equipped)
      row.classList.toggle('afford', !owned && s.wins >= a.price)
      row.querySelector('[data-au="btn"]').textContent = equipped ? 'Equipped' : owned ? 'Equip' : short(a.price)
    })
  })

  return { open, close, toggle: () => (root.hidden ? open() : close()), list }
}
