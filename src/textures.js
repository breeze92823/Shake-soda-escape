import { BoxGeometry, CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three'

// Procedural Roblox "lego" surfaces: studded plates and checkered studded brick,
// painted once to canvases. Textures tile in world metres, so a box built with
// `studBox` shows the same stud size whatever its dimensions.

const shade = (hex, k) => {
  const c = new Color(hex)
  c.offsetHSL(0, 0, k)
  return `#${c.getHexString()}`
}

// One stud cell: bevelled square plus a raised round stud with a highlight.
function drawStud(c, x, y, s, base, k = 1) {
  c.fillStyle = base
  c.fillRect(x, y, s, s)
  c.fillStyle = shade(base, 0.05 * k)
  c.fillRect(x, y, s, s * 0.06)
  c.fillRect(x, y, s * 0.06, s)
  c.fillStyle = shade(base, -0.06 * k)
  c.fillRect(x, y + s * 0.94, s, s * 0.06)
  c.fillRect(x + s * 0.94, y, s * 0.06, s)
  // Raised rounded-square stud with an L-shaped bevel: light top/left edge, dark bottom/right.
  const m = s * 0.2
  const w = s - m * 2
  const rr = s * 0.1
  const bevel = s * 0.07
  const rect = (rx, ry, rw, rh, fill) => {
    c.fillStyle = fill
    c.beginPath()
    c.roundRect(rx, ry, rw, rh, rr)
    c.fill()
  }
  rect(x + m + bevel * 0.6, y + m + bevel * 0.8, w, w, shade(base, -0.09 * k)) // drop shadow
  rect(x + m, y + m, w, w, shade(base, 0.09 * k)) // lit L
  rect(x + m + bevel, y + m + bevel, w - bevel, w - bevel, shade(base, -0.07 * k)) // shaded L
  rect(x + m + bevel, y + m + bevel, w - bevel * 2, w - bevel * 2, shade(base, 0.01 * k)) // top face
}

function toTexture(canvas, tileMetres) {
  const t = new CanvasTexture(canvas)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  t.userData.tileMetres = tileMetres
  return t
}

const cache = new Map()

// Studded plate in one colour; `stud` = metres per stud, `contrast` scales the stud shading.
export function studTexture(color, stud = 0.5, contrast = 1) {
  const key = `s${color}${stud}${contrast}`
  if (cache.has(key)) return cache.get(key)
  const n = 4
  const s = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = n * s
  const c = canvas.getContext('2d')
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) drawStud(c, i * s, j * s, s, color, contrast)
  const t = toTexture(canvas, n * stud)
  cache.set(key, t)
  return t
}

// Checkered brick: `square` metres per checker, two tones, studs on every cell.
export function checkerTexture(colorA, colorB, square = 3, stud = 0.5) {
  const key = `c${colorA}${colorB}${square}`
  if (cache.has(key)) return cache.get(key)
  const per = Math.round(square / stud)
  const s = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = per * 2 * s
  const c = canvas.getContext('2d')
  for (let qi = 0; qi < 2; qi++) {
    for (let qj = 0; qj < 2; qj++) {
      const col = (qi + qj) % 2 ? colorB : colorA
      for (let i = 0; i < per; i++) for (let j = 0; j < per; j++) drawStud(c, (qi * per + i) * s, (qj * per + j) * s, s, col)
    }
  }
  const t = toTexture(canvas, square * 2)
  cache.set(key, t)
  return t
}

// BoxGeometry whose UVs are in tiles of `tile` metres on every face, so a
// RepeatWrapping texture keeps its real-world scale on boxes of any size.
export function studBox(w, h, d, tile) {
  const g = new BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  // Face order: +x, -x, +y, -y, +z, -z; 4 vertices each.
  const spans = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      uv.setXY(i, (uv.getX(i) * spans[f][0]) / tile, (uv.getY(i) * spans[f][1]) / tile)
    }
  }
  return g
}
