// The on-screen HUD: system buttons, wins counter, menu tiles (Rebirth / Daily /
// Aura / Worlds), x2 boost passes, soda total + level bar and the soda packs.
// Plain DOM over the canvas, values from state.js. Rebirth opens its window
// (rebirth.js); no store or other menus yet: the rest show a toast.
import './hud.css'
import { AURAS, BOOST_PASSES, SHOP, SODA_PACKS } from './config.js'
import { notify, onSodaGain, rebirthLevel, rebirthMult, spendWins, state, subscribe, treadmillAt } from './state.js'
import { playerScreen } from './screenPos.js'
import { createRebirthWindow } from './rebirth.js'
import { createDailyWindow } from './daily.js'
import { createAuraWindow } from './aura.js'
import { ICONS } from './icons.js'
import { isCompact } from './device.js'

const REF_W = 1920
const REF_H = 991

// 6460000000 -> 6.46B, 19380000000 -> 19.3B (three significant digits, truncated like the reference).
export function short(n) {
  const units = ['', 'K', 'M', 'B', 'T', 'Qd', 'Qn']
  let i = 0
  while (Math.abs(n) >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  if (!i) return String(Math.floor(n))
  const digits = Math.abs(n) < 10 ? 2 : Math.abs(n) < 100 ? 1 : 0
  const f = 10 ** digits
  return `${Math.floor(n * f + 1e-6) / f}${units[i]}`
}

const icon = (name) => `<i>${ICONS[name]}</i>`
const BOOST_ICON = { soda: 'cup', wins: 'trophy' }
const TILES = [
  ['rebirth', 'Rebirth', 'rebirth'],
  ['daily', 'Daily', 'calendar'],
  ['aura', 'Aura', 'aura'],
  ['worlds', 'Worlds', 'globe'],
]

function template() {
  return `
  <div class="anchor a-l">
    <div class="wins">
      <i class="trophy">${ICONS.trophy}</i>
      <span class="val o" data-bind="wins"></span>
    </div>
    ${TILES.map(
      ([id, label, ico]) => `
      <button class="tile t-${id} pressable" data-act="${id}">
        ${icon(ico)}<span class="o">${label}</span>
        ${id === 'rebirth' ? '<b class="pct o-thin" data-bind="rebirthPct"></b>' : ''}
      </button>`,
    ).join('')}
  </div>

  <div class="anchor a-r">
    ${BOOST_PASSES.map(
      (b) => `
      <div class="boost b-${b.id}">
        <button class="boost-btn pressable" data-act="boost" data-id="${b.id}">${icon(BOOST_ICON[b.id])}<span class="o">${b.label}</span></button>
        <div class="only o-thin">ONLY <i>${ICONS.trophy}</i>${short(b.price)}</div>
      </div>`,
    ).join('')}
  </div>

  <div class="anchor a-bc">
    <div class="soda-total o" data-bind="soda"></div>
    <div class="rebirth-mult o-thin" data-bind="rebirthMult"></div>
    <div class="aura-mult o-thin" data-bind="auraMult" hidden></div>
    <div class="belt-mult o-thin" data-bind="belt" hidden></div>
    <div class="level">
      <div class="fill" data-bind="fill"></div>
      <span class="lv o" data-bind="level"></span>
      <span class="xp o" data-bind="xp"></span>
    </div>
    ${SODA_PACKS.map(
      (p, i) => `
      <button class="pack p-${p.color} pressable" data-act="pack" data-i="${i}" style="left:${-445 + i * 223}px">
        ${icon('cup')}<span class="o" data-bind="pack${i}"></span>
        <b class="price"><i>${ICONS.trophy}</i><span class="o-thin">${short(p.price)}</span></b>
      </button>`,
    ).join('')}
  </div>

  <div class="pops"></div>
  <div class="toast o"></div>`
}

export function createHud({ showMenu }) {
  const root = document.createElement('div')
  root.id = 'hud'
  root.innerHTML = template()
  document.body.appendChild(root)

  const bind = {}
  root.querySelectorAll('[data-bind]').forEach((el) => (bind[el.dataset.bind] = el))

  // Desktop lays the HUD out in 1920x991. Phones / small windows use a smaller
  // reference space so text stays legible (side groups re-pinned in hud.css).
  const fit = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const mob = isCompact()
    root.classList.toggle('mob', mob)
    root.style.setProperty('--s', mob ? Math.min(w / 1250, h / 620) : Math.min(w / REF_W, h / REF_H))
  }
  window.addEventListener('resize', fit)
  fit()

  const toast = root.querySelector('.toast')
  let toastTimer = 0
  const say = (text) => {
    toast.textContent = text
    toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600)
  }

  const rebirthWin = createRebirthWindow(root, say)
  const dailyWin = createDailyWindow(root, say)
  const auraWin = createAuraWindow(root, say)

  const ACTIONS = {
    menu: () => showMenu(),
    logo: () => showMenu(),
    chat: () => say('Chat coming soon!'),
    updates: () => say('Update log coming soon!'),
    emotes: () => say('Emotes coming soon!'),
    rebirth: () => rebirthWin.toggle(),
    daily: () => dailyWin.toggle(),
    aura: () => auraWin.toggle(),
    worlds: () => say('Reach 20K studs to unlock World 2!'),
    boost: (el) => {
      const b = BOOST_PASSES.find((p) => p.id === el.dataset.id)
      if (state.passes.has(b.id)) return say(`${b.label} already owned!`)
      if (!spendWins(b.price)) return say(`Need ${short(b.price)} Wins`)
      state.passes.add(b.id)
      notify()
      say(`${b.label} unlocked!`)
    },
    pack: (el) => {
      const p = SODA_PACKS[el.dataset.i]
      if (!spendWins(p.price)) return say(`Need ${short(p.price)} Wins`)
      const n = state.soda * p.mult
      state.soda += n
      notify()
      say(`+${short(n)} Soda!`)
    },
  }
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]')
    if (el) ACTIONS[el.dataset.act]?.(el)
  })

  let wasMaxed = false
  subscribe((s) => {
    bind.wins.textContent = short(s.wins)
    bind.rebirthPct.textContent = `${Math.min(100, Math.floor((s.level / rebirthLevel(s.rebirths)) * 100))}%`
    bind.soda.textContent = `${short(s.soda)} Soda`
    bind.rebirthMult.textContent = `x${rebirthMult(s.rebirths).toFixed(1)} Rebirth`
    const am = AURAS.find((a) => a.id === s.aura)
    bind.auraMult.hidden = !am
    if (am) bind.auraMult.textContent = `x${am.mult} ${am.name}`
    const maxed = s.level >= rebirthLevel(s.rebirths)
    bind.level.textContent = maxed ? `Level ${s.level} MAX` : `Level ${s.level}`
    bind.xp.textContent = maxed ? 'Rebirth to level up!' : `${short(s.xp)}/${short(s.xpNext)}`
    if (maxed && !wasMaxed) say(`Level ${s.level} reached - Rebirth to keep levelling!`)
    wasMaxed = maxed
    bind.fill.style.width = `${Math.min(100, (s.xp / s.xpNext) * 100)}%`
    SODA_PACKS.forEach((p, i) => (bind[`pack${i}`].textContent = `+${short(s.soda * p.mult)}`))
  })

  // "+N" cup pop floats up from the player's chest on every gain (scattered so rapid gains don't stack).
  const pops = root.querySelector('.pops')
  const gainSfx = new Audio(`${import.meta.env.BASE_URL}audio/soda_gain.mp3`)
  gainSfx.preload = 'auto'
  onSodaGain((n) => {
    try {
      gainSfx.volume = 0.3
      gainSfx.currentTime = 0
      gainSfx.play()?.catch(() => {})
    } catch {}
    const el = document.createElement('div')
    el.className = 'gain-pop'
    el.style.left = `${playerScreen.x * 100 + (Math.random() - 0.5) * 16}%`
    el.style.top = `${playerScreen.y * 100 - 4 + (Math.random() - 0.5) * 16}%`
    el.innerHTML = `<span class="gain-pop-row"><i class="gain-pop-ico">${ICONS.cup}</i><span class="o">+${short(n)}</span></span>`
    pops.appendChild(el)
    if (pops.childElementCount > 12) pops.firstChild.remove()
    el.addEventListener('animationend', () => el.remove())
    setTimeout(() => el.remove(), 1200)
  })
  // Per frame: show the belt multiplier while standing on an unlocked treadmill; toast once on a locked one.
  let lastBelt = -1
  const update = () => {
    const i = treadmillAt()
    const unlocked = i >= 0 && state.rebirths >= SHOP.rebirths[i]
    bind.belt.hidden = !(unlocked && SHOP.mults[i] > 1)
    if (!bind.belt.hidden) bind.belt.textContent = `x${SHOP.mults[i]} Treadmill`
    if (i !== lastBelt) {
      if (i >= 0 && !unlocked) say(`Treadmill locked - need Rebirth ${SHOP.rebirths[i]}`)
      lastBelt = i
    }
  }
  return { say, update }
}
