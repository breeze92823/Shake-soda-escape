// Every tunable constant lives here. Look/feel values match Clean Leaves for Loot.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'shake-soda-escape' // slug registered on bloxity.io
export const GAME_TITLE = 'Shake Soda Escape'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

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
export const TOWER = { x: 0, z: -25, size: 9, segmentHeight: 7, segments: 24, labelStep: 20 }
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
// "Press E" interactions (interact.js): hold E this long to confirm; pads trigger within `range` m.
export const INTERACT = { holdMs: 2000, padRange: 1.8, padHeight: 1.5 }
// Soda multiplier treadmills along the west wall on a low red platform (ramp = 0:
// square ends); x1 (south) ... x32 (north) centred on gateX at gateZ.
export const SHOP = { minX: -26, maxX: -14, minZ: -31, maxZ: 15, top: 0.4, ramp: 0, gateX: -20.5, gateZ: [8, 2, -4, -10, -16, -22],
  // Standing on a belt (length x width m around gate) multiplies each gain by `mults[i]` (x1..x32);
  // belt i needs `rebirths[i]` rebirths (as on its sign).
  belt: { length: 10, width: 4.4 }, mults: [1, 2, 4, 8, 16, 32], rebirths: [0, 3, 4, 5, 6, 7] }
// South wall: two leaderboards (board centre x) and the FREE chest between them.
export const SOUTH = { boardZ: 21.3, topSodaX: 8, topRebirthsX: -6, chest: { x: 1, z: 17 } }
export const STEP_UP = 0.6 // m the player walks up onto without jumping

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
  height: 20, // m gained above the pad at the minimum launch; launch speed is derived from PHYSICS.gravity
  maxHeight: 60, // m of real rise at the Summit: the rest of the climb is only shown by the sky (SPACE)
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
// A launch's peak (in "studs") = the soda total, at least `baseStuds`, capped by the equipped soda:
// cap = summit * min(1, gain / summitGain), so only a +30K soda (Gold Trophy) or better reaches the Summit.
// The player really rises only LAUNCH.height..maxHeight m; the altitude is virtual and drives the sky.
export const SPACE = {
  summit: 20000, // studs, fixed top
  summitGain: 30000, // equipped soda gain that unlocks the Summit
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
  bannerAt: 5500, // altitude that shows "OUTER SPACE!"
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
  far: 600,
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
// for the next one (rebirth 4: x3.0, Level 50). Rebirthing resets the level to 1; Skip keeps it.
export const REBIRTH = { multStep: 0.5, levelBase: 10, levelStep: 10, skipPrice: 25000 } // skipPrice in Wins
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
export const levelXp = (level) => 20 + 3 * (level - 1) // xp to clear `level`: 20, 23, 26, ...
// Bottom soda packs: grant `mult` x current soda; price in Wins.
export const SODA_PACKS = [
  { mult: 0.5, price: 1000, color: 'orange' },
  { mult: 1.5, price: 5000, color: 'blue' },
  { mult: 3, price: 25000, color: 'red' },
  { mult: 7.5, price: 150000, color: 'purple' },
]
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
