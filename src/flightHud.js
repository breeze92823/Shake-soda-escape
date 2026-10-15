// Flight HUD for the Soda Jump launch: "Land to collect: +N Wins" label, the Summit / Record altitude
// bar with a marker at the current altitude, and the "OUTER SPACE!" banner. Updated every frame from
// main.js but only touches the DOM when a value changes.
import './flightHud.css'
import { SPACE } from './config.js'
import { ICONS } from './icons.js'
import { landReward, state } from './state.js'
import { short } from './hud.js'

export function createFlightHud() {
  const el = document.createElement('div')
  el.className = 'fl'
  el.hidden = true
  el.innerHTML = `
    <div class="fl-reward o"><span>Land to collect:</span><b><i>${ICONS.trophy}</i><em></em></b></div>
    <div class="fl-bar">
      <div class="fl-title o-thin">SUMMIT • ${short(SPACE.summit)}</div>
      <div class="fl-record o-thin"></div>
      <div class="fl-track"><div class="fl-fill"></div><div class="fl-marker"><span class="o-thin"></span><u></u></div></div>
    </div>
    <div class="fl-banner o">OUTER SPACE!</div>`
  document.body.appendChild(el)
  const $ = (q) => el.querySelector(q)
  const reward = $('.fl-reward em')
  const record = $('.fl-record')
  const marker = $('.fl-marker')
  const markerText = marker.querySelector('span')
  const banner = $('.fl-banner')
  let shownReward = ''
  let shownRecord = ''
  let shownAlt = ''
  let bannerShown = false

  return {
    update(launch) {
      const flying = launch.phase === 'rise' || launch.phase === 'fall'
      el.hidden = !flying
      if (!flying) {
        bannerShown = false
        banner.classList.remove('show')
        return
      }
      const alt = Math.round(launch.altitude)
      const rewardText = `+${short(landReward(alt))}`
      if (rewardText !== shownReward) reward.textContent = shownReward = rewardText
      const recordText = `Record: ${short(Math.max(state.record, alt))}`
      if (recordText !== shownRecord) record.textContent = shownRecord = recordText
      const altText = short(alt)
      if (altText !== shownAlt) markerText.textContent = shownAlt = altText
      marker.style.bottom = `${Math.min(100, (alt / SPACE.summit) * 100)}%`
      if (!bannerShown && alt >= SPACE.bannerAt) {
        bannerShown = true
        banner.classList.add('show')
        setTimeout(() => banner.classList.remove('show'), 1800)
      }
    },
  }
}
