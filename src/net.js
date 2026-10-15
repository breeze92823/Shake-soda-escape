// Colyseus link to Shake-soda-escape-backend (room "world"): loads/saves the persisted half of
// `state`, relays this player's pose / held soda / aura / avatar, exposes the other players and the
// leaderboards. Never throws and never blocks play: with no server (or an unreachable one) the game
// simply runs offline on local state.
import { Client } from '@colyseus/sdk'
import { DEFAULT_SODA, DEV_MODE, GAME_SLUG, NET, SERVER_URL, TUTORIAL } from './config.js'
import { authState, sdk, getEquippedAvatar, getProportions, getSkinTextureUrl, subscribeAuth } from './bloxity.js'
import { devUnlockAll, notify, setServerTime, state, subscribe } from './state.js'
import { markLoaded } from './loading.js'

// The keys the server persists (backend src/sanitize.ts). `owned`, `passes` and `auras` are Sets in `state`.
const SAVED = ['soda', 'wins', 'level', 'xp', 'xpNext', 'rebirths', 'equipped', 'owned', 'passes', 'record', 'sodaBoostUntil', 'auras', 'aura', 'worlds', 'dailyDay', 'dailyClaimedAt', 'tutorialStep']
const SETS = new Set(['owned', 'passes', 'auras', 'worlds'])
const AVATAR_MAX = 3000 // backend AVATAR_MAX_LEN

export const net = {
  room: null,
  connected: false,
  hydrated: false, // a progress/noProgress answer arrived: saving is allowed
  leaderboard: { soda: [], rebirths: [] }, // rows { id, name, value, avatar? }
  get sessionId() {
    return this.room?.sessionId ?? null
  },
  get players() {
    return this.room?.state?.players ?? null
  },
}

const boardListeners = new Set()
export function onLeaderboard(fn) {
  boardListeners.add(fn)
  fn(net.leaderboard)
  return () => boardListeners.delete(fn)
}

// --- Identity ----------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved).
function guestId() {
  const make = () => `guest-${Math.random().toString(36).slice(2, 10)}`
  try {
    let id = localStorage.getItem('sse-guest')
    if (!id) localStorage.setItem('sse-guest', (id = make()))
    return id
  } catch {
    return make()
  }
}
const GUEST = guestId()

function identity() {
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}

// Bloxity avatar as the server relays it: JSON { equipped, proportions, skin }, length-capped.
// The skin URL is the first thing dropped when it does not fit.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  for (const skin of [getSkinTextureUrl(), null]) {
    try {
      const json = JSON.stringify({ equipped, proportions: getProportions(), skin })
      if (json.length <= AVATAR_MAX) return json
    } catch {
      return ''
    }
  }
  return ''
}

// --- Saving ------------------------------------------------------------------
let lastSaved = ''
let saveTimer = 0
let firstDirty = 0
let sentId = '' // identity the server currently attributes saves to

const snapshot = () => JSON.stringify(Object.fromEntries(SAVED.map((k) => [k, SETS.has(k) ? [...state[k]] : state[k]])))
const isGuest = () => sentId.startsWith('guest-')

export function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = 0
  firstDirty = 0
  if (!net.connected || !net.hydrated) return
  const snap = snapshot()
  if (snap === lastSaved) return
  lastSaved = snap
  send('saveProgress', JSON.parse(snap))
}

function scheduleSave() {
  if (!net.connected || !net.hydrated) return
  const now = performance.now()
  if (!firstDirty) firstDirty = now
  clearTimeout(saveTimer)
  const wait = Math.min(NET.saveDebounce * 1000, Math.max(0, firstDirty + NET.saveMaxWait * 1000 - now))
  saveTimer = setTimeout(saveNow, wait)
}

function hydrate(doc) {
  for (const k of SAVED) {
    if (doc[k] === undefined) continue
    state[k] = SETS.has(k) ? new Set(doc[k]) : doc[k]
  }
  state.owned.add(DEFAULT_SODA) // the plain cola is always owned
  state.worlds.add('lobby')
  devUnlockAll()
  lastSaved = snapshot() // what the server holds: don't echo it straight back
  notify()
}

// --- Messages out ------------------------------------------------------------
function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

let lastPose = ''
let lastPoseAt = 0
// Throttled to NET.poseHz; skips repeats while standing still.
// `belt` = index of the treadmill being run on (-1 = none): others animate the run + scroll that belt.
export function sendPose(player, speed, pose = '', belt = -1) {
  if (!net.connected) return
  const now = performance.now()
  if (now - lastPoseAt < 1000 / NET.poseHz) return
  lastPoseAt = now
  const r = (n) => Math.round(n * 100) / 100
  // Other worlds share the lobby's coordinates, so while away the avatar is parked under the lobby floor (out of sight).
  const away = state.world !== 'lobby'
  const msg = { x: away ? 0 : r(player.position.x), y: away ? -39 : r(player.position.y), z: away ? 0 : r(player.position.z), yaw: r(player.facing), speed01: r(Math.min(1, speed / player.moveSpeed)), grounded: player.grounded, pose, belt: away ? -1 : belt }
  const key = JSON.stringify(msg)
  if (key === lastPose) return
  lastPose = key
  send('pose', msg)
}

let sentEquipped = null
let sentAura = null
function syncEquipment() {
  if (!net.connected) return
  if (state.equipped !== sentEquipped) send('setEquipped', { equipped: (sentEquipped = state.equipped) })
  if ((state.aura ?? '') !== sentAura) send('setAura', { aura: (sentAura = state.aura ?? '') })
}

let sentAvatar = null
export function syncAvatar() {
  if (!net.connected) return
  const avatar = avatarJson()
  if (avatar === sentAvatar) return
  sentAvatar = avatar
  send('setAvatar', { avatar })
}

// --- Connection --------------------------------------------------------------
function attach(room) {
  net.room = room
  net.connected = true
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    setServerTime(doc?.serverTime)
    // A saved account never gets the tutorial: the server sends tutorialStep = finished for one that
    // predates it (backend resolveTutorialStep), and a doc without it from an old server reads as finished too.
    hydrate({ ...doc, tutorialStep: doc?.tutorialStep ?? TUTORIAL.steps })
    state.tutorialReady = true
    markLoaded('net')
  })
  room.onMessage('noProgress', (msg) => {
    setServerTime(msg?.serverTime)
    state.tutorialReady = true // a new account (or guest): the tutorial starts from the local step
    // New account, guest or no database: keep what we have and push it as the first save.
    net.hydrated = true
    markLoaded('net')
    lastSaved = ''
    if (!isGuest()) saveNow()
  })
  room.onMessage('serverError', () => {
    // The save exists but could not be read: never overwrite it.
    net.hydrated = false
    markLoaded('net')
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onMessage('leaderboard', (rows) => {
    net.leaderboard = { soda: rows?.soda ?? [], rebirths: rows?.rebirths ?? [] }
    for (const fn of boardListeners) fn(net.leaderboard)
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    setTimeout(connect, 3000) // keep trying; local play is unaffected meanwhile
  })
  sentEquipped = sentAura = sentAvatar = null
  syncEquipment()
  syncAvatar()
}

// Bloxity hosting has no fixed socket URL: the SDK resolves the endpoint of this game's server
// (a dev-channel page reaches the dev backend, prod the prod one) on every connect, and each
// resolve needs its own Client. A configured SERVER_URL (config.js, per channel) wins.
const canResolve = () => typeof sdk()?.net?.resolveEndpoint === 'function'
async function serverUrl() {
  if (SERVER_URL) return SERVER_URL
  const { endpoint } = await sdk().net.resolveEndpoint(GAME_SLUG)
  return endpoint
}

let connecting = false
async function connect() {
  if (!(SERVER_URL || canResolve()) || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const client = new Client(await serverUrl())
    attach(await client.joinOrCreate('world', { ...id, avatar: avatarJson() }))
  } catch (err) {
    console.warn('[net] could not reach the server; playing offline', err?.message ?? err)
    if (DEV_MODE) state.tutorialReady = true // no server in dev: can't tell old accounts from new, so show it
    markLoaded('net')
    setTimeout(connect, 10000)
  } finally {
    connecting = false
  }
}

export function initNet() {
  if (!SERVER_URL && !canResolve()) {
    state.tutorialReady = true // offline play has no saved accounts: everyone is new
    markLoaded('net')
    return console.info(`[net] no server configured${DEV_MODE ? ' (VITE_DEV_MODE)' : ''}; playing offline`)
  }
  subscribe(() => {
    scheduleSave()
    syncEquipment()
  })
  // The first ready call connects; later ones are sign-in / sign-out.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username })
    saveNow() // under the old id, before switching
    net.hydrated = false
    sentId = id.userId
    send('identify', id)
    syncAvatar()
  })
  window.addEventListener('beforeunload', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
}
