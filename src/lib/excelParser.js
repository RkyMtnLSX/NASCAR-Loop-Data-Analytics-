import * as XLSX from 'xlsx'

// Parse uploaded practice Excel file into driver lap data
// Expected format: Driver, Start, then lap columns. Headers may be bare numbers (1,2,3),
// or lap-prefixed in any case (LAP 1 / Lap 1 / lap 1 / Lap #1). Columns may run ascending OR
// descending (e.g. LAP 30..LAP 1) - laps are keyed by their header number, then sorted.
export function parsePracticeExcel(file, series = 'cup') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetNames = workbook.SheetNames
        let sheetName = sheetNames[0]
        // case-insensitive substring aliases (2026-07-16): sheets are named by broadcasters, not by us.
        // 'NOAPS' = NASCAR O'Reilly Auto Parts Series (the alias that broke Darlington oreilly backfill).
        const seriesSheetMap = {
          cup:     ['cup'],
          oreilly: ['oreilly', "o'reilly", 'noaps', 'nxs', 'xfinity', 'final practice'],
          xfinity: ['xfinity', 'nxs', 'noaps'],
          trucks:  ['truck', 'ncwts', 'craftsman'],
        }
        const candidates = seriesSheetMap[series] || []
        for (const candidate of candidates) {
          const hit = sheetNames.find(function (n) { return String(n).toLowerCase().indexOf(candidate) !== -1 })
          if (hit) { sheetName = hit; break }
        }
        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        if (rows.length < 2) { reject(new Error('No data found in spreadsheet')); return }
        let headerRowIndex = 0
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          if (rows[i].some(cell => String(cell).toLowerCase() === 'driver')) { headerRowIndex = i; break }
        }
        const headers = rows[headerRowIndex].map(h => String(h || '').trim())
        const driverColIndex = headers.findIndex(h => h.toLowerCase() === 'driver')
        const startColIndex  = headers.findIndex(h => h.toLowerCase() === 'start' || h.toLowerCase() === 'spos' || h.toLowerCase() === 'pos')
        const carColIndex     = headers.findIndex(h => { const l = h.toLowerCase(); return l === 'car' || l === 'car #' || l === 'car#' || l === '#' })
        if (driverColIndex === -1) { reject(new Error('Could not find Driver column')); return }
        // Find lap columns. Header may be plain numeric ('1','2') or lap-prefixed in ANY case
        const lapColumns = []
        headers.forEach((h, i) => {
          let num = parseInt(h)
          if (isNaN(num)) {
            const m = h.match(/^lap\s*#?\s*(\d+)$/i)
            if (m) num = parseInt(m[1])
          }
          if (!isNaN(num) && num > 0 && num <= 100) lapColumns.push({ index: i, lapNum: num })
        })
        lapColumns.sort(function (a, b) { return a.lapNum - b.lapNum })
        if (lapColumns.length === 0) { reject(new Error('Could not find lap time columns')); return }
        const drivers = []
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i]
          const driverName = String(row[driverColIndex] || '').trim()
          if (!driverName) continue
          const startPos = startColIndex !== -1 ? parseInt(row[startColIndex]) || null : null
          const carNumber  = carColIndex !== -1 ? String(row[carColIndex] || '').trim() : null
          const lapData = {}
          for (const { index, lapNum } of lapColumns) {
            const val = row[index]
            if (val !== undefined && val !== null && val !== '' && val !== '--') {
              const time = parseFloat(val)
              // Accept 10-500s: covers short tracks (~28s) through road courses (~180s)
              if (!isNaN(time) && time > 10 && time < 500) lapData[String(lapNum)] = time
            }
          }
          if (Object.keys(lapData).length > 0) drivers.push({ driver: driverName, carNumber, start: startPos, lapData })
        }
        if (drivers.length === 0) { reject(new Error('No valid driver data found')); return }
        resolve({ drivers, sheetName, totalDrivers: drivers.length })
      } catch (err) {
        reject(new Error('Failed to parse spreadsheet: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}
