import { inputState } from './input.js'
import { getYaw, syncYawToPlayer } from './camera.js'
import { GROUND_Y, PHYSICS, PLAYER_DIMS, SPAWN, SPAWN_FACING, STEP_UP, WORLD_BOUNDS } from './config.js'

// The local player singleton, mutated in place. Kinematic capsule stepped once
// per frame: input -> gravity -> integrate -> walls/props -> floor. `floorAt` is the single floor lookup.
export const player = {
  position: { x: 0, y: 0, z: 0 }, // capsule base (feet)
  velocity: { x: 0, y: 0, z: 0 },
  grounded: true,
  facing: Math.PI, // yaw the character model faces, radians
  moveSpeed: PHYSICS.moveSpeed,
  dims: { ...PLAYER_DIMS },
  locked: false, // scripted sequence (launch.js) owns the player: input is ignored
}

export function resetPlayer(spawn = SPAWN, facing = SPAWN_FACING) {
  player.position.x = spawn.x
  player.position.y = spawn.y
  player.position.z = spawn.z
  player.velocity.x = player.velocity.y = player.velocity.z = 0
  player.grounded = true
  player.facing = facing
  player.locked = false
}

export function respawn() {
  resetPlayer()
  syncYawToPlayer()
}

// Solid axis-aligned boxes the world registers: { minX, maxX, minZ, maxZ, top }.
// A box whose top is within STEP_UP of the feet is floor; anything taller is a wall.
const solids = []
export function addSolid(box) {
  solids.push(box)
}

// Highest walkable surface under (x, z) reachable from feet height y.
// Called with no arguments (camera boom) it is the flat ground.
export function floorAt(x, z, y = Infinity) {
  let floor = GROUND_Y
  if (x === undefined) return floor
  for (const b of solids) {
    if (b.top > floor && b.top <= y + STEP_UP && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) floor = b.top
  }
  return floor
}

// Pushes the capsule (circle of radius r in plan) out of every box too tall to step onto.
function collideSolids(p, v, r) {
  for (const b of solids) {
    if (b.top <= p.y + STEP_UP) continue
    const cx = Math.max(b.minX, Math.min(b.maxX, p.x))
    const cz = Math.max(b.minZ, Math.min(b.maxZ, p.z))
    const dx = p.x - cx
    const dz = p.z - cz
    const d2 = dx * dx + dz * dz
    if (d2 >= r * r) continue
    let nx, nz, depth
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2)
      nx = dx / d
      nz = dz / d
      depth = r - d
    } else {
      // Centre inside the box: leave by the nearest side.
      const exits = [
        [b.maxX - p.x, 1, 0],
        [p.x - b.minX, -1, 0],
        [b.maxZ - p.z, 0, 1],
        [p.z - b.minZ, 0, -1],
      ].sort((a, c) => a[0] - c[0])
      ;[depth, nx, nz] = exits[0]
      depth += r
    }
    p.x += nx * depth
    p.z += nz * depth
    const into = v.x * nx + v.z * nz
    if (into < 0) {
      v.x -= into * nx
      v.z -= into * nz
    }
  }
}

const TAU = Math.PI * 2
// Turns angle `from` toward `to` by at most maxDelta, the short way round.
export function rotateTowards(from, to, maxDelta) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  if (Math.abs(diff) <= maxDelta) return to
  return (from + Math.sign(diff) * maxDelta) % TAU
}

// Moves the (x, z) velocity toward the target as one 2D vector so it curves
// straight instead of warping axis-by-axis.
function approach2D(v, targetX, targetZ, maxDelta) {
  const dx = targetX - v.x
  const dz = targetZ - v.z
  const dist = Math.hypot(dx, dz)
  if (dist <= maxDelta || dist === 0) {
    v.x = targetX
    v.z = targetZ
  } else {
    v.x += (dx / dist) * maxDelta
    v.z += (dz / dist) * maxDelta
  }
}

const NO_MOVE = { x: 0, z: 0 }

export function step(dt) {
  if (dt <= 0) return

  // Camera-relative ground basis.
  const yaw = getYaw()
  const fwdX = -Math.sin(yaw)
  const fwdZ = -Math.cos(yaw)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  if (player.locked) inputState.jump = false
  const mv = player.locked ? NO_MOVE : inputState.move
  const len = Math.hypot(mv.x, mv.z)
  const scale = len > 1 ? 1 / len : 1
  const wishX = (fwdX * mv.z + rightX * mv.x) * scale
  const wishZ = (fwdZ * mv.z + rightZ * mv.x) * scale

  // Snappy start, slightly softer stop; both scale with the walk speed.
  const rate = (len > 0.01 ? PHYSICS.accel : PHYSICS.decel) * Math.max(1, player.moveSpeed / PHYSICS.moveSpeed)
  approach2D(player.velocity, wishX * player.moveSpeed, wishZ * player.moveSpeed, rate * dt)

  if (inputState.jump) {
    if (player.grounded) player.velocity.y = PHYSICS.jumpSpeed
    inputState.jump = false
  }
  player.grounded = false

  const p = player.position
  player.velocity.y += PHYSICS.gravity * dt
  p.x += player.velocity.x * dt
  p.y += player.velocity.y * dt
  p.z += player.velocity.z * dt

  const r = player.dims.radius
  p.x = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, p.x))
  p.z = Math.max(WORLD_BOUNDS.minZ + r, Math.min(WORLD_BOUNDS.maxZ - r, p.z))
  collideSolids(p, player.velocity, r)

  const groundY = floorAt(p.x, p.z, p.y)
  if (p.y <= groundY) {
    p.y = groundY
    if (player.velocity.y < 0) player.velocity.y = 0
    player.grounded = true
  }

  if (p.y < PHYSICS.killY) {
    respawn()
    return
  }

  // Turn at a fixed rate toward the heading.
  if (Math.hypot(wishX, wishZ) > 0.05) {
    player.facing = rotateTowards(player.facing, Math.atan2(wishX, wishZ), PHYSICS.turnSpeed * dt)
  }
}
