// Flight HUD for the Soda Jump launch: "Land to collect: +N Wins" label, the Summit / Record altitude
// bar with a marker at the current altitude, and the layer-name banner (SPACE.layers, e.g. "OUTER SPACE!"). Updated every frame from
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
    <canvas class="fl-lines"></canvas>
    <div class="fl-flash"></div>
    <div class="fl-warp o"><b>20K STUDS!</b><span>Moving to the next world...</span></div>
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
  let shownLayer = 0 // highest layer already announced this flight (the ground layer is never announced)
  let bannerTimer = 0
  const flash = $('.fl-flash')
  const warp = $('.fl-warp')
  let warpShown = false
  const cv = $('.fl-lines')
  const g = cv.getContext('2d')
  const drawLines = (speed) => {
    const w = (cv.width = innerWidth >> 1)
    const h = (cv.height = innerHeight >> 1)
    g.clearRect(0, 0, w, h)
    if (speed < 0.05) return
    const cx = w / 2
    const cy = h * 0.5
    const reach = Math.hypot(cx, cy)
    g.lineCap = 'round'
    const n = Math.round(30 + 90 * speed)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r0 = reach * (0.3 + Math.random() * 0.55)
      const len = reach * (0.12 + 0.4 * speed) * (0.4 + Math.random())
      g.strokeStyle = `rgba(255,255,255,${(0.15 + 0.5 * speed) * Math.random()})`
      g.lineWidth = 1 + Math.random() * 2.5
      g.beginPath()
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len))
      g.stroke()
    }
  }

  return {
    update(launch) {
      const flying = launch.phase === 'rise' || launch.phase === 'fall'
      el.hidden = !flying
      if (!flying) {
        shownLayer = 0
        warpShown = false
        flash.style.opacity = '0'
        warp.classList.remove('show')
        banner.classList.remove('show')
        return
      }
      drawLines(launch.speed * (1 - launch.warp))
      flash.style.opacity = String(Math.min(1, launch.warp * 0.85))
      if (launch.warp > 0.3 && !warpShown) {
        warpShown = true
        warp.classList.add('show')
        setTimeout(() => warp.classList.remove('show'), 3200)
      }
      const alt = Math.round(launch.altitude)
      const rewardText = `+${short(landReward(alt))}`
      if (rewardText !== shownReward) reward.textContent = shownReward = rewardText
      const recordText = `Record: ${short(Math.max(state.record, alt))}`
      if (recordText !== shownRecord) record.textContent = shownRecord = recordText
      const altText = short(alt)
      if (altText !== shownAlt) markerText.textContent = shownAlt = altText
      marker.style.bottom = `${Math.min(100, (alt / SPACE.summit) * 100)}%`
      let layer = 0
      while (layer + 1 < SPACE.layers.length && alt >= SPACE.layers[layer + 1].from) layer++
      if (layer > shownLayer) {
        shownLayer = layer
        banner.textContent = `${SPACE.layers[layer].name}!`
        banner.classList.add('show')
        clearTimeout(bannerTimer)
        bannerTimer = setTimeout(() => banner.classList.remove('show'), 1800)
      }
    },
  }
}
