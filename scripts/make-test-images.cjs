/**
 * 生成上传测试用 PNG（无第三方依赖，Node 内置 zlib 手写 PNG 编码）。
 * 用途：验证「站点设置 → 品牌图片上传」的尺寸提示与自动压缩逻辑。
 *  - 宽图 1200×800：触发「非 1:1 方图，已居中裁切」提示
 *  - 小图 16×16：触发「尺寸偏小」提示
 *  - 方图 300×300：触发「尺寸符合规范」（但小于建议 512，用于观察压缩）
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

/** 画一张带对角渐变 + 中心方块的 RGB 图，便于肉眼确认裁切方向。 */
function makePng(w, h, file) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3
      const cx = Math.min(x, w - 1 - x) / w
      const cy = Math.min(y, h - 1 - y) / h
      const edge = Math.min(cx, cy) < 0.12 ? 28 : 0 // 描边，便于看出裁切
      raw[i] = 40 + Math.round((255 * x) / w) - edge
      raw[i + 1] = 90 + Math.round((255 * y) / h) - edge
      raw[i + 2] = 220 - Math.round((160 * x) / w) - edge
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.writeFileSync(file, png)
  return { file: path.basename(file), size: png.length, w, h }
}

const outDir = path.join(__dirname, '..', '.dev', 'test-images')
fs.mkdirSync(outDir, { recursive: true })
const results = [
  makePng(1200, 800, path.join(outDir, 'shot-wide-1200x800.png')),
  makePng(16, 16, path.join(outDir, 'shot-tiny-16x16.png')),
  makePng(300, 300, path.join(outDir, 'shot-square-300x300.png')),
]
for (const r of results) console.log(`${r.file}  ${r.w}×${r.h}  ${(r.size / 1024).toFixed(1)}KB`)
