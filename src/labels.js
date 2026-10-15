import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'

// Roblox-style BillboardGui text: thick black stroke, chunky rounded font,
// optional vertical gradient fill and a Robux icon. Painted to a canvas and
// shown on a camera-facing sprite anchored at its bottom edge. Every label
// repaints once Fredoka finishes loading so the first frame never waits on it.

const FONT = 'Fredoka, "Arial Rounded MT Bold", sans-serif'
const PAD = 12
const labels = []

// Rounded hexagon with a square hole: the Robux glyph.
function drawRobux(c, x, y, size, color) {
  const r = size / 2
  c.save()
  c.translate(x + r, y)
  c.lineJoin = 'round'
  c.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    c.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92)
  }
  c.closePath()
  c.lineWidth = size * 0.34
  c.strokeStyle = '#000'
  c.stroke()
  c.lineWidth = size * 0.17
  c.strokeStyle = color
  c.stroke()
  c.lineWidth = size * 0.3
  c.strokeStyle = '#000'
  c.strokeRect(-r * 0.24, -r * 0.24, r * 0.48, r * 0.48)
  c.lineWidth = size * 0.14
  c.strokeStyle = color
  c.strokeRect(-r * 0.24, -r * 0.24, r * 0.48, r * 0.48)
  c.restore()
}

function paint(label) {
  const { lines } = label
  const canvas = document.createElement('canvas')
  const c = canvas.getContext('2d')
  const measured = lines.map((l) => {
    c.font = `700 ${l.size}px ${FONT}`
    const icon = l.robux ? l.size * 0.95 : 0
    return { w: c.measureText(l.text).width + icon + (l.robux ? l.size * 0.15 : 0), icon }
  })
  const strokeW = (l) => l.stroke ?? Math.max(6, l.size * 0.16)
  canvas.width = Math.ceil(Math.max(...measured.map((m, i) => m.w + strokeW(lines[i]) * 2)) + PAD * 2)
  canvas.height = Math.ceil(lines.reduce((h, l) => h + l.size * 1.08, 0) + PAD * 2)

  let y = PAD
  lines.forEach((l, i) => {
    const m = measured[i]
    const mid = y + l.size * 0.56
    let x = (canvas.width - m.w) / 2
    if (l.robux) {
      drawRobux(c, x, mid, m.icon, l.robuxColor ?? '#9dff5c')
      x += m.icon + l.size * 0.15
    }
    c.font = `700 ${l.size}px ${FONT}`
    c.textBaseline = 'middle'
    c.textAlign = 'left'
    c.lineJoin = 'round'
    c.lineWidth = strokeW(l)
    c.strokeStyle = l.outline ?? '#000'
    c.strokeText(l.text, x, mid)
    if (Array.isArray(l.fill)) {
      const g = c.createLinearGradient(0, mid - l.size / 2, 0, mid + l.size / 2)
      l.fill.forEach((col, k) => g.addColorStop(k / (l.fill.length - 1), col))
      c.fillStyle = g
    } else {
      c.fillStyle = l.fill ?? '#fff'
    }
    c.fillText(l.text, x, mid)
    y += l.size * 1.08
  })

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  const old = label.sprite.material.map
  label.sprite.material.map = tex
  label.sprite.material.needsUpdate = true
  old?.dispose()
  const ppm = canvas.height / label.height
  label.sprite.scale.set(canvas.width / ppm, label.height, 1)
}

// lines: [{ text, size (px), fill: css colour | [top, ..., bottom], outline, stroke, robux }]
// height: world metres of the whole label. The sprite's origin is its bottom centre.
// onTop: draw over geometry (an "AlwaysOnTop" billboard) so a wide sign is never clipped by what it hangs near.
export function makeLabel(lines, height, { onTop = false } = {}) {
  const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, depthTest: !onTop, fog: false }))
  sprite.center.set(0.5, 0)
  sprite.renderOrder = onTop ? 3 : 2
  const label = { lines, height, sprite }
  labels.push(label)
  paint(label)
  sprite.userData.setLines = (next) => {
    label.lines = next
    paint(label)
  }
  return sprite
}

// Frees a label made by makeLabel (e.g. a remote player's name tag when they leave).
export function disposeLabel(sprite) {
  const i = labels.findIndex((l) => l.sprite === sprite)
  if (i >= 0) labels.splice(i, 1)
  sprite.removeFromParent()
  sprite.material.map?.dispose()
  sprite.material.dispose()
}

// The Google Fonts stylesheet may not have declared Fredoka yet, so also repaint whenever any font finishes loading.
const repaintAll = () => labels.forEach(paint)
document.fonts?.addEventListener?.('loadingdone', repaintAll)
document.fonts?.load(`700 64px Fredoka`).then(repaintAll, () => {})
