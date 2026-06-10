import * as XLSX from 'xlsx'

export function parsePracticeExcel(file, series = 'cup') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetNames = workbook.SheetNames
        let sheetName = sheetNames[0]
        const seriesSheetMap = {
          cup:     ['CUP', 'Cup', 'cup'],
          xfinity: ['XFINITY', 'Xfinity', 'xfinity', 'NXS'],
          trucks:  ['TRUCKS', 'Trucks', 'trucks', 'NCWTS'],
        }
        for (const c of (seriesSheetMap[series] || [])) {
          if (sheetNames.includes(c)) { sheetName = c; break }
        }
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })
        if (rows.length < 2) { reject(new Error('No data found in spreadsheet')); return }
        let headerRowIndex = 0
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          if (rows[i].some(c => String(c).toLowerCase() === 'driver')) { headerRowIndex = i; break }
        }
        const headers = rows[headerRowIndex].map(h => String(h || '').trim())
        const driverCol = headers.findIndex(h => h.toLowerCase() === 'driver')
        const startCol  = headers.findIndex(h => h.toLowerCase() === 'start' || h.toLowerCase() === 'spos')
        if (driverCol === -1) { reject(new Error('Could not find Driver column in spreadsheet')); return }
        const lapColumns = []
        headers.forEach((h, i) => {
          const n = parseInt(h)
          if (!isNaN(n) && String(n) === h && n > 0 && n <= 300) { lapColumns.push({ index: i, lapNum: n }); return }
          const m = h.replace(/[_\s]/g, '').match(/^(?:lap|l)(\d+)$/i)
          if (m) { const n2 = parseInt(m[1]); if (n2 > 0 && n2 <= 300) lapColumns.push({ index: i, lapNum: n2 }) }
        })
        if (lapColumns.length === 0) { reject(new Error('Could not find lap time columns in spreadsheet')); return }
        lapColumns.sort((a, b) => a.lapNum - b.lapNum)
        const drivers = []
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i]
          const name = String(row[driverCol] || '').trim()
          if (!name || name === 'undefined') continue
          const start = startCol !== -1 ? parseInt(row[startCol]) || null : null
          const lapData = {}
          for (const { index, lapNum } of lapColumns) {
            const val = row[index]
            if (val != null && val !== '' && val !== '--') {
              const t = parseFloat(val)
              if (!isNaN(t) && t > 10 && t < 120) lapData[String(lapNum)] = t
            }
          }
          if (Object.keys(lapData).length > 0) drivers.push({ driver: name, start, lapData })
        }
        if (drivers.length === 0) { reject(new Error('No valid driver data found in spreadsheet')); return }
        resolve({ drivers, sheetName, totalDrivers: drivers.length })
      } catch (err) { reject(new Error('Failed to parse spreadsheet: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}