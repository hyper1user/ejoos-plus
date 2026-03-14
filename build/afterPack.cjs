const path = require('path')
const fs = require('fs')

// Fix: lazystream requires readable-stream@2 with passthrough.js at root
// electron-builder hoists readable-stream@3 which doesn't have passthrough.js
// This hook creates shims that re-export from v3 API
exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir

  // Works for both asar (app.asar.unpacked) and non-asar (app) modes
  const candidates = [
    path.join(appOutDir, 'resources', 'app', 'node_modules', 'readable-stream'),
    path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'readable-stream')
  ]

  for (const readableStreamDir of candidates) {
    if (!fs.existsSync(readableStreamDir)) continue

    const shimMap = {
      'passthrough.js': 'PassThrough',
      'duplex.js': 'Duplex',
      'transform.js': 'Transform',
      'writable.js': 'Writable'
    }

    for (const [file, cls] of Object.entries(shimMap)) {
      const filePath = path.join(readableStreamDir, file)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `module.exports = require(".").${cls};\n`, 'utf8')
        console.log(`[afterPack] Created ${file} shim in ${readableStreamDir}`)
      }
    }
  }
}
