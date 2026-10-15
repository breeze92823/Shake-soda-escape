import { BoxGeometry, Group, Mesh } from 'three'
import { WORLD_SODAS } from './config.js'
import { addZone } from './interact.js'
import { makeLabel } from './labels.js'
import { sodaItem } from './sodaItems.js'
import { notify, sodaStatus, state, subscribe } from './state.js'
import { short } from './hud.js'
import { brick, buildShop, flat, solid } from './lobby.js'

// The shop of a themed world: the lobby's six soda treadmills (west, same layout so the belt logic in state.js
// works unchanged) in the world's colours, and a shelf of the world's own sodas (east, WORLD_SODAS) -- hold E on a
// pad to buy (Wins) or equip. Returns update(time, dt).
const SHELF = { minX: 15, maxX: 26, minZ: -12, maxZ: 10, top: 0.5, itemX: 20, z: [-7.5, -1, 5.5] }

export function buildWorldShop(group, def) {
  const { top: platTop, bot, edge } = { top: def.card.top, bot: def.card.bot, edge: def.card.edge }
  const updateBelts = buildShop(group, { platform: bot, trimColor: platTop })

  const { minX, maxX, minZ, maxZ, top, itemX, z } = SHELF
  // A 0.5 m platform is within STEP_UP, so it needs no ramp.
  group.add(brick(maxX - minX, top, maxZ - minZ, bot, (minX + maxX) / 2, 0, (minZ + maxZ) / 2))
  solid(minX, maxX, minZ, maxZ, top)
  group.add(brick(0.35, 0.14, maxZ - minZ + 0.7, platTop, minX - 0.17, 0, (minZ + maxZ) / 2, { studs: false, collide: false }))
  for (const bz of [minZ - 0.17, maxZ + 0.17]) group.add(brick(maxX - minX + 0.35, 0.14, 0.35, platTop, (minX + maxX) / 2 - 0.17, 0, bz, { studs: false, collide: false }))

  const title = makeLabel(
    [
      { text: `${def.short} Shop`, size: 66, fill: ['#ffffff', platTop] },
      { text: 'Hold E to buy with Wins', size: 38, fill: '#ffe21a' },
    ],
    1.6,
  )
  title.position.set(23.5, 5.2, (minZ + maxZ) / 2)
  group.add(title)

  const items = []
  const signs = []
  WORLD_SODAS[def.id].forEach(({ kind, name, reward, price }, i) => {
    const pz = z[i]
    const pad = new Mesh(new BoxGeometry(2.6, 0.08, 2.6), flat(platTop, { emissive: edge }))
    pad.position.set(itemX, top + 0.04, pz)
    pad.receiveShadow = true
    group.add(pad)
    const item = sodaItem(kind)
    item.scale.setScalar(1.3)
    item.position.set(itemX, top, pz)
    item.userData.baseY = top + 0.08
    item.userData.phase = i * 1.7
    group.add(item)
    items.push(item)

    const signLines = () => {
      const status = sodaStatus(kind)
      const last = {
        equipped: { text: 'EQUIPPED', size: 46, fill: ['#e4ff5a', '#7dff2a'], outline: '#0b5a12', stroke: 12 },
        owned: { text: 'OWNED', size: 46, outline: '#0c3fa8', stroke: 12 },
        next: { text: `${short(price)} Wins`, size: 46, fill: '#ffe21a', stroke: 12 },
        locked: { text: 'LOCKED', size: 46, stroke: 12 },
      }[status]
      return [{ text: name, size: 38 }, { text: reward, size: 38 }, last]
    }
    const sign = makeLabel(signLines(), 1.2)
    sign.position.set(itemX, top + 2.1, pz)
    group.add(sign)
    signs.push({ kind, sign, signLines, status: sodaStatus(kind) })

    addZone({
      key: `soda:${kind}`,
      x: itemX,
      y: top,
      z: pz,
      prompt: () => {
        const status = sodaStatus(kind)
        if (status === 'equipped') return { text: `${name} equipped`, hold: false }
        if (status === 'owned') return { text: `Equip ${name}`, hold: true }
        if (status === 'locked') return { text: 'Locked - unlock the previous soda first', hold: false }
        return state.wins >= price ? { text: `Buy ${name} - ${short(price)} Wins`, hold: true } : { text: `Need ${short(price)} Wins`, hold: false }
      },
      run: () => {
        const bought = sodaStatus(kind) === 'next'
        if (bought) {
          if (state.wins < price) return `Need ${short(price)} Wins`
          state.wins -= price
          state.owned.add(kind)
        }
        state.equipped = kind
        notify()
        return bought ? `${name} unlocked & equipped!` : `${name} equipped!`
      },
    })
  })
  subscribe(() => {
    for (const s of signs) {
      const status = sodaStatus(s.kind)
      if (status === s.status) continue
      s.status = status
      s.sign.userData.setLines(s.signLines())
    }
  })

  return (t, dt) => {
    updateBelts(t, dt)
    for (const it of items) {
      const p = it.userData.phase
      it.rotation.set(Math.sin(t * 1.3 + p) * 0.1, Math.sin(t * 0.7 + p) * 0.5, Math.cos(t * 1.1 + p) * 0.14)
      it.position.y = it.userData.baseY + 0.12 + Math.sin(t * 2 + p) * 0.08
    }
  }
}
