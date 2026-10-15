// World manager. The lobby is world 0; the themed worlds (worldScenes.js) are built on first visit and kept
// hidden until entered. Entering a world swaps the scenery, floor, sky / fog / light colours, physics (bounds,
// gravity, ice grip) and the interact zones, and puts the player back at the spawn. Reaching the Summit unlocks
// and warps to the next world; portals (hold E) and the Worlds tile travel between unlocked ones.
import './worlds.css'
import { Group } from 'three'
import { PORTAL, SPACE, SPAWN, SPAWN_FACING, VOID_NPC, WORLDS, worldDef } from './config.js'
import { createGround } from './world.js'
import { buildWorldScene } from './worldScenes.js'
import { addZone } from './interact.js'
import { cancelLaunch } from './launch.js'
import { resetPlayer, setActiveWorld, setBuildWorld } from './player.js'
import { syncYawToPlayer } from './camera.js'
import { landReward, notify, state, subscribe } from './state.js'
import { ICONS } from './icons.js'
import { short } from './hud.js'

const FADE_MS = 450

export function createWorlds({ scene, lobby, ground, space, lights, say, remotes, blackhole }) {
  const entries = new Map([['lobby', { group: lobby.group, tower: lobby.tower, ground, update: lobby.update }]])
  let busy = false

  // Hold-E portal pads in front of the arches (PORTAL = back / to the lobby, VOID_NPC spot = on to the next world).
  function portalZone(from, at, to) {
    setBuildWorld(from)
    const target = worldDef(to)
    addZone({
      key: `portal:${from}>${to}`,
      x: at.x,
      y: 0,
      z: at.z + 2.4,
      prompt: () =>
        state.worlds.has(to)
          ? { text: `Enter ${target.name}  (x${target.winsMult} Wins)`, hold: true }
          : { text: `${target.short} locked - reach the ${short(SPACE.summit)} Summit`, hold: false },
      run: () => {
        travel(to)
        return ''
      },
    })
    setBuildWorld('lobby')
  }
  portalZone('lobby', PORTAL, WORLDS[1].id)

  function build(id) {
    let e = entries.get(id)
    if (e) return e
    const def = worldDef(id)
    const i = WORLDS.indexOf(def)
    setBuildWorld(id)
    const group = new Group()
    const floor = createGround(def.ground.color, def.ground.contrast)
    const built = buildWorldScene(group, def)
    portalZone(id, PORTAL, WORLDS[0].id)
    if (WORLDS[i + 1]) portalZone(id, VOID_NPC, WORLDS[i + 1].id)
    setBuildWorld('lobby')
    group.visible = floor.visible = false
    scene.add(group, floor)
    e = { group, tower: built.tower, ground: floor, update: built.update }
    entries.set(id, e)
    return e
  }

  function enter(id) {
    const def = worldDef(id)
    const next = build(def.id)
    const prev = entries.get(state.world)
    if (prev) prev.group.visible = prev.ground.visible = false
    next.group.visible = next.ground.visible = true
    state.world = def.id
    state.worlds.add(def.id)
    setActiveWorld(def.id, { gravity: def.gravity, grip: def.grip })
    const l = def.light
    lights.hemi.color.set(l.hemiSky)
    lights.hemi.groundColor.set(l.hemiGround)
    lights.sun.color.set(l.sunColor)
    lights.sun.intensity = l.sunIntensity
    space.setWorld(next, def)
    cancelLaunch()
    resetPlayer(SPAWN, SPAWN_FACING)
    syncYawToPlayer()
    remotes?.setVisible(def.id === 'lobby')
    notify()
  }

  // White fade out -> swap -> fade in. Ignored while one is running or for a locked / current world.
  const fade = document.createElement('div')
  fade.className = 'wd-fade'
  document.body.appendChild(fade)
  function travel(id) {
    if (busy || id === state.world) return
    if (!state.worlds.has(id)) return say(`${worldDef(id).short} is locked - reach the Summit!`)
    busy = true
    fade.classList.add('on')
    setTimeout(() => {
      enter(id)
      fade.classList.remove('on')
      say(`${worldDef(id).name}!  x${worldDef(id).winsMult} Wins`)
      setTimeout(() => (busy = false), FADE_MS)
    }, FADE_MS)
  }
  window.addEventListener('world-travel', (e) => travel(e.detail))

  // The 20K Summit was hit: pay the full launch, unlock the next world (the last one loops back to the lobby) and go.
  // The player is sucked into a black hole (blackhole.js), the next world loads under the flash and a
  // "WORLD UNLOCKED" banner names it.
  function summit() {
    if (busy) return
    busy = true
    const reward = landReward(SPACE.summit)
    state.wins += reward
    state.record = Math.max(state.record, SPACE.summit)
    const next = WORLDS[WORLDS.findIndex((w) => w.id === state.world) + 1]
    const dest = next ?? WORLDS[0]
    const fresh = !!next && !state.worlds.has(next.id)
    if (next) state.worlds.add(next.id)
    notify()
    blackhole.play(() => {
      enter(dest.id)
      busy = false
      blackhole.banner(next ? (fresh ? 'WORLD UNLOCKED' : 'WELCOME TO') : 'ALL WORLDS CONQUERED', dest.name, dest.card)
      say(`+${short(reward)} Wins`)
    })
  }

  return {
    enter,
    travel,
    summit,
    update(t, dt) {
      entries.get(state.world)?.update(t, dt)
    },
  }
}

// --- Worlds window (Worlds tile) -----------------------------------------------------------------------
export function createWorldsWindow(hudRoot, say) {
  const root = document.createElement('div')
  root.className = 'anchor a-c rb wd'
  root.hidden = true
  root.innerHTML = `
  <div class="rb-win wd-win">
    <div class="rb-body"><div class="wd-list">${WORLDS.map(
      (w, i) => `
      <div class="wd-row" data-wd-row="${i}" style="--top:${w.card.top};--bot:${w.card.bot};--edge:${w.card.edge}">
        <b class="wd-name o">${w.name}</b>
        <span class="wd-tag o-thin">${w.tag}</span>
        <span class="wd-mult o-thin">x${w.winsMult} Wins • x${w.sodaMult} Soda</span>
        <button class="wd-btn pressable" data-wd-act="go" data-wd-i="${i}"><span class="o" data-wd="btn"></span></button>
      </div>`,
    ).join('')}</div></div>
    <div class="rb-head wd-head">
      <i class="rb-icon wd-icon">${ICONS.globe}</i>
      <h2 class="o">Worlds</h2>
      <button class="rb-close pressable" data-wd-act="close" aria-label="Close">${ICONS.close}</button>
    </div>
  </div>`
  hudRoot.appendChild(root)
  const rows = [...root.querySelectorAll('[data-wd-row]')]

  const close = () => {
    root.hidden = true
    document.body.classList.remove('win-open')
  }
  const open = () => {
    window.dispatchEvent(new Event('win-close'))
    document.exitPointerLock?.()
    root.hidden = false
    document.body.classList.add('win-open')
    root.classList.remove('pop')
    void root.offsetWidth
    root.classList.add('pop')
  }
  window.addEventListener('win-close', close)

  const ACTIONS = {
    close,
    go: (el) => {
      const w = WORLDS[el.dataset.wdI]
      if (!state.worlds.has(w.id)) return say(`Reach the ${short(SPACE.summit)} Summit in the world before to unlock ${w.short}!`)
      if (w.id === state.world) return say(`You are already in ${w.short}`)
      close()
      window.dispatchEvent(new CustomEvent('world-travel', { detail: w.id }))
    },
  }
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-wd-act]')
    if (el) ACTIONS[el.dataset.wdAct](el)
  })

  subscribe((s) => {
    rows.forEach((row, i) => {
      const w = WORLDS[i]
      const open = s.worlds.has(w.id)
      row.classList.toggle('locked', !open)
      row.classList.toggle('here', s.world === w.id)
      row.querySelector('[data-wd="btn"]').textContent = s.world === w.id ? 'Here' : open ? 'Travel' : 'Locked'
    })
  })

  return { open, close, toggle: () => (root.hidden ? open() : close()) }
}
