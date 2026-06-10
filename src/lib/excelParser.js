import * as XLSX from 'xlsx'

// Parse uploaded practice Excel file into driver lap data
// Expected format: columns for Driver, Start, then lap numbers (1, 2, 3...)
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

        const candidates = seriesSheetMap[series] || []
        for (const candidate of candidates) {
          if (sheetNames.includes(candidate)) { sheetName = candidate; break }
        }

        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (rows.length < 2) { reject(new Error('No data found in spreadsheet')); return }

        let headerRowIndex = 0
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          if (rows[i].some(cell => String(cell).toLowerCase() === 'driver')) {
            headerRowIndex = i; break
          }
        }

        const headers = rows[headerRowIndex].map(h => String(h || '').trim())
        const driverColIndex = headers.findIndex(h => h.toLowerCase() === 'driver')
        const startColIndex  = headers.findIndex(h => h.toLowerCase() === 'start' || h.toLowerCase() === 'spos')

        if (driverColIndex === -1) { reject(new Error('Could not find Driver column in spreadsheet')); return }

        // Accept: "1", "Lap 1", "LAP1", "L1", "lap_1"
        const lapColumns = []
        headers.forEach((h, i) => {
          const direct = parseInt(h)
          if (!isNaN(direct) && String(direct) === h && direct > 0 && direct <= 300) {
            lapColumns.push({ index: i, lapNum: direct }); return
          }
          const match = h.replace(/[_\s]/g, '').match(/^(?:lap|l)(\d+)$/i)
          if (match) {
            const num = parseInt(match[1])
            if (num > 0 && num <= 300) lapColumns.push({ index: i, lapNum: num })
          }
        })

        if (lapColumns.length === 0) { reject(new Error('Could not find lap time columns in spreadsheet')); return }

        lapColumns.sort((a, b) => a.lapNum - b.lapNum)

        const drivers = []
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i]
          const driverName = String(row[driverColIndex] || '').trim()
          if (!driverName || driverName === 'undefined') continue

          const startPos = startColIndex !== -1 ? parseInt(row[startColIndex]) || null : null

          const lapData = {}
          for (const { index, lapNum } of lapColumns) {
            const val = row[index]
            if (val !== undefined && val !== null && val !== '' && val !== '--') {
              const time = parseFloat(val)
              if (!isNaN(time) && time > 10 && time < 120) {
                lapData[String(lapNum)] = time
              }
            }
          }

          if (Object.keys(lapData).length > 0) {
            drivers.push({ driver: driverName, start: startPos, lapData })
          }
        }

        if (drivers.length === 0) { reject(new Error('No valid driver data found in spreadsheet')); return }

        resolve({ drivers, sheetName, totalDrivers: drivers.length })

      } catch (err) {
        reject(new Error('Failed to parse spreadsheet: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}
