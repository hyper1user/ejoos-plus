/**
 * Fix: readable-stream@3 doesn't export passthrough.js etc at root level,
 * but lazystream (used by exceljs → archiver) requires them.
 * Creates shim files in node_modules/readable-stream/ BEFORE ASAR packing
 * so they are included in the archive.
 */
const path = require('path')
const fs = require('fs')

const readableStreamDir = path.join(__dirname, '..', 'node_modules', 'readable-stream')

if (!fs.existsSync(readableStreamDir)) {
  console.warn('[fix-readable-stream] readable-stream not found, skipping')
  process.exit(0)
}

const shimMap = {
  'passthrough.js': 'PassThrough',
  'duplex.js': 'Duplex',
  'transform.js': 'Transform',
  'writable.js': 'Writable'
}

let created = 0
for (const [file, cls] of Object.entries(shimMap)) {
  const filePath = path.join(readableStreamDir, file)
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `module.exports = require(".").${cls};\n`, 'utf8')
    console.log(`[fix-readable-stream] Created ${file}`)
    created++
  }
}

if (created === 0) {
  console.log('[fix-readable-stream] All shims already exist')
} else {
  console.log(`[fix-readable-stream] Created ${created} shims`)
}
