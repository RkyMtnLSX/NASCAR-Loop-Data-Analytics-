// scripts/loadEngine.js
//
// Loads src/lib/simEngine.js into a plain node process.
//
// WHY THIS FILE EXISTS
// The engine is an ES module living in a Create React App tree. package.json has no
// "type": "module", so node reads any .js here as CommonJS and chokes on `export`.
// Rather than change the app's module format (a real change to what Vercel builds)
// or duplicate the engine into a script-only copy (which would immediately drift
// from the one the site actually runs), this transforms the SAME file in memory,
// ESM -> CJS, and evaluates it.
//
// The point is that scripts read the shipped engine byte for byte. If a backtest
// says the sim does X, the sim on the site does X, because it is the same source.
//
// Uses only @babel/core and one transform plugin, both already installed by
// react-scripts. No new dependency, no build step, no artifact on disk.
//
//   const engine = require('./loadEngine')
//   engine.runRaceSim(drivers, cfg)

const fs = require('fs')
const path = require('path')
const Module = require('module')
const babel = require('@babel/core')

const ENGINE = path.join(__dirname, '..', 'src', 'lib', 'simEngine.js')

function loadEsm(file) {
  const src = fs.readFileSync(file, 'utf8')
  const { code } = babel.transformSync(src, {
    filename: file,
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  })
  const m = new Module(file, null)
  m.filename = file
  m.paths = Module._nodeModulePaths(path.dirname(file))
  m._compile(code, file)
  return m.exports
}

module.exports = loadEsm(ENGINE)
module.exports.__enginePath = ENGINE
module.exports.__engineSha = require('crypto')
  .createHash('sha256')
  .update(fs.readFileSync(ENGINE))
  .digest('hex')
  .slice(0, 12)
