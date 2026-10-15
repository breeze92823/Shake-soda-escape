import { AdditiveBlending, CanvasTexture, Clock, Group, PointLight, Sprite, SpriteMaterial, Vector3, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, PHYSICS, SPAWN, SPAWN_FACING } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, pointerHeld, install as installInput } from './input.js'
import { player, resetPlayer, rotateTowards, step as stepPlayer } from './player.js'
import { syncYawToPlayer, update as updateCamera } from './camera.js'
import { createCloudDecks, createFog, createGround, createLights, createSky, createSkyDecor } from './world.js'
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
import { playShake, playSpend, playWins } from './sfx.js'
import { gainSoda, landReward, notify, onSodaGain, runningBelt, state, subscribe } from './state.js'
import { initNet, sendPose, syncAvatar } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createFlightHud } from './flightHud.js'
import { createSpace } from './space.js'
import { createWorlds } from './worlds.js'
import { createBlackHole } from './blackhole.js'
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
const decks = createCloudDecks()
scene.add(sky, decor, decks, ground, lobby.group)
const lights = createLights()
const space = createSpace({ sky, decor, decks, fog: scene.fog, hemi: lights.hemi })
const flightHud = createFlightHud()
scene.add(lights.hemi, lights.sun, lights.sun.target)
initLaunch(scene)
createTouchControls({ showMenu: bloxity.showMenu })
const hud = createHud({ showMenu: bloxity.showMenu })
initInteract({ say: hud.say })
const remotes = createRemotePlayers(scene)
const blackhole = createBlackHole(scene)
const worlds = createWorlds({ scene, lobby, ground, space, lights, say: hud.say, remotes, blackhole })
worlds.enter('lobby')
initNet() // saves/loads progress and joins the shared room (no-op without a server)
// Landing pays Wins for the peak altitude and updates the Record.
onLaunchLand((peak) => {
  const reward = landReward(peak)
  state.wins += reward
  if (peak > state.record) state.record = peak
  notify()
  hud.say(`+${short(reward)} Wins`)
})

// Wins sounds for every source (landing, daily, shop, purchases): react to the balance changing.
// The first seconds are ignored so loading the saved balance stays silent.
let lastWins = state.wins
const winsSoundFrom = performance.now() + 4000
subscribe((s) => {
  const d = s.wins - lastWins
  lastWins = s.wins
  if (d === 0 || performance.now() < winsSoundFrom) return
  if (d > 0) playWins(d >= 1000)
  else playSpend()
})

// --- Player avatar ----------------------------------------------------------
// Always the game's own character (player.glb, or the procedural fallback). A
// signed-in player's equipped Bloxity cosmetics are attached to it and the
// customizer's body proportions applied; it rebuilds on customizer edits and
// sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
const auraFx = createAuraFx(playerGroup)
// Summit light burst: a big additive halo + point light on the player while launch.warp is up.
const warpGlow = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,240,170,0.6)')
  grad.addColorStop(1, 'rgba(255,200,80,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }))
  sprite.position.y = 1
  sprite.visible = false
  const light = new PointLight('#fff1b0', 0, 40)
  light.position.y = 1
  playerGroup.add(sprite, light)
  return { sprite, light }
})()

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

onSodaGain(() => {
  animator?.shake()
  playShake()
})

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
let summitFired = false

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  updateLaunch(dt, camera, renderer.domElement.height)
  stepPlayer(dt)
  blackhole.update(dt, clock.elapsedTime)
  launch.shake = Math.max(launch.shake, blackhole.state.shake)
  stepInteract()
  hud.update()
  worlds.update(clock.elapsedTime, dt)
  // The 20K Summit: unlock + warp to the next world (once per launch).
  if (launch.warp > 0.5 && !summitFired) {
    summitFired = true
    worlds.summit()
  } else if (launch.phase === 'idle') summitFired = false
  auraFx.update(clock.elapsedTime, dt)

  // On an unlocked belt: soda gains automatically (as a click would, 1s cooldown) and the player runs
  // in place facing the console, unless they are steering.
  const onBelt = !player.locked && player.grounded && runningBelt() >= 0
  if (onBelt) {
    gainSoda()
    if (!inputState.move.x && !inputState.move.z) player.facing = rotateTowards(player.facing, -Math.PI / 2, PHYSICS.turnSpeed * dt)
  }

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing + blackhole.state.spin // player.js turns the heading at a fixed rate
  playerGroup.rotation.x = blackhole.state.tumble
  playerGroup.scale.setScalar(blackhole.state.scale)
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
  const w = launch.warp
  warpGlow.sprite.visible = w > 0
  warpGlow.sprite.scale.setScalar((6 + 5 * Math.sin(performance.now() * 0.012)) * w + 0.01)
  warpGlow.sprite.material.opacity = w
  warpGlow.light.intensity = 400 * w
  sky.position.copy(camera.position)
  decor.position.copy(camera.position)
  decks.userData.follow(player.position.x, player.position.y, player.position.z)
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
  window.__game = { player, worlds, teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() } }
}
