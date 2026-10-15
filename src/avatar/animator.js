// Procedural locomotion animator, ported from +1 Cut Grass Adventure's
// PlayerAnimator + LocomotionCycle. States idle / run / airborne / landing are
// blended through pose buffers; the walk and run are ONE cycle at two depths,
// its phase advancing with distance travelled so the feet stay planted at any
// speed. Writes only to bones and
// the avatar root's rotation / position.y (the player group owns world placement).
import { ANIM, LAUNCH } from '../config.js'
import { HeldCan } from './heldCan.js'
import { BONE_INDEX, PlayerRig, PoseBuffer } from './rig.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)
const smoothstep = (e0, e1, v) => ease(clamp((v - e0) / (e1 - e0 || 1), 0, 1))
const kneeCurve = (phase) => {
  const raw = Math.sin(phase - Math.PI / 2.6)
  return raw > 0 ? raw * raw : 0
}

const L = ANIM.locomotion
const HOLD = ANIM.hold

export function makeAnimator(root) {
  if (!root) return null
  return new PlayerAnimator(root)
}

export function disposeAnimator(animator) {
  animator?.dispose()
}

class PlayerAnimator {
  constructor(root) {
    this.root = root
    this.rig = new PlayerRig(root)
    this.target = new PoseBuffer()
    this.from = new PoseBuffer()
    this.output = new PoseBuffer()
    this.layer = new PoseBuffer()
    this.scratch = new PoseBuffer()
    this.state = 'idle'
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = 0
    this.phase = 0
    this.idleTime = 0
    this.airTime = 0
    this.bank = 0
    this.hasElbow = !!root.nodes?.ArmR2
    this.heldCan = new HeldCan(root)
    this.shakeLeft = 0 // s of one-hand shake remaining
    this.shakeTime = 0
  }

  // Pump the can in the right hand (soda gain); restarting mid-shake keeps the phase so it stays smooth.
  shake() {
    this.shakeLeft = HOLD.shake.duration
  }

  dispose() {
    this.heldCan.dispose()
    this.rig.resetToBindPose()
    this.root.rotation.set(0, 0, 0)
    this.root.position.y = 0
  }

  // input: { grounded, speed, verticalVelocity, turn (-1..1), }
  update(dt, input) {
    if (!(dt > 0)) return
    this.stateTime += dt
    this.resolveState(dt, input)
    this.writePose(dt, input)
    this.blend(dt)
    this.shakeLeft = Math.max(0, this.shakeLeft - dt)
    this.shakeTime += dt
    this.applyHold(input.launch)
    this.rig.applyPose(this.output)
    this.applyVisual(dt, input)
    this.heldCan.update()
  }

  // Right arm always holds the can. Layered over the blended output so every state
  // (and every blend between states) keeps the grip, with a damped share of the
  // arm's own motion so walking, jumping and landing still read.
  applyHold(launch) {
    if (launch?.canGone) return this.heldCan.setMode('hidden')
    if (launch?.hold) return this.applyTwoHand(launch)
    this.heldCan.setMode('right')
    const o = this.output.rotations
    const a = BONE_INDEX.ArmR1 * 3
    const e = BONE_INDEX.ArmR2 * 3
    const f = HOLD.follow
    const x = this.hasElbow ? HOLD.upperArm.x : HOLD.upperArmNoElbow
    o[a] = x + o[a] * f
    o[a + 1] = o[a + 1] * f
    o[a + 2] = HOLD.upperArm.z + o[a + 2] * f
    o[e] = HOLD.elbow + o[e] * f
    o[e + 1] = 0
    o[e + 2] = 0
    if (this.shakeLeft > 0) {
      const S = HOLD.shake
      const k = this.shakeLeft / S.duration // fades out
      const w = Math.sin(this.shakeTime * S.hz * Math.PI * 2) * k
      o[a] += S.upper * w * (this.hasElbow ? 1 : 0.6)
      o[a + 2] += S.roll * w
      o[e] += S.elbow * w
    }
  }

  // Soda Jump: both hands on the can, then the shake. Blends from the current (idle) pose by
  // `grab`, and the shake rides on top, scaled by its intensity.
  applyTwoHand({ grab: w, intensity: k, shakePhase, charge }) {
    const T = ANIM.twoHand
    const o = this.output.rotations
    const s = Math.sin(shakePhase)
    const blend = (bone, axis, value) => {
      const i = BONE_INDEX[bone] * 3 + axis
      o[i] = lerp(o[i], value, w)
    }
    const upper = T.arms.upper + T.shakeUpper * k * s
    const elbow = T.arms.elbow + T.shakeElbow * k * s
    const upperX = this.hasElbow ? upper : upper * 0.9
    blend('ArmL1', 0, upperX)
    blend('ArmR1', 0, upperX)
    blend('ArmL1', 1, 0)
    blend('ArmR1', 1, 0)
    blend('ArmL1', 2, -T.arms.roll) // left outward is +Z, so inward is negative
    blend('ArmR1', 2, T.arms.roll)
    blend('ArmL2', 0, elbow)
    blend('ArmR2', 0, elbow)
    blend('Spine1', 0, T.lean + 0.04 * k * s)
    this.heldCan.setMode('both')
    this.heldCan.can.scale.setScalar(1 + LAUNCH.fx.canBulge * charge)
    this.heldCan.setTwoHand(w,-T.canBob * k * s, Math.sin(shakePhase * 2.3) * 0.12 * k, T.canTilt * 0.5 * k * s, Math.sin(shakePhase * 1.3) * 0.15 * k)
  }

  resolveState(dt, input) {
    if (!input.grounded) {
      // Ignore the few frames of a step down a ledge; only a real drop is airborne.
      this.airTime += dt
      if (this.airTime > ANIM.airborneDelay) this.setState('airborne', ANIM.transitions.toAirborne)
      return
    }
    this.airTime = 0
    if (this.state === 'airborne') {
      this.setState('landing', ANIM.transitions.toLanding)
      return
    }
    if (this.state === 'landing' && this.stateTime < ANIM.landing.duration) return
    this.setState(input.speed < L.idleSpeed ? 'idle' : 'run', ANIM.transitions.toLocomotion)
  }

  setState(next, duration) {
    if (next === this.state) return
    this.from.copyFrom(this.output)
    this.state = next
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = duration
  }

  writePose(dt, input) {
    const t = this.target
    switch (this.state) {
      case 'idle': {
        // Ease the stride back to a neutral standing phase.
        const goal = this.phase > Math.PI ? TAU : 0
        this.phase += (goal - this.phase) * (1 - Math.exp(-8 * dt))
        if (this.phase >= TAU - 1e-4) this.phase = 0
        this.idleTime += dt
        const breath = Math.sin(this.idleTime * ANIM.idle.breathFrequency * TAU)
        t.applyDefinition(ANIM.idle.basePose)
        t.add('Spine1', breath * ANIM.idle.breathAmount)
        t.add('Neck1', -breath * ANIM.idle.breathAmount * 0.6)
        t.bobY = breath * ANIM.idle.breathBob
        break
      }
      case 'run': {
        const frequency = clamp(input.speed / L.strideDistance, L.minFrequency, L.maxFrequency)
        this.phase = (this.phase + frequency * TAU * dt) % TAU
        this.writeLocomotion(t, input.speed)
        break
      }
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / ANIM.airborne.velocityReference, -1, 1)
        t.applyDefinition(ANIM.airborne.fall)
        this.scratch.applyDefinition(ANIM.airborne.rise)
        t.lerpBetween(t, this.scratch, clamp(0.5 + rising * 0.5, 0, 1))
        t.bobY = 0
        break
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / ANIM.landing.duration, 0, 1))
        t.applyDefinition(ANIM.landing.pose, depth)
        t.bobY = ANIM.landing.bobY * depth
        break
      }
    }
  }

  // One cycle at two depths (walk -> run), derived from actual speed.
  writeLocomotion(out, speed) {
    const run = smoothstep(L.walkSpeed, L.runSpeed, speed)
    const sprint = smoothstep(L.runSpeed, L.sprintSpeed, speed) * 0.4
    const depth = (d) => lerp(lerp(d.walk, d.run, run), d.sprint, sprint)
    const phase = this.phase
    const swing = Math.sin(phase)
    const opposite = -swing
    const hip = depth(L.hipSwing)
    const knee = depth(L.kneeBend)
    const arm = depth(L.armSwing)
    const elbow = depth(L.elbowBend)
    const twist = depth(L.torsoTwist)
    const lean = depth(L.torsoLean)
    const headTwist = depth(L.headCounterTwist)
    const roll = depth(L.torsoRoll)
    const bob = depth(L.bob)

    out.reset()
    // Thighs half a cycle apart; the stride is pushed back more than forward at speed.
    const back = 1 + sprint * 0.35
    out.set('LegL1', hip * (swing > 0 ? swing : swing * back))
    out.set('LegR1', hip * (opposite > 0 ? opposite : opposite * back))
    out.set('LegL2', knee * kneeCurve(phase))
    out.set('LegR2', knee * kneeCurve(phase + Math.PI))
    // Arms counter-swing against the leg on the same side.
    out.set('ArmL1', arm * opposite - sprint * 0.25, 0, sprint * 0.12)
    out.set('ArmR1', arm * swing - sprint * 0.25, 0, -sprint * 0.12)
    out.set('ArmL2', elbow + elbow * 0.35 * Math.max(0, opposite))
    out.set('ArmR2', elbow + elbow * 0.35 * Math.max(0, swing))
    // Torso leans in, twists with the stride and rolls on the footfall.
    out.set('Spine1', lean, twist * opposite, roll * Math.sin(phase * 2))
    out.set('Spine2', lean * 0.4, twist * 0.5 * opposite, 0)
    out.set('Neck1', -lean * 0.7, headTwist * swing, 0)
    out.bobY = -bob * Math.cos(phase * 2)
  }

  blend(dt) {
    if (this.blendDuration > 0) {
      this.blendTime += dt
      const t = clamp(this.blendTime / this.blendDuration, 0, 1)
      this.output.lerpBetween(this.from, this.target, ease(t))
      if (t >= 1) this.blendDuration = 0
    } else {
      this.output.copyFrom(this.target)
    }
  }

  applyVisual(dt, input) {
    const wantBank = this.state === 'run' ? -input.turn * L.bankAngle * 0.6 : 0
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-L.bankRate * dt))
    this.root.rotation.set(0, 0, this.bank)
    this.root.position.y = this.output.bobY
  }
}
