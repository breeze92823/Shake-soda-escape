// Daily Rewards window (Daily tile): 7 day tiles (claimed / today / upcoming), a Claim button and the
// countdown to the next reward. Progress (`day` = next day to claim, `nextAt` = when it unlocks) is kept in
// localStorage. Same HUD reference space and window frame as the Rebirth window (rebirth.css).
import './daily.css'
import { DAILY } from './config.js'
import { notify, now, state, subscribe } from './state.js'
import { ICONS } from './icons.js'
import { short } from './hud.js'

// Progress lives in `state` (dailyDay = next day to claim, dailyClaimedAt = last claim) and is saved with the account
// by net.js. Times use the server clock (state.now) once it is known.
const nextAt = () => (state.dailyClaimedAt ? state.dailyClaimedAt + DAILY.cooldownMs : 0)

// Missing more than one extra day after the reward unlocked restarts the streak.
function checkStreak() {
  if (state.dailyDay > 0 && now() > nextAt() + DAILY.cooldownMs) Object.assign(state, { dailyDay: 0, dailyClaimedAt: 0 })
}
export const dailyReady = () => {
  checkStreak()
  return now() >= nextAt()
}

function reward(r) {
  if (r.kind === 'soda') return { ico: ICONS.cup, text: `+${short(r.amount)} Soda` }
  if (r.kind === 'wins') return { ico: ICONS.trophy, text: `+${short(r.amount)} Wins` }
  return { ico: ICONS.cup, text: `x2 Soda ${r.minutes}m` }
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const p = (n) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

function template() {
  const tiles = DAILY.rewards
    .map((r, i) => {
      const { ico, text } = reward(r)
      return `
      <div class="dl-tile d${i + 1}${r.big ? ' big' : ''}" data-dl-day="${i}">
        <span class="dl-day o-thin">Day ${i + 1}</span>
        <i class="dl-ico">${ico}</i>
        <b class="dl-claimed o-thin">CLAIMED</b>
        <span class="dl-amt o-thin">${text}</span>
      </div>`
    })
    .join('')
  return `
  <div class="rb-win dl-win">
    <div class="rb-body">
      ${tiles}
      <button class="dl-claim pressable" data-dl-act="claim"><span class="o" data-dl="btn"></span></button>
      <p class="dl-next o-thin" data-dl="next"></p>
    </div>
    <div class="rb-head">
      <i class="rb-icon dl-icon">${ICONS.calendar}</i>
      <h2 class="o">Daily Rewards</h2>
      <button class="rb-close pressable" data-dl-act="close" aria-label="Close">${ICONS.close}</button>
    </div>
  </div>`
}

export function createDailyWindow(hudRoot, say) {
  const root = document.createElement('div')
  root.className = 'anchor a-c rb dl'
  root.hidden = true
  root.innerHTML = template()
  hudRoot.appendChild(root)

  const bind = {}
  root.querySelectorAll('[data-dl]').forEach((el) => (bind[el.dataset.dl] = el))
  const tiles = [...root.querySelectorAll('[data-dl-day]')]

  let timer = 0
  const render = () => {
    const ready = dailyReady()
    tiles.forEach((el, i) => {
      el.classList.toggle('claimed', i < state.dailyDay)
      el.classList.toggle('today', ready && i === state.dailyDay)
    })
    root.classList.toggle('ready', ready)
    bind.btn.textContent = ready ? 'Claim!' : 'Claimed!'
    bind.next.textContent = ready ? 'Reward ready!' : `Next reward in ${clock(nextAt() - now())}`
  }
  const close = () => {
    root.hidden = true
    clearInterval(timer)
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
    render()
    clearInterval(timer)
    timer = setInterval(render, 1000)
  }
  window.addEventListener('win-close', close) // Escape (input.js) + other windows

  const claim = () => {
    if (!dailyReady()) return say(`Come back in ${clock(nextAt() - now())}`)
    const r = DAILY.rewards[state.dailyDay]
    if (r.kind === 'soda') state.soda += r.amount
    else if (r.kind === 'wins') state.wins += r.amount
    else state.sodaBoostUntil = Math.max(now(), state.sodaBoostUntil) + r.minutes * 60000
    state.dailyDay = (state.dailyDay + 1) % DAILY.rewards.length
    state.dailyClaimedAt = now()
    notify()
    render()
    say(`Daily reward: ${reward(r).text}!`)
  }
  const ACTIONS = { close, claim }
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-dl-act]')
    if (el) ACTIONS[el.dataset.dlAct]()
  })

  subscribe(() => !root.hidden && render())

  return { open, close, toggle: () => (root.hidden ? open() : close()) }
}
