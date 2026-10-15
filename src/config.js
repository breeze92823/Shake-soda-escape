// Every tunable constant lives here. Look/feel values match Clean Leaves for Loot.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'shake-soda-escape' // slug registered on bloxity.io
export const GAME_TITLE = 'Shake Soda Escape'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
// With DEV_MODE on, also own every soda (cola, orange, ... trophy) from the start (see .env.example).
export const DEV_UNLOCK_ALL = DEV_MODE && import.meta.env.VITE_DEV_UNLOCK_ALL === 'true'

// --- Multiplayer (net.js, backend: ../Shake-soda-escape-backend) --------------------
// Colyseus server URL per Bloxity Legion channel: `npm run dev` / `build:dev` use _DEV (dev defaults to
// the local server), `npm run build` uses _MAIN. Empty = net.js asks the Bloxity SDK for the channel's
// endpoint at runtime; with no SDK either the game is offline (no saving, no other players).
const SERVER_URL_DEV = import.meta.env.VITE_SERVER_URL_DEV || (import.meta.env.DEV ? 'ws://localhost:2567' : '')
const SERVER_URL_MAIN = import.meta.env.VITE_SERVER_URL_MAIN || ''
export const SERVER_URL = import.meta.env.MODE === 'production' ? SERVER_URL_MAIN : SERVER_URL_DEV
export const NET = {
  poseHz: 15, // pose messages per second
  saveDebounce: 1.5, // s of quiet after a state change before saving
  saveMaxWait: 8, // s: a continuous change stream (shaking) still saves this often
  remoteLerp: 12, // 1/s: how fast remote players ease toward their last reported pose
  remoteFade: 60, // m: remote players further away than this are hidden
  maxRemotes: 24, // drawn at once (nearest first)
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const GROUND_SIZE = 1000
export const SPAWN = { x: 0, y: 0.3, z: 0 }
export const SPAWN_FACING = Math.PI // faces -Z (north: the tower)

// --- Lobby (lobby.js) --------------------------------------------------------
// Walled arena; the walls' inner faces are the movement bounds.
export const ARENA = { minX: -26, maxX: 26, minZ: -36, maxZ: 22, wallHeight: 12, capHeight: 1.2, wallThickness: 2 }
export const WORLD_BOUNDS = { minX: ARENA.minX, maxX: ARENA.maxX, minZ: ARENA.minZ, maxZ: ARENA.maxZ }
export const TOWER = { x: 0, z: -25, size: 9, segmentHeight: 8.75, segments: 80, labelStep: 250 } // 80 x 8.75 m = 700 m = the Summit; labels in studs up to 20K. Keep segmentHeight close to size so the number isn't stretched
export const LAUNCH_PAD = { x: 0, z: -17.6, radius: 2.3 }
export const PORTAL = { x: -9, z: -27 }
export const VOID_NPC = { x: 10, z: -27 }
// Soda display along the east wall: a low red platform with ramped ends and a
// raised back tier; items sit on cyan pads at itemX, spaced along Z.
export const DISPLAY = {
  minZ: -30,
  maxZ: 15,
  maxX: 26,
  ramp: 4, // m each sloped end runs
  front: { minX: 14, top: 0.5, itemX: 17.2, z: [-18.6, -13.4, -8.2, -3, 2.1] },
  back: { minX: 20.5, top: 2.2, itemX: 23.3, minZ: -29, maxZ: 13, ramp: 3.5, z: [-23.9, -18.5, -13.2, -7.8, -2.5, 2.9, 8.2] },
}
// Soda items on the display pads, far (north) to near (south) per tier. Equipping one
// swaps the can every avatar holds; `reward` is shown on the sign (no economy yet).
// `price` is in Wins and sodas unlock in this order (front then back): only the next one can be bought.
// Only DEFAULT_SODA starts owned.
export const SODA_ITEMS = {
  front: [
    { kind: 'cola', name: 'Cola Can', reward: '+1 Soda', gain: 1 },
    { kind: 'orange', name: 'Orange Pop', reward: '+3 Soda', gain: 3, price: 3 },
    { kind: 'lemon', name: 'Lemon Grenade', reward: '+8 Soda', gain: 8, price: 15 },
    { kind: 'lime', name: 'Lime Lab', reward: '+20 Soda', gain: 20, price: 60 },
    { kind: 'ufo', name: 'Grape UFO', reward: '+50 Soda', gain: 50, price: 250 },
  ],
  back: [
    { kind: 'cherry', name: 'Cherry Bomb', reward: '+125 Soda', gain: 125, price: 1000 },
    { kind: 'slush', name: 'Blue Slush', reward: '+300 Soda', gain: 300, price: 5000 },
    { kind: 'strawberry', name: 'Strawberry Milk', reward: '+750 Soda', gain: 750, price: 20000 },
    { kind: 'cream', name: 'Cream Float', reward: '+2K Soda', gain: 2000, price: 75000 },
    { kind: 'galaxy', name: 'Galaxy Shake', reward: '+5K Soda', gain: 5000, price: 300000 },
    { kind: 'rainbow', name: 'Rainbow Juice', reward: '+12K Soda', gain: 12000, price: 1200000 },
    { kind: 'trophy', name: 'Gold Trophy', reward: '+30K Soda', gain: 30000, price: 5000000 },
  ],
}
export const DEFAULT_SODA = 'cola'
// Void Soda (NPC at VOID_NPC): a premium can outside the unlock ladder, buyable any time with Wins (hold E on its pad).
export const VOID_SODA = { kind: 'void', name: 'Void Soda', reward: '+60K Soda', gain: 60000, price: 8000000 }
// Every themed world (WORLDS) has its own soda shelf (worldShop.js) next to a copy of the lobby treadmills (SHOP):
// three sodas that out-gain the lobby's, each world's priced above the one before. A world's sodas unlock in
// order (like the lobby's) and an owned one works in every world. `look` styles the model (sodaItems.js):
// shape can | bottle | cup, body colour, accent (band / straw / cap) and optional glow. Ids are mirrored by the backend (SODA_IDS).
export const WORLD_SODAS = {
  candy: [
    { kind: 'candy-1', name: 'Marshmallow Fizz', gain: 80000, price: 400000, look: { shape: 'cup', color: '#fff0f8', accent: '#ff8ac8' } },
    { kind: 'candy-2', name: 'Gumdrop Pop', gain: 150000, price: 1500000, look: { shape: 'bottle', color: '#ff6ad0', accent: '#ffe45a' } },
    { kind: 'candy-3', name: 'Cotton Candy Cola', gain: 300000, price: 5000000, look: { shape: 'can', color: '#8fd8ff', accent: '#ff7ac4' } },
  ],
  neon: [
    { kind: 'neon-1', name: 'Plasma Cola', gain: 500000, price: 1500000, look: { shape: 'can', color: '#101a3a', accent: '#00f0ff', glow: true } },
    { kind: 'neon-2', name: 'Ion Fizz', gain: 1000000, price: 6000000, look: { shape: 'bottle', color: '#ff38d6', accent: '#00f0ff', glow: true } },
    { kind: 'neon-3', name: 'Nova Reactor', gain: 2500000, price: 20000000, look: { shape: 'can', color: '#ff9a1a', accent: '#fff07a', glow: true } },
  ],
  glacier: [
    { kind: 'glacier-1', name: 'Frost Fizz', gain: 5000000, price: 8000000, look: { shape: 'can', color: '#bfefff', accent: '#3a9ae8' } },
    { kind: 'glacier-2', name: 'Icicle Slush', gain: 12000000, price: 30000000, look: { shape: 'cup', color: '#7ad0ff', accent: '#ffffff' } },
    { kind: 'glacier-3', name: 'Aurora Soda', gain: 30000000, price: 100000000, look: { shape: 'bottle', color: '#6dffcb', accent: '#b88cff', glow: true } },
  ],
  volcano: [
    { kind: 'volcano-1', name: 'Magma Cola', gain: 60000000, price: 50000000, look: { shape: 'can', color: '#ff4a1a', accent: '#ffd21a', glow: true } },
    { kind: 'volcano-2', name: 'Ember Burst', gain: 150000000, price: 200000000, look: { shape: 'bottle', color: '#ff9a1a', accent: '#ff2a1a', glow: true } },
    { kind: 'volcano-3', name: 'Obsidian Blast', gain: 400000000, price: 600000000, look: { shape: 'can', color: '#1a1015', accent: '#ff6a1a', glow: true } },
  ],
  reef: [
    { kind: 'reef-1', name: 'Bubble Pop', gain: 1000000000, price: 300000000, look: { shape: 'bottle', color: '#8ae8ff', accent: '#ffffff' } },
    { kind: 'reef-2', name: 'Coral Cooler', gain: 3000000000, price: 1200000000, look: { shape: 'cup', color: '#ff7a9a', accent: '#ffd24a' } },
    { kind: 'reef-3', name: 'Kraken Cola', gain: 10000000000, price: 5000000000, look: { shape: 'can', color: '#2a6fe0', accent: '#4ad8c0', glow: true } },
  ],
}
for (const list of Object.values(WORLD_SODAS)) for (const s of list) s.reward = `+${s.gain >= 1e9 ? s.gain / 1e9 + 'B' : s.gain >= 1e6 ? s.gain / 1e6 + 'M' : s.gain / 1e3 + 'K'} Soda`
// "Press E" interactions (interact.js): hold E this long to confirm; pads trigger within `range` m.
export const INTERACT = { holdMs: 2000, padRange: 1.8, padHeight: 1.5 }
// Soda multiplier treadmills along the west wall on a low red platform (ramp = 0:
// square ends); x1 (south) ... x32 (north) centred on gateX at gateZ.
export const SHOP = { minX: -26, maxX: -14, minZ: -31, maxZ: 15, top: 0.4, ramp: 0, gateX: -20.5, gateZ: [8, 2, -4, -10, -16, -22],
  // Standing on a belt (length x width m around gate) multiplies each gain by `mults[i]` (x1..x32);
  // belt i needs `rebirths[i]` rebirths (as on its sign).
  belt: { length: 10, width: 4.4 }, mults: [1, 2, 4, 8, 16, 32], rebirths: [0, 3, 4, 5, 6, 7] }
// South wall: two leaderboards (board centre x).
export const SOUTH = { boardZ: 21.3, topSodaX: 8, topRebirthsX: -6 }
export const STEP_UP = 0.6 // m the player walks up onto without jumping

// --- Worlds (worlds.js, worldScenes.js) -----------------------------------------------
// The lobby is world 0. Reaching the Summit (SPACE.summit studs) in a world unlocks and warps to the next
// one; every world has its own sky, light, floor and walls, the same tower + launch pad, and portals
// (hold E) back to the lobby / on to the next unlocked world. `winsMult` multiplies landing Wins and
// `sodaMult` every soda gain while you are in it. Ids are mirrored by the backend (WORLD_IDS).
export const WORLDS = [
  {
    id: 'lobby', short: 'Soda Lobby', name: 'Soda Lobby', tag: 'Where it all starts', winsMult: 1, sodaMult: 1,
    sky: { horizon: '#5fb4ff', zenith: '#0a4fe0' }, // = COLORS.horizon / zenith
    fog: { near: 90, far: 260 },
    light: { hemiSky: '#e4f1ff', hemiGround: '#b9a98a', hemiIntensity: 1.5, sunColor: '#fff2d6', sunIntensity: 2.4 },
    ground: { color: '#3fd62a' },
    card: { top: '#4ed83c', bot: '#1c9a1e', edge: '#0b3a10' },
  },
  {
    id: 'candy', short: 'Candy Cloud', name: 'Candy Cloud Kingdom', tag: 'Marshmallow ground, lollipop trees', winsMult: 2, sodaMult: 2,
    sky: { horizon: '#ffc6e8', zenith: '#8fa8ff' },
    fog: { near: 70, far: 230 },
    light: { hemiSky: '#fff0fa', hemiGround: '#ffc2e0', hemiIntensity: 1.6, sunColor: '#fff0e0', sunIntensity: 2.2 },
    ground: { color: '#ffd1ec', contrast: 0.35 },
    walls: { a: '#ff9ccf', b: '#ffc2e4', cap: '#ffffff', height: 3.2 },
    portal: { frame: '#ff7ac4', dark: '#c64a96', neon: '#ffe45a' },
    card: { top: '#ff9ad5', bot: '#e24aa6', edge: '#5a0a3a' },
  },
  {
    id: 'neon', short: 'Neon Station', name: 'Neon Cola Station', tag: 'Orbital platform, low gravity', winsMult: 5, sodaMult: 5,
    sky: { horizon: '#2a0a5a', zenith: '#02020b' },
    fog: { near: 60, far: 220 },
    light: { hemiSky: '#8a9bff', hemiGround: '#401a7a', hemiIntensity: 1.1, sunColor: '#b8c8ff', sunIntensity: 1.6 },
    ground: { color: '#16183a', contrast: 0.6 },
    walls: { a: '#222658', b: '#2e3478', cap: '#00f0ff', height: 2.4 },
    portal: { frame: '#2b3290', dark: '#14185c', neon: '#00f0ff' },
    baseDark: 0.96, baseStars: 1, baseNebula: 1, decor: false, gravity: -9,
    card: { top: '#3cd8ff', bot: '#2a5cf0', edge: '#0a1a5a' },
  },
  {
    id: 'glacier', short: 'Frozen Glacier', name: 'Frozen Soda Glacier', tag: 'Slippery ice, aurora sky', winsMult: 10, sodaMult: 10,
    sky: { horizon: '#cfeeff', zenith: '#16206a' },
    fog: { near: 55, far: 190 },
    light: { hemiSky: '#e6f6ff', hemiGround: '#9cc8e8', hemiIntensity: 1.7, sunColor: '#e8f4ff', sunIntensity: 2.0 },
    ground: { color: '#b8e6ff', contrast: 0.4 },
    walls: { a: '#8fd0f0', b: '#b6e4fa', cap: '#ffffff', height: 6 },
    portal: { frame: '#6aa8d8', dark: '#3a78a8', neon: '#9ff6ff' },
    grip: 0.15, aurora: true, baseDark: 0.45, baseStars: 1, decor: false, // grip < 1 = slippery ice (player.js)
    card: { top: '#a8ecff', bot: '#4aa8e8', edge: '#0a3a5a' },
  },
  {
    id: 'volcano', short: 'Lava Volcano', name: 'Volcano Lava Soda', tag: 'Lava rivers, fizzing geysers', winsMult: 25, sodaMult: 25,
    sky: { horizon: '#ff7a2a', zenith: '#2a0a10' },
    fog: { near: 45, far: 170 },
    light: { hemiSky: '#ffb070', hemiGround: '#5a1a0a', hemiIntensity: 1.2, sunColor: '#ff9a50', sunIntensity: 2.0 },
    ground: { color: '#3a2420', contrast: 0.7 },
    walls: { a: '#3a2a28', b: '#4a3430', cap: '#ff5a1a', height: 8 },
    portal: { frame: '#5a3a30', dark: '#2a1a16', neon: '#ff7a1a' },
    baseDark: 0.25, decor: false,
    card: { top: '#ff8a3a', bot: '#c81a0a', edge: '#4a0a02' },
  },
  {
    id: 'reef', short: 'Fizz Reef', name: 'Underwater Fizz Reef', tag: 'Coral, bubbles and calm blue', winsMult: 60, sodaMult: 60,
    sky: { horizon: '#2fb8d8', zenith: '#0a3a8a' },
    fog: { near: 20, far: 120 },
    light: { hemiSky: '#9fefff', hemiGround: '#1a6a8a', hemiIntensity: 1.5, sunColor: '#c8ffff', sunIntensity: 1.8 },
    ground: { color: '#e8d49a', contrast: 0.4 },
    walls: { a: '#1a8ab0', b: '#2aa6c8', cap: '#9ff6ff', height: 5 },
    portal: { frame: '#1a8ab0', dark: '#0a5a80', neon: '#7affd8' },
    decor: false, bubbles: true,
    card: { top: '#5ae8ff', bot: '#1a7ad0', edge: '#082a5a' },
  },
]
export const WORLD_IDS = WORLDS.map((w) => w.id)
export const worldDef = (id) => WORLDS.find((w) => w.id === id) ?? WORLDS[0]

// --- Physics feel (player.js) -----------------------------------------------
export const PHYSICS = {
  moveSpeed: 10, // m/s on flat ground
  accel: 75, // m/s^2 toward the target velocity (full speed in ~0.13 s)
  decel: 69, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  aimTurnSpeed: 20, // rad/s the body turns to face the camera while blowing
  gravity: -22, // m/s^2
  jumpSpeed: 7.5, // m/s
  killY: -30, // fell this far below the ground: respawn
}
// --- Soda Jump launch sequence (launch.js) ------------------------------------
// Step on the pad -> controls lock -> grab the can with both hands -> shake -> burst -> rocket up -> free fall.
export const LAUNCH = {
  triggerRadius: 1.8, // m from the pad centre that starts it
  rearmDistance: 3.4, // m the player must walk away before the pad can fire again
  alignRate: 9, // 1/s the player glides to the pad centre / turns to face the camera
  grab: 0.7, // s raising the can into both hands
  shake: 2.1, // s of shaking (ramps up)
  height: 15, // m gained above the pad at the minimum launch (just over the outer walls: wallHeight + capHeight = 13.2); launch speed is derived from PHYSICS.gravity
  maxHeight: 700, // m of real rise at the Summit (a huge, fast climb; the sky + decks sell the rest)
  riseTimeMin: 3, // s to the apex at the minimum launch (gravity is lowered to stretch the flight)
  riseTimeMax: 10, // s to the apex at the Summit, so the climb through the sky layers can be seen
  landLock: 0.25, // s controls stay locked after touchdown
  shakeHz: 7, // can shakes per second at full intensity
  camFov: 16, // degrees the FOV widens at the top of the launch
  camDistance: 5, // m the camera boom pulls back
  camEase: 4, // 1/s
  camShake: 0.07, // m of camera shake at full intensity
  canHeight: 1.1, // m above the feet where the can is held (fx origin)
  canForward: 0.5, // m in front of the player
  maxParticles: 1100,
  mobileParticleScale: 0.5,
  // Particle look (launchFx.js). Sizes are diameters in metres.
  fx: {
    chargeTime: 0.2, // s of pressure build-up at the end of the shake (can bulges, foam leaks)
    canBulge: 0.22, // extra can scale at full charge
    jetTime: 0.75, // s the cola jet pushes under the feet, then cuts off
    jetLength: 12, // m of jet column below the feet
    jetRadius: 0.95, // m, width at the far end (the jet is 30% of this at the feet)
    columnTime: 1.4, // s the thin foam column up from the pad lingers after the jet cuts
    columnRadius: 0.5,
    fountainTime: 1.6, // s the pad keeps spraying after the player has left
    jetColors: ['#fff6e6', '#e3a35a'], // foam white near the feet -> cola amber at the far end
    bubbleMin: 0.05, // smallest bubble
    bubbleSpread: 0.45, // extra size of the rare big ones (random^3 weighted toward small)
    bubbleLift: 2.4, // m/s^2 buoyancy
    bubbleDrag: 1.3,
    bubbleTurbulence: 2.2, // m/s^2 sideways wander
    bubblePop: 0.45, // chance a bubble pops (with a tiny spray) instead of fading
    wobble: 0.14, // squash amount of a rising bubble
    dropletGravity: -16, // m/s^2
    dropletDrag: 0.15,
    foamDrag: 2.4,
    foamColors: ['#fff8ea', '#ffeccc', '#ffdcae', '#f7c9a0', '#ffc1b0'], // creamy white to light amber / cola red
    mistColors: ['#ffffff', '#f1f7ff'],
    dropletColors: ['#ffd9b0', '#ffffff', '#ffb48f'],
  },
}
// --- Launch altitude + outer space (launch.js, space.js, flightHud.js) -------------
// A launch's peak (in "studs") = the soda total scaled so `summitSoda` soda = the Summit, at least `baseStuds`, capped by the equipped soda:
// cap = summit * min(1, gain / summitGain), so only a +30K soda (Gold Trophy) or better reaches the Summit.
// The player really rises only LAUNCH.height..maxHeight m; the altitude is virtual and drives the sky.
export const SPACE = {
  summit: 20000, // studs, fixed top
  summitGain: 30000, // equipped soda gain that unlocks the Summit
  summitSoda: 100000000, // soda total needed for the Summit (peak studs scale linearly: soda x summit / summitSoda)
  baseStuds: 20, // minimum peak (the plain launch)
  winsPerStud: 1.766, // Wins collected on landing = peak studs x this
  darkFrom: 400, // altitude (studs) the blue sky starts to darken ...
  darkTo: 5000, // ... and is fully black
  starsFrom: 1500,
  starsTo: 6000,
  nebulaFrom: 5000,
  nebulaTo: 16000,
  decorFade: 0.5, // clouds + rainbows are gone once the sky is this dark (0..1)
  hideScenery: 0.97, // ground + lobby are hidden at this darkness
  // Named layers: the flight HUD flashes the name when the altitude (studs) first reaches `from`.
  layers: [
    { from: 0, name: 'TROPOSPHERE' },
    { from: 600, name: 'STRATOSPHERE' },
    { from: 1500, name: 'MESOSPHERE' },
    { from: 3000, name: 'THERMOSPHERE' },
    { from: 5500, name: 'OUTER SPACE' },
  ],
  fogNear: 25, // fog tightens to this / fogFar at full dark, so the ground fades into black below
  fogFar: 110,
  spaceColor: '#02020b',
  hemiDim: 0.65, // hemisphere light loss at full dark
}
export const PLAYER_DIMS ={ radius: 0.4, height: 1.8 }

// --- Look ------------------------------------------------------------------
export const COLORS = {
  horizon: '#5fb4ff',
  zenith: '#0a4fe0',
  baseplate: '#3fd62a', // studded green floor
  wallA: '#c9622f', // checkered brick wall, two tones
  wallB: '#b4532a',
  wallCap: '#3fd62a',
  tower: '#ff8a17',
  towerBase: '#f2621a',
}
export const FOG = { near: 90, far: 260 }
export const LIGHT = {
  sunColor: '#fff2d6',
  sunIntensity: 2.4,
  sunPosition: [30, 60, 20],
  shadowMapSize: 2048,
  shadowRange: 40, // half-width of the shadow frustum around the player
  hemiSky: '#e4f1ff',
  hemiGround: '#b9a98a',
  hemiIntensity: 1.5,
}

// Default (signed-out / fallback) character look.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f9e8f', hair: '#5a3a22' }


// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1400,
  startPitch: 0.32, // radians above the horizon
  minPitch: -0.1,
  maxPitch: 1.2,
  distance: 9, // resting boom length, m
  minDistance: 3,
  maxDistance: 15,
  followLerp: 10, // 1/s: the ONE smoothing stage, on the point the camera follows
  targetHeight: 0.6, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of right-drag
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedDistance: 0.8, // m the boom pulls back at full speed
  speedFov: 4, // degrees the FOV widens at full speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 4, // 1/s the boom eases back out after a wall pulled it in
}

// SDK setting keys this game listens for; registering a listener makes the control appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: 'High', type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from +1 Cut Grass Adventure.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-8), z: deg(14) },
      ArmL2: { x: deg(38) },
      ArmR1: { x: deg(4), z: deg(-6) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  // Right arm always holds a cola can: upper arm forward, elbow bent. Whatever the
  // current animation does to the arm is kept at `follow` strength on top of this.
  hold: {
    upperArm: { x: deg(-30), z: deg(6) },
    elbow: deg(-85), // negative folds the forearm forward on player.glb
    upperArmNoElbow: deg(-60), // procedural rig has no elbow bone: raise the whole arm instead
    follow: 0.22, // share of the underlying arm motion (walk swing, jump lift) that stays
    canRadius: 0.36,
    canHeight: 1.05,
    canForward: 0.3, // rig units, character space: can centre ahead of the fist
    canLift: 0.1,
    // One-hand shake on every soda gain: the arm pumps at `hz` for `duration` s (fading out), `upper`/`elbow` swing in rad.
    shake: { hz: 9, duration: 0.3, upper: deg(16), elbow: deg(24), roll: deg(8) },
  },
  // Two-handed grab + shake (launch sequence). Rig units; arms lerp from idle into `arms`, the shake adds to them.
  twoHand: {
    arms: { upper: deg(-62), roll: deg(24), elbow: deg(-100) },
    shakeUpper: deg(20), // arm swing per shake at full intensity
    shakeElbow: deg(26),
    lean: deg(8), // spine crouch over the can
    canY: 3.5, // can centre height on the rig
    canZ: 2.1, // ahead of the chest
    canBob: 0.4, // vertical travel of a shake
    canTilt: deg(18),
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true'
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- HUD (hud.js) --------------------------------------------------------------
// Placeholder standings until the soda loop exists (match the reference screenshot).
// Starting Wins come from VITE_START_WINS (default 0), e.g. VITE_START_WINS=6120000 for testing purchases.
const START_WINS = Math.max(0, Number(import.meta.env.VITE_START_WINS) || 0)
export const HUD_START = { soda: 1, wins: START_WINS, level: 1, xp: 0, xpNext: 20, rebirths: 0 }
// Rebirth window: rebirth n gives x(1 + n*multStep) Soda (rebirth 0: x1.0, rebirth 1: x1.5) and needs Level levelBase + n*levelStep
// for the next one (rebirth 4: x3.0, Level 50). Rebirthing resets the level to 1; Auto Rebirth does it as soon as the level is reached.
export const REBIRTH = { multStep: 0.5, levelBase: 10, levelStep: 10 }
// Daily Rewards window: one reward per `cooldownMs`, days 1-7 in order (then back to day 1; missing a whole extra
// day restarts the streak). soda/wins = `amount` granted; boost = x2 Soda for `minutes`. `big` = gold tile.
export const DAILY = {
  cooldownMs: 24 * 3600 * 1000,
  rewards: [
    { kind: 'soda', amount: 100 },
    { kind: 'soda', amount: 250 },
    { kind: 'wins', amount: 1000 },
    { kind: 'soda', amount: 600 },
    { kind: 'wins', amount: 3000 },
    { kind: 'boost', minutes: 30 },
    { kind: 'soda', amount: 2500, big: true },
  ],
}
// Click/hold on the world gains soda: equipped item's `gain` (SODA_ITEMS) x treadmill multiplier (SHOP) x rebirth multiplier, at most one gain per `interval` s (1s cooldown, shared by click and hold).
export const SODA_GAIN = { interval: 1 }
// New-player tutorial (tutorial.js; the step is saved with the account by net.js, and the backend's
// constants.ts TUTORIAL_DONE_STEP must equal `steps`). 0 click/hold to shake `clickSoda` soda, 1 run on the x1
// treadmill until `trainSoda`, 2 jump on the Soda Jump pad until the Wins cover the soda, 3 buy `soda` (hold E).
export const DISABLE_TUTORIAL = false
export const TUTORIAL = { steps: 4, clickSoda: 4, trainSoda: 12, soda: 'orange', completeMs: 3500 }
export const levelXp = (level) => 20 + 3 * (level - 1) // xp to clear `level`: 20, 23, 26, ...
// Bottom soda packs: grant `mult` x current soda; price in Wins.
// `price` is the floor (early game); the real price grows with the player's soda: max(price, soda x mult x rate),
// so packs get far more expensive as the player levels / rebirths and their soda total balloons.
export const SODA_PACKS = [
  { mult: 0.5, price: 500, rate: 0.02, color: 'orange' },
  { mult: 1.5, price: 5000, rate: 0.04, color: 'blue' },
  { mult: 3, price: 60000, rate: 0.08, color: 'red' },
  { mult: 7.5, price: 1500000, rate: 0.16, color: 'purple' },
]
export const packPrice = (p, soda) => Math.max(p.price, Math.ceil(soda * p.mult * p.rate))
// Right-side boost passes (one-time, price in Wins). x2 Soda doubles every soda gain; x2 Wins is stored for when Wins are earned.
// Aura window: each aura is bought once with Wins (`price`) and, while equipped (one at a time), multiplies
// every soda gain by `mult`. `hue` tints the icon, `top`/`bot`/`edge` colour the row.
export const AURAS = [
  { id: 'diamond', name: 'Diamond Aura', mult: 2, price: 1000, hue: -50, top: '#48b0ff', bot: '#1a7ae0', edge: '#0b2a6a' },
  { id: 'emerald', name: 'Emerald Aura', mult: 3, price: 5000, hue: -140, top: '#7ed83a', bot: '#2fa82a', edge: '#0e3a10' },
  { id: 'ruby', name: 'Ruby Aura', mult: 5, price: 25000, hue: 130, top: '#ff5a6a', bot: '#d0222e', edge: '#5a0a12' },
  { id: 'rainbow', name: 'Rainbow Aura', mult: 10, price: 100000, hue: 60, top: '#ff70d6', bot: '#8a3cf0', edge: '#3a0a5a', rainbow: true },
  { id: 'golden', name: 'Golden Aura', mult: 25, price: 500000, hue: 90, top: '#ffe04a', bot: '#ffa41a', edge: '#6a3606' },
  { id: 'void', name: 'Void Aura', mult: 50, price: 2500000, hue: 0, top: '#6a4aa8', bot: '#2a1458', edge: '#0c0420' },
  { id: 'fire', name: 'Fire Aura', mult: 75, price: 10000000, hue: 110, top: '#ffb030', bot: '#ff5a1a', edge: '#6a1a06' },
  { id: 'galaxy', name: 'Galaxy Aura', mult: 100, price: 50000000, hue: 0, top: '#b45aff', bot: '#6a1ad0', edge: '#2a0a5a' },
]

export const BOOST_PASSES = [
  { id: 'soda', label: 'x2 Soda', price: 100000 },
  { id: 'wins', label: 'x2 Wins', price: 500000 },
]

// Sound effects (sfx.js, synthesised with Web Audio: no files). Volumes are 0..1 multipliers.
export const SFX = {
  master: 0.7,
  shake: 0.45, // can rattle + slosh on each soda gain
  fizz: 0.22, // carbonation hiss while the Soda Jump can is shaken
  burst: 0.9, // can pop + foam spray
  land: 0.7, // thud when dropping onto the ground (scaled by impact speed)
  wins: 0.5, // coin chime when Wins are gained
  spend: 0.6, // purchase sound when Wins are spent
  ui: 0.35, // button click / hover
  levelUp: 0.6, // level-up fanfare
  claim: 0.6, // daily reward claim
  shakeMinGap: 0.14, // s between rattles (treadmills gain very often)
}
