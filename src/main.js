import { Clock, Group, Vector3, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, PHYSICS, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, pointerHeld, install as installInput } from './input.js'
import { player, resetPlayer, rotateTowards, step as stepPlayer } from './player.js'
import { syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky, createSkyDecor } from './world.js'
import { createLobby } from './lobby.js'
import { initLaunch, launch, onLaunchLand, updateLaunch } from './launch.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { createAuraFx } from './avatar/auraFx.js'
import { createLoading, markLoaded } from './loading.js'
import { createLoginButton } from './login.js'
import { createTouchControls } from './touch.js'
import { createHud } from './hud.js'
import { initInteract, step as stepInteract } from './interact.js'
import { isTouch } from './device.js'
import { gainSoda, landReward, notify, onSodaGain, runningBelt, state } from './state.js'
import { initNet, sendPose, syncAvatar } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createFlightHud } from './flightHud.js'
import { createSpace } from './space.js'
import { short } from './hud.js'
import { playerScreen } from './screenPos.js'

// --- Bloxity + player state -----------------------------------------------
createLoading()
createLoginButton()
bloxity.init()
resetPlayer(SPAWN, SPAWN_FACING)
syncYawToPlayer()

// --- Renderer / scene -------------------------------------------------------
const GRAPHICS_PRESETS = {
  Low: { shadows: false, antialias: false, dpr: 1 },
  Medium: { shadows: true, antialias: false, dpr: 1.5 },
  High: { shadows: true, antialias: true, dpr: 2 },
  Ultra: { shadows: true, antialias: true, dpr: 2 },
}
const basePreset = GRAPHICS_PRESETS[bloxity.settings.graphics_quality] ?? GRAPHICS_PRESETS.High
// Phones: no MSAA and a capped pixel ratio keep a steady frame rate.
const preset = isTouch ? { ...basePreset, antialias: false, dpr: Math.min(basePreset.dpr, 1.5) } : basePreset

const renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(bloxity.showMenu, renderer.domElement)

const scene = new Scene()
scene.fog = createFog()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
camera.position.set(0, 12, 24)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

const lobby = createLobby()
const sky = createSky()
const decor = createSkyDecor()
const ground = createGround()
scene.add(sky, decor, ground, lobby.group)
const lights = createLights()
const space = createSpace({ sky, decor, ground, lobby: lobby.group, tower: lobby.tower, fog: scene.fog, hemi: lights.hemi })
const flightHud = createFlightHud()
scene.add(lights.hemi, lights.sun, lights.sun.target)
initLaunch(scene)
createTouchControls({ showMenu: bloxity.showMenu })
const hud = createHud({ showMenu: bloxity.showMenu })
initInteract({ say: hud.say })
const remotes = createRemotePlayers(scene)
initNet() // saves/loads progress and joins the shared room (no-op without a server)
// Landing pays Wins for the peak altitude and updates the Record.
onLaunchLand((peak) => {
  const reward = landReward(peak)
  state.wins += reward
  if (peak > state.record) state.record = peak
  notify()
  hud.say(`+${short(reward)} Wins`)
})

// --- Player avatar ----------------------------------------------------------
// Always the game's own character (player.glb, or the procedural fallback). A
// signed-in player's equipped Bloxity cosmetics are attached to it and the
// customizer's body proportions applied; it rebuilds on customizer edits and
// sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
const auraFx = createAuraFx(playerGroup)

let avatar = null
let animator = null
let generation = 0

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.getProportions())
    setAvatar(group)
  } finally {
    if (mine === generation) markLoaded('avatar')
  }
}

onSodaGain(() => animator?.shake())

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
// The SDK event can precede the skin URL / proportions being current, so resend shortly after too.
let resyncTimer = 0
function syncAvatarSoon() {
  syncAvatar()
  clearTimeout(resyncTimer)
  resyncTimer = setTimeout(syncAvatar, 1000)
}
bloxity.onAvatarChanged(() => {
  loadAvatar()
  syncAvatarSoon()
})
bloxity.onProportionsChanged(() => {
  applyProportions(avatar, bloxity.getProportions())
  syncAvatarSoon()
})
bloxity.onSetting((key, value) => {
  if (key === 'graphics_quality') renderer.shadowMap.enabled = (GRAPHICS_PRESETS[value] ?? GRAPHICS_PRESETS.High).shadows
})

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
const chest = new Vector3()

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  updateLaunch(dt, camera, renderer.domElement.height)
  stepPlayer(dt)
  stepInteract()
  hud.update()
  lobby.update(clock.elapsedTime, dt)
  auraFx.update(clock.elapsedTime, dt)

  // On an unlocked belt: soda gains automatically (as a click would, 1s cooldown) and the player runs
  // in place facing the console, unless they are steering.
  const onBelt = !player.locked && player.grounded && runningBelt() >= 0
  if (onBelt) {
    gainSoda()
    if (!inputState.move.x && !inputState.move.z) player.facing = rotateTowards(player.facing, -Math.PI / 2, PHYSICS.turnSpeed * dt)
  }

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing // player.js turns the heading at a fixed rate
  animator?.update(dt, {
    grounded: player.grounded,
    speed: onBelt ? Math.max(player.moveSpeed, Math.hypot(player.velocity.x, player.velocity.z)) : Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: player.locked ? 0 : inputState.move.x,
    launch,
  })

  sendPose(player, Math.hypot(player.velocity.x, player.velocity.z))
  remotes.update(dt, player.position)
  updateCamera(camera, dt)
  space.update(Math.round(launch.altitude))
  flightHud.update(launch)
  if (pointerHeld.down) gainSoda()
  chest.set(player.position.x, player.position.y + 1.6, player.position.z).project(camera)
  playerScreen.x = chest.x * 0.5 + 0.5
  playerScreen.y = 0.5 - chest.y * 0.5
  lights.follow(player.position.x, player.position.z)
  renderer.render(scene, camera)
  markLoaded('scene')
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(10, 0, -5)
if (import.meta.env.DEV) {
  window.__game = { player, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
