// scripts/loadDfs.js - loads src/pages/DFSPage.js (the product's optimizer exports) into node, the same way
// loadEngine.js loads the sim: the SAME source, transformed in memory (JSX + ESM -> CJS), nothing duplicated.
// React is required for real (the page's hooks are never called here); '../lib/supabase' is stubbed.
const fs = require('fs'), path = require('path'), Module = require('module'), babel = require('@babel/core')
const SRC = path.join(__dirname, '..', 'src')
const cache = {}
function loadFile(file) {
  if (cache[file]) return cache[file].exports
  const src = fs.readFileSync(file, 'utf8')
  const { code } = babel.transformSync(src, { filename: file, babelrc: false, configFile: false, sourceMaps: false,
    presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')] })
  const m = new Module(file, null); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); cache[file] = m
  const origRequire = m.require.bind(m)
  m.require = (id) => {
    if (id.endsWith('/supabase')) return { supabase: {} }
    if (id.startsWith('.')) { let f = path.resolve(path.dirname(file), id); if (!f.endsWith('.js')) f += '.js'; if (f.startsWith(SRC)) return loadFile(f) }
    return origRequire(id)
  }
  m._compile(code, file); m.loaded = true
  return m.exports
}
module.exports = loadFile(path.join(SRC, 'pages', 'DFSPage.js'))
