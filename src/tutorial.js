// New-player tutorial: a banner at the top, plus a 3D guide (trail of arrowheads + bobbing beacon)
// toward where to go. Click for soda -> run on the x1 treadmill -> Soda Jump for Wins -> buy Orange Pop.
// The step lives in state.tutorialStep, which net.js saves with the account; the server reports a saved
// account that predates the tutorial as finished, so only new accounts ever see it (state.tutorialReady
// gates it until that answer is in). The step machine itself is tutorialLogic.js.
import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import './tutorial.css'
import { DISABLE_TUTORIAL, DISPLAY, LAUNCH_PAD, SHOP, SODA_ITEMS, TUTORIAL } from './config.js'
import { player, floorAt } from './player.js'
import { notify, state } from './state.js'
import { nextStep } from './tutorialLogic.js'
import { isTouch } from './device.js'
import { short } from './hud.js'

const ITEM_INDEX = SODA_ITEMS.front.findIndex((i) => i.kind === TUTORIAL.soda)
const ITEM = SODA_ITEMS.front[ITEM_INDEX]

const TARGETS = {
  1: { x: SHOP.gateX, z: SHOP.gateZ[0], top: SHOP.top }, // the x1 treadmill
  2: { x: LAUNCH_PAD.x, z: LAUNCH_PAD.z, top: 0 },
  3: { x: DISPLAY.front.itemX, z: DISPLAY.front.z[ITEM_INDEX], top: DISPLAY.front.top },
}

const SPACING = 1.1 // m between trail arrows
const SPEED = 1.8 // m/s the trail crawls toward the target
const MAX_ARROWS = 140
const HIDE_WITHIN = 2.5 // m from the target where the trail disappears
const BEACON_HEIGHT = 4.5 // m above the ground the big arrow floats

export function createTutorial(scene) {
  // --- Banner ----------------------------------------------------------------
  const banner = document.createElement('div')
  banner.className = 'tut-anchor'
  banner.innerHTML = '<div class="tutorial" hidden><div class="tut-tag o-thin">TUTORIAL</div><div class="tut-text o"></div><div class="tut-sub o-thin"></div><button class="tut-skip o-thin" type="button">SKIP</button></div>'
  document.getElementById('hud')?.appendChild(banner)
  const box = banner.firstChild
  const tag = box.querySelector('.tut-tag')
  const text = box.querySelector('.tut-text')
  const sub = box.querySelector('.tut-sub')
  const skip = box.querySelector('.tut-skip')
  skip.addEventListener('click', () => {
    state.tutorialStep = TUTORIAL.steps // finished: saved by net.js, never shown again
    notify()
  })
  let shownKey = ''
  function paintBanner(key, t, s, complete = false) {
    if (key === shownKey) return
    const fresh = key.split('|')[0] !== shownKey.split('|')[0]
    shownKey = key
    box.hidden = !t
    box.classList.toggle('complete', complete)
    tag.textContent = complete ? 'DONE' : 'TUTORIAL'
    text.textContent = t ?? ''
    sub.textContent = s ?? ''
    sub.hidden = !s
    skip.hidden = complete
    if (fresh) {
      box.style.animation = 'none'
      void box.offsetWidth // restart the pop-in
      box.style.animation = ''
    }
  }

  // --- 3D guide --------------------------------------------------------------
  const shape = new Shape()
  shape.moveTo(0, 0.42)
  shape.lineTo(0.34, -0.2)
  shape.lineTo(0, -0.05)
  shape.lineTo(-0.34, -0.2)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  geometry.center()
  // Drawn over everything so walls and platforms never hide the way.
  const trailMat = new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5, depthTest: false, transparent: true })
  const beaconMat = new MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a1f', emissiveIntensity: 0.6, roughness: 0.4, fog: false, depthTest: false, transparent: true })
  const guide = new Group()
  const trail = new InstancedMesh(geometry, trailMat, MAX_ARROWS)
  trail.frustumCulled = false
  trail.renderOrder = 20
  const beacon = new Mesh(geometry, beaconMat)
  beacon.scale.setScalar(3.2)
  beacon.frustumCulled = false
  beacon.renderOrder = 21
  beacon.visible = false
  guide.add(trail, beacon)
  scene.add(guide)
  const dummy = new Object3D()

  function drawGuide(step, t) {
    trail.count = 0
    beacon.visible = false
    const to = TARGETS[step]
    if (!to) return
    const dx = to.x - player.position.x
    const dz = to.z - player.position.z
    const dist = Math.hypot(dx, dz)
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    const heading = Math.atan2(ux, uz)
    const phase = (t * SPEED) % SPACING
    let n = 0
    if (dist > HIDE_WITHIN) {
      for (let d = 1.4 + phase; d < dist - 0.6 && n < MAX_ARROWS; d += SPACING) {
        const x = player.position.x + ux * d
        const z = player.position.z + uz * d
        dummy.position.set(x, floorAt(x, z) + 0.3, z)
        dummy.rotation.set(Math.PI / 2 - 0.35, heading, 0, 'YXZ') // lie flat, tip toward the target
        dummy.updateMatrix()
        trail.setMatrixAt(n++, dummy.matrix)
      }
    }
    trail.count = n
    trail.instanceMatrix.needsUpdate = true
    beacon.visible = true
    beacon.position.set(to.x, to.top + BEACON_HEIGHT + Math.sin(t * 4) * 0.35, to.z)
    beacon.rotation.set(0, t * 2, Math.PI, 'YXZ') // point down, spin about the vertical
  }

  // --- Per frame -------------------------------------------------------------
  let prev = state.tutorialStep
  let completeUntil = 0
  function update(t) {
    if (DISABLE_TUTORIAL || !state.tutorialReady) return
    const step = state.tutorialStep
    if (prev < TUTORIAL.steps && step >= TUTORIAL.steps) completeUntil = performance.now() + TUTORIAL.completeMs
    prev = step

    if (step >= TUTORIAL.steps) {
      drawGuide(-1, t)
      if (performance.now() < completeUntil) paintBanner('done', 'Tutorial Complete!', 'Keep shaking, jumping and collecting sodas!', true)
      else paintBanner('', null)
      return
    }
    if (state.world !== 'lobby') {
      drawGuide(-1, t)
      return paintBanner('', null)
    }

    const next = nextStep(step, {
      soda: state.soda,
      clickGoal: TUTORIAL.clickSoda,
      trainGoal: TUTORIAL.trainSoda,
      wins: state.wins,
      price: ITEM.price,
      owned: state.owned.has(TUTORIAL.soda),
      done: TUTORIAL.steps,
    })
    if (next !== step) {
      state.tutorialStep = next
      notify() // saved by net.js
      return
    }

    drawGuide(step, t)

    const [title, hint] = [
      [`${isTouch ? 'Tap and hold' : 'Click or hold'} to shake some soda (${Math.floor(Math.min(state.soda, TUTORIAL.clickSoda))}/${TUTORIAL.clickSoda})`, 'Every shake gives you Soda'],
      [`Run on the x1 treadmill (${Math.floor(Math.min(state.soda, TUTORIAL.trainSoda))}/${TUTORIAL.trainSoda} Soda)`, 'Follow the arrow - it shakes soda for you while you stand on it'],
      ['Jump to earn Wins!', `Step on the Soda Jump pad (need ${short(ITEM.price)} Wins)`],
      [`Buy ${ITEM.name}!`, `Stand on its pad and ${isTouch ? 'tap and hold the prompt' : 'hold E'} (${short(ITEM.price)} Wins)`],
    ][step]
    paintBanner(`${step}|${title}|${hint}`, title, hint)
  }

  return { update }
}
