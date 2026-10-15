// The cola can every player holds. Parented to the right hand of whichever rig
// is in use (player.glb's ArmR2_leaf, or the end of the procedural arm's ArmR1),
// so it follows every animation. Its orientation is recomputed each frame in
// character space so it always stays upright whatever the forearm is doing.
import { Box3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { ANIM, DEFAULT_SODA } from '../config.js'
import { sodaItem } from '../sodaItems.js'
import { state } from '../state.js'

const H = ANIM.hold
const PROCEDURAL_HAND_Y = -2.4 // ArmR1 -> end of its box arm (rig units)

let shared = null
function sharedParts() {
  return (shared ||= {
    body: new CylinderGeometry(H.canRadius, H.canRadius, H.canHeight, 20),
    label: new CylinderGeometry(H.canRadius * 1.02, H.canRadius * 1.02, H.canHeight * 0.3, 20),
    rim: new CylinderGeometry(H.canRadius * 0.88, H.canRadius, H.canHeight * 0.06, 20),
    tab: new CylinderGeometry(H.canRadius * 0.18, H.canRadius * 0.18, H.canHeight * 0.02, 10),
    red: new MeshStandardMaterial({ color: 0xd92b2b, roughness: 0.35, metalness: 0.5 }),
    white: new MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.5, metalness: 0.1 }),
    metal: new MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.25, metalness: 0.9 }),
  })
}

// The plain red cola can (shared geometry/materials, never disposed).
function buildCan() {
  const p = sharedParts()
  const can = new Group()
  const add = (geo, mat, y) => {
    const m = new Mesh(geo, mat)
    m.position.y = y
    m.castShadow = true
    can.add(m)
    return m
  }
  const top = H.canHeight / 2
  add(p.body, p.red, 0)
  add(p.label, p.white, 0)
  add(p.rim, p.metal, top + H.canHeight * 0.03)
  add(p.rim, p.metal, -top - H.canHeight * 0.03).rotation.x = Math.PI
  add(p.tab, p.metal, top + H.canHeight * 0.07)
  return can
}

const MAX_ITEM_HEIGHT = H.canHeight * 1.1
const box = new Box3()
const size = new Vector3()
const centre = new Vector3()

// Any other soda from the display: centred on the can's origin, shrunk if taller than a can.
function buildItem(kind) {
  const item = sodaItem(kind)
  box.setFromObject(item)
  box.getSize(size)
  box.getCenter(centre)
  const wrap = new Group()
  item.position.sub(centre)
  wrap.add(item)
  wrap.scale.setScalar(Math.min(1, MAX_ITEM_HEIGHT / size.y))
  return wrap
}

function disposeModel(model) {
  model.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.dispose()
    o.material.map?.dispose()
    o.material.dispose()
  })
}

export class HeldCan {
  constructor(root) {
    this.root = root
    this.mode = 'right'
    const n = root.nodes || {}
    this.anchor = n.ArmR2_leaf || n.ArmR1 || null
    this.base = n.ArmR2_leaf ? new Vector3() : new Vector3(0, PROCEDURAL_HAND_Y, 0)
    this.can = new Group() // the holder; its child is the equipped soda's model
    this.can.name = 'held_can'
    this.kind = null
    this.model = null
    this.fixedKind = null // a remote player's can (net.js); null = follow the local player's state.equipped
    this.setItem(state.equipped)
    this.anchor?.add(this.can)
    this.qa = new Quaternion()
    this.qr = new Quaternion()
    this.offset = new Vector3()
  }

  // Swap the model in hand for another soda (the plain cola can is the default).
  setItem(kind) {
    if (kind === this.kind) return
    this.kind = kind
    if (this.model) {
      this.can.remove(this.model)
      if (!this.model.userData.shared) disposeModel(this.model)
    }
    this.model = kind === DEFAULT_SODA ? buildCan() : buildItem(kind)
    this.model.userData.shared = kind === DEFAULT_SODA
    this.can.add(this.model)
  }

  // 'right' = in the right fist (default), 'both' = held in front of the chest with both hands
  // (launch sequence), 'hidden' = burst.
  setMode(mode) {
    if (mode === this.mode) return
    this.mode = mode
    this.can.visible = mode !== 'hidden'
    const parent = mode === 'both' ? this.root : this.anchor
    if (parent && this.can.parent !== parent) parent.add(this.can)
    if (mode === 'right') {
      this.can.rotation.set(0, 0, 0)
      this.can.scale.setScalar(1)
    }
  }

  // Two-handed pose in character space: grab 0..1 lifts it in, x/y offsets and tilt/roll are the shake.
  setTwoHand(grab, y, x, tilt, roll) {
    const T = ANIM.twoHand
    this.can.position.set(x * grab, T.canY - (1 - grab) * 1.1 + y, T.canZ * (0.6 + 0.4 * grab))
    this.can.rotation.set(tilt, 0, roll)
  }

  // Call after the pose is applied to the bones.
  update() {
    this.setItem(this.fixedKind ?? state.equipped)
    if (this.mode === 'both' || this.mode === 'hidden') return
    if (!this.anchor) return
    // Anchor orientation relative to the character root.
    this.anchor.getWorldQuaternion(this.qa)
    this.root.getWorldQuaternion(this.qr).invert()
    const rel = this.qr.multiply(this.qa) // root-space orientation of the anchor
    const inv = this.qa.copy(rel).invert() // root space -> anchor space
    this.can.quaternion.copy(inv) // upright in character space
    // Sit the can just in front of (and slightly above) the fist, in character space.
    this.offset.set(0, H.canLift, H.canForward).applyQuaternion(inv).add(this.base)
    this.can.position.copy(this.offset)
  }

  dispose() {
    this.can.removeFromParent()
    if (this.model && !this.model.userData.shared) disposeModel(this.model)
  }
}
