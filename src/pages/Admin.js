import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { parsePracticeExcel } from '../lib/excelParser'
import { gradePracticeSession } from '../lib/practiceGrader'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD

const SERIES_OPTIONS = [
  { value: 'cup', label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks', label: 'Truck Series' },
]

const ALL_YEARS = [2022, 2023, 2024, 2025, 2026]

// ── Load New Race ─────────────────────────────────────────────────────────────
const SERIES_RR_CODES = { cup: 'W', oreilly: 'B', trucks: 'C' }

function LoadNewRace() {
  const [series, setSeries]           = useState('cup')
  const [year, setYear]               = useState(new Date().getFullYear())
  const [raceNumber, setRaceNumber]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [log, setLog]                 = useState([])
  const [result, setResult]           = useState(null)

  const raceNumPadded = String(raceNumber || '').padStart(2, '0')
  const previewUrl = raceNumber
    ? `https://www.racing-reference.info/loopdata/${year}-${raceNumPadded}/${SERIES_RR_CODES[series]}`
    : ''

  function addLog(msg) {
    setLog(prev => [...prev, msg])
  }

  async function handleLoad() {
    if (!raceNumber) return
    setLoading(true)
    setLog([`Fetching: ${previewUrl}`])
    setResult(null)
    try {
      const resp = await fetch('/api/load-race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year), raceNumber: parseInt(raceNumber), series }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        addLog(`✗ ${data.error || 'Unknown error'}`)
        if (data.message) addLog(`  ${data.message}`)
        setResult({ type: 'error', message: data.error || 'Failed' })
      } else {
        addLog(`✓ Race created: ${data.trackName} ${year} (${data.racingRefId})`)
        addLog(`✓ Winner: ${data.winningDriver || 'unknown'}`)
        addLog(`✓ ${data.driversLoaded} drivers loaded`)
        if (data.errors > 0) {
          addLog(`⚠ ${data.errors} row error(s):`)
          ;(data.errorLog || []).forEach(e => addLog(`  · ${e}`))
        }
        setResult({ type: 'success', message: data.message })
        setRaceNumber('')
      }
    } catch (err) {
      addLog(`✗ ${err.message}`)
      setResult({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none',
  }
  const labelSt = {
    display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)',
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 6 }}>Load New Race</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Fetches loop data from Racing Reference and saves it to the database. Run once after each race weekend.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelSt}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={{ ...inp, width: '100%' }}>
            {SERIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <label style={labelSt}>Race Number</label>
          <input
            type="number" placeholder="e.g. 16" value={raceNumber}
            onChange={e => setRaceNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            style={{ ...inp, width: '100%' }}
          />
        </div>
      </div>
      {previewUrl && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          {previewUrl}
        </div>
      )}
      <button className="btn btn-primary" onClick={handleLoad} disabled={loading || !raceNumber} style={{ minWidth: 140, marginBottom: log.length > 0 ? 16 : 0 }}>
        {loading ? 'Loading…' : 'Fetch & Load Race'}
      </button>
      {log.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.775rem', lineHeight: 1.7, marginTop: 16 }}>
          {log.map((line, i) => (
            <div key={i} style={{ color: line.startsWith('✓') ? '#22c55e' : line.startsWith('✗') ? '#ef4444' : line.startsWith('⚠') ? '#f59e0b' : 'var(--text-secondary)' }}>{line}</div>
          ))}
        </div>
      )}
      {result && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.8125rem', background: result.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: result.type === 'success' ? '#22c55e' : '#ef4444' }}>
          {result.message}
        </div>
      )}
    </div>
  )
}


// Weekend Config Section
function WeekendConfig() {
  const [configs, setConfigs] = useState({})
  const [tracks, setTracks] = useState([])
  const [saving, setSaving] = useState({})
  const [saveStatus, setSaveStatus] = useState({})

  useEffect(() => {
    Promise.all([
      supabase.from('featured_weekend').select('*'),
      supabase.from('tracks').select('name, correlation_group_label')
        .not('correlation_group_label', 'is', null)
        .order('correlation_group_label').order('name'),
    ]).then(([{ data: cfgRows }, { data: trackRows }]) => {
      const map = {}
      ;(cfgRows || []).forEach(r => { map[r.series] = { ...r } })
      setConfigs(map)
      setTracks(trackRows || [])
    })
  }, [])

  // Unique sorted list of all correlation group labels for the dropdown
  const allGroups = [...new Set((tracks || []).map(t => t.correlation_group_label).filter(Boolean))].sort()

  function updateField(series, field, value) {
    setConfigs(prev => ({
      ...prev,
      [series]: { ...(prev[series] || {}), series, [field]: value }
    }))
  }

  function toggleYear(series, yr) {
    const current = configs[series]?.track_years || []
    const next = current.includes(yr)
      ? current.filter(y => y !== yr)
      : [...current, yr].sort()
    updateField(series, 'track_years', next)
  }

  async function saveConfig(series) {
    const cfg = configs[series]
    if (!cfg || !cfg.track_name) return
    setSaving(p => ({ ...p, [series]: true }))
    setSaveStatus(p => ({ ...p, [series]: null }))
    try {
      const track = tracks.find(t => t.name === cfg.track_name)
      const payload = {
        series,
        track_name: cfg.track_name,
        track_label: cfg.track_label || cfg.track_name.replace(/ Raceway| Motor Speedway| Superspeedway| International Speedway| Speedway/g, '').trim(),
        track_years: cfg.track_years || [],
        correlation_label: cfg.correlation_label || (track ? track.correlation_group_label : ''),
        correlation_year: parseInt(cfg.correlation_year) || new Date().getFullYear(),
        show_qual_sim: series === 'cup' ? (cfg.show_qual_sim || false) : undefined,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('featured_weekend')
        .upsert(payload, { onConflict: 'series' })
      if (error) throw error
      setSaveStatus(p => ({ ...p, [series]: { type: 'success', msg: 'Saved!' } }))
      const { data } = await supabase.from('featured_weekend').select('*').eq('series', series).single()
      if (data) setConfigs(p => ({ ...p, [series]: data }))
    } catch (err) {
      setSaveStatus(p => ({ ...p, [series]: { type: 'error', msg: err.message } }))
    } finally {
      setSaving(p => ({ ...p, [series]: false }))
    }
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none',
  }
  const labelStyle = {
    display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)',
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Weekend Config</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Set the featured track each week. The Loop Data page shows averages for the selected track and its correlation group.
      </p>

      {SERIES_OPTIONS.map(({ value: s, label }) => {
        const cfg = configs[s] || {}
        const status = saveStatus[s]
        return (
          <div key={s} style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 14 }}>{label}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Featured Track</label>
                <select
                  value={cfg.track_name || ''}
                  onChange={e => {
                    const name = e.target.value
                    const track = tracks.find(t => t.name === name)
                    updateField(s, 'track_name', name)
                    if (track) updateField(s, 'correlation_label', track.correlation_group_label)
                    updateField(s, 'track_label', name.replace(/ Raceway| Motor Speedway| Superspeedway| International Speedway| Speedway/g, '').trim())
                  }}
                  style={inputStyle}
                >
                  <option value="">Select track...</option>
                  {tracks.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Correlation Group</label>
                <select
                  value={cfg.correlation_label || ''}
                  onChange={e => updateField(s, 'correlation_label', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select group...</option>
                  {allGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Correlation Year</label>
                <input
                  type="number"
                  value={cfg.correlation_year || new Date().getFullYear()}
                  onChange={e => updateField(s, 'correlation_year', parseInt(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Track Years (for averages)</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ALL_YEARS.map(yr => {
                  const checked = (cfg.track_years || []).includes(yr)
                  return (
                    <label key={yr} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.8125rem', color: checked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleYear(s, yr)}
                        style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                      />
                      {yr}
                    </label>
                  )
                })}
              </div>
            </div>

            {s === 'cup' && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="show_qual_sim"
                  checked={cfg.show_qual_sim || false}
                  onChange={e => updateField(s, 'show_qual_sim', e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                />
                <label htmlFor="show_qual_sim" style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Show Qualifying Simulation on Qualifying Center page
                </label>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => saveConfig(s)}
                disabled={saving[s] || !cfg.track_name}
                style={{ minWidth: 90, fontSize: '0.8125rem' }}
              >
                {saving[s] ? 'Saving...' : 'Save'}
              </button>
              {status && (
                <span style={{ fontSize: '0.8125rem', color: status.type === 'success' ? '#27AE60' : '#E74C3C' }}>
                  {status.msg}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Entry List Manager
const SERIES_OPTS = [
  { value: 'cup', label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks', label: 'Truck Series' },
]

// ── Load Qualifying ──────────────────────────────────────────────────────────
function LoadQualifying() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [raceNumber, setRaceNumber] = useState('')
  const [trackName, setTrackName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [log, setLog] = useState([])

  function addLog(msg) { setLog(p => [...p, msg]) }

  async function handleLoad() {
    if (!year || !raceNumber || !trackName) {
      setResult({ type: 'error', msg: 'Year, Race #, and Track Name are all required.' })
      return
    }
    setLoading(true)
    setResult(null)
    setLog([])
    addLog(`Fetching qualifying for race ${raceNumber} / ${year} at ${trackName}…`)
    try {
      const resp = await fetch('/api/load-qualifying', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, raceNumber: parseInt(raceNumber), series: 'cup', trackName }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        addLog('Error: ' + (data.error || resp.statusText))
        if (data.hint) addLog('Hint: ' + data.hint)
        setResult({ type: 'error', msg: data.error || 'Unknown error' })
      } else {
        addLog(`✓ ${data.message}`)
        if (data.pole) addLog(`Pole: ${data.pole}`)
        setResult({ type: 'success', msg: `Loaded ${data.driversLoaded} qualifying results` })
      }
    } catch (err) {
      addLog('Fetch error: ' + err.message)
      setResult({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)',
    fontSize: '0.8125rem', width: '100%',
  }
  const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Load Qualifying Results</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Cup Series only. Fetches from Racing Reference. Metric/rained-out sessions are automatically rejected.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={inputStyle} min={2020} max={2030} />
        </div>
        <div>
          <label style={labelStyle}>Race #</label>
          <input type="number" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} style={inputStyle} placeholder="e.g. 1" />
        </div>
        <div>
          <label style={labelStyle}>Track Name (exact, for DB)</label>
          <input type="text" value={trackName} onChange={e => setTrackName(e.target.value)} style={inputStyle} placeholder="e.g. Watkins Glen International" />
        </div>
      </div>
      <button
        onClick={handleLoad}
        disabled={loading}
        className="btn btn-primary"
        style={{ fontSize: '0.8125rem', marginBottom: 12 }}
      >
        {loading ? '⟳ Loading…' : '↓ Fetch & Store Qualifying'}
      </button>
      {log.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 12px', fontSize: '0.775rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 10 }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {result && (
        <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', background: result.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: result.type === 'success' ? '#22c55e' : '#ef4444' }}>
          {result.msg}
        </div>
      )}
    </div>
  )
}

function LoadQualifyingOrder() {
  const [jayskiUrl, setJayskiUrl] = React.useState('')
  const [pdfUrl, setPdfUrl] = React.useState('')
  const [year, setYear] = React.useState(new Date().getFullYear())
  const [trackName, setTrackName] = React.useState('')
  const [raceNumber, setRaceNumber] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState(null)
  const [log, setLog] = React.useState([])
  const [tracks, setTracks] = React.useState([])
  const [parsedEntries, setParsedEntries] = React.useState(null)
  const [pdfParsing, setPdfParsing] = React.useState(false)
  const [pdfStatus, setPdfStatus] = React.useState('')

  React.useEffect(() => {
    supabase.from('qualifying_results').select('track_name').eq('series', 'cup')
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.track_name).filter(Boolean))].sort()
        setTracks(unique)
      })
  }, [])

  function parseQualOrderPdf(text) {
    const hasGroup = /Group/i.test(text.slice(0, 300))
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const entries = []
    const clean = n => n.replace(/^\*\s*/, '').replace(/\s*\(i\)\s*$/, '').replace(/\s+/g, ' ').trim()
    if (hasGroup) {
      const re = /^(\d+)\s+(\d+)\s+(.+?)\s+([\d.]+)\s+(A|B|1|2)$/i
      for (const line of lines) {
        const m = line.match(re); if (!m) continue
        const g = m[5].toUpperCase()
        entries.push({ order: parseInt(m[1],10), carNumber: m[2].padStart(2,'0'), driverName: clean(m[3]), metricScore: parseFloat(m[4]), group: g==='A'||g==='1' ? 1 : 2 })
      }
    } else {
      const re = /^(\d+)\s+(\d+)\s+(.+?)\s+([\d.]+)$/
      for (const line of lines) {
        const m = line.match(re); if (!m) continue
        entries.push({ order: parseInt(m[1],10), carNumber: m[2].padStart(2,'0'), driverName: clean(m[3]), metricScore: parseFloat(m[4]), group: null })
      }
    }
    return entries.sort((a,b) => a.order - b.order)
  }

  async function handlePdfUpload(file) {
    setPdfParsing(true); setPdfStatus('Loading pdf.js...'); setParsedEntries(null)
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          s.onload = res; s.onerror = rej; document.head.appendChild(s)
        })
      }
      // Always set workerSrc — even if pdfjsLib was already cached by another component
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setPdfStatus('Parsing PDF...')
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const content = await page.getTextContent()
        // Group items by y-position so regex sees proper lines, not one giant joined string
        const lineMap = {}
        for (const item of content.items) {
          if (!item.str || !item.str.trim()) continue
          const y = Math.round(item.transform[5])
          if (!lineMap[y]) lineMap[y] = []
          lineMap[y].push({ x: item.transform[4], str: item.str })
        }
        const lines = Object.keys(lineMap)
          .sort((a, b) => b - a) // higher y = higher on page
          .map(y => lineMap[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' '))
        fullText += lines.join('\n') + '\n'
      }
      const entries = parseQualOrderPdf(fullText)
      if (entries.length === 0) {
        setPdfStatus('No entries found — check PDF format')
      } else {
        setParsedEntries(entries)
        setPdfStatus('Parsed ' + entries.length + ' drivers — select track and click Save to DB')
      }
    } catch (err) {
      setPdfStatus('Error: ' + err.message)
    }
    setPdfParsing(false)
  }

  async function handleLoad() {
    if (!trackName.trim()) return
    if (!parsedEntries && !jayskiUrl.trim() && !pdfUrl.trim()) return
    setLoading(true); setResult(null); setLog([])
    try {
      const res = await fetch('/api/load-qualifying-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jayskiUrl: jayskiUrl.trim() || undefined,
          pdfUrl: pdfUrl.trim() || undefined,
          parsedEntries: parsedEntries || undefined,
          year,
          trackName: trackName.trim(),
          series: 'cup',
          raceNumber: raceNumber ? parseInt(raceNumber) : undefined,
        }),
      })
      const data = await res.json()
      setLog(data.log || [])
      setResult(data)
      if (!data.error) { setParsedEntries(null); setPdfStatus('') }
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const inp = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.8125rem', width: '100%' }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Load Qualifying Order</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Upload a Jayski qualifying order PDF, or paste a page/PDF URL. Stores order, group, and metric score.
      </p>

      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Upload PDF
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ cursor: pdfParsing ? 'wait' : 'pointer', display: 'inline-block' }}>
            <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} disabled={pdfParsing}
              onChange={e => { const f = e.target.files && e.target.files[0]; if (f) handlePdfUpload(f); e.target.value = '' }} />
            <span style={{ padding: '6px 18px', borderRadius: 5, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', opacity: pdfParsing ? 0.7 : 1 }}>
              {pdfParsing ? 'Parsing...' : 'Choose Qualifying Order PDF'}
            </span>
          </label>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Download from Jayski, upload here — parsed in browser</span>
        </div>
        {pdfStatus && (
          <div style={{ marginTop: 7, fontSize: '0.78rem', color: pdfStatus.startsWith('Error') ? '#f87171' : pdfStatus.startsWith('Parsed') ? '#4ade80' : 'var(--text-muted)' }}>
            {pdfStatus}
          </div>
        )}
        {parsedEntries && parsedEntries.length > 0 && (
          <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {parsedEntries.slice(0, 5).map(e => (
              <div key={e.order}>{e.order}. #{e.carNumber} {e.driverName}{e.group ? ' (Grp ' + e.group + ')' : ''} — {e.metricScore}</div>
            ))}
            {parsedEntries.length > 5 && <div style={{ color: 'var(--text-muted)' }}>…and {parsedEntries.length - 5} more</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, marginBottom: 12, alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Jayski Page URL <span style={{ textTransform: 'none', fontWeight: 400 }}>(or leave blank if uploading PDF)</span></label>
          <input value={jayskiUrl} onChange={e => setJayskiUrl(e.target.value)} placeholder="https://www.jayski.com/..." style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ ...inp, width: 80 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Race #</label>
          <input type="number" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} placeholder="opt." style={{ ...inp, width: 70 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Track Name</label>
          <select value={trackName} onChange={e => setTrackName(e.target.value)} style={{ ...inp, width: 200 }}>
            <option value="">Select track...</option>
            {tracks.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>
          Direct PDF URL <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span>
        </label>
        <input value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} placeholder="https://www.jayski.com/.../qualifying-order.pdf" style={inp} />
      </div>

      <button className="btn btn-primary" onClick={handleLoad}
        disabled={loading || !trackName.trim() || (!parsedEntries && !jayskiUrl.trim() && !pdfUrl.trim())}
        style={{ minWidth: 140, marginBottom: 14 }}>
        {loading ? 'Saving...' : parsedEntries ? 'Save to DB' : 'Fetch Order PDF'}
      </button>

      {log.length > 0 && (
        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 6, marginBottom: 10, maxHeight: 160, overflowY: 'auto', color: 'var(--text-secondary)' }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {result && (
        <div style={{ fontSize: '0.8125rem', padding: '8px 12px', borderRadius: 6, background: result.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: result.error ? '#ef4444' : '#22c55e', border: `1px solid ${result.error ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
          {result.error ? `Error: ${result.error}` : result.hint ? result.hint : `Saved ${result.saved} / ${result.total} drivers`}
        </div>
      )}
    </div>
  )
}
function EntryListManager() {
  const [series, setSeries] = React.useState('cup')
  const [cfg, setCfg] = React.useState(null)
  const [entries, setEntries] = React.useState([])
  const [newCar, setNewCar] = React.useState('')
  const [newDriver, setNewDriver] = React.useState('')
  const [newOrg, setNewOrg] = React.useState('')
  const [bulkText, setBulkText] = React.useState('')
  const [showBulk, setShowBulk] = React.useState(false)
  const [pdfParsing, setPdfParsing] = React.useState(false)
  const [pdfStatus, setPdfStatus] = React.useState('')
  const [status, setStatus] = React.useState(null)

  const showStatus = (msg, isErr) => {
    setStatus({ msg, isErr })
    setTimeout(() => setStatus(null), 3000)
  }

  const parsePdf = async (file) => {
    setPdfParsing(true)
    setPdfStatus('Loading pdf.js...')
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          s.onload = res; s.onerror = rej
          document.head.appendChild(s)
        })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const allItems = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const content = await page.getTextContent()
        allItems.push(...content.items.map(it => it.str))
      }
      const rows = []
      const ne = allItems.filter(s => s.trim())
      const cleanName = n => n.trim().replace(/\s*\([a-zA-Z]\)\s*$/, '').trim()
      for (let i = 0; i < ne.length - 2; i++) {
        const s = ne[i].trim()
        if (/^\d{1,3}$/.test(s) && +s < 200) {
          const drv = ne[i+1] ? cleanName(ne[i+1]) : ''
          const isMfrOrInd = n => /^\([a-zA-Z]\)$/.test(n) || /^(chevrolet|chevy|ford|toyota|tundra|silverado|f-?150|ram|dodge)/i.test(n)
          let org
          if (series === 'trucks') {
            org = ne[i+4] ? ne[i+4].trim() : ''
          } else {
            const rawOrg = ne[i+2] ? ne[i+2].trim() : ''
            org = isMfrOrInd(rawOrg) ? (ne[i+3] ? ne[i+3].trim() : '') : rawOrg
          }
          if (drv && /[A-Z]/.test(drv) && drv.length > 3 && !/^\d/.test(drv)) {
            rows.push(s + ',' + drv + ',' + org)
          }
        }
      }
      if (!rows.length) {
        for (let i = 0; i < allItems.length; i++) {
          if (allItems[i] === '') {
            const c2 = allItems[i+2]||'', drv = allItems[i+4]||'', o = allItems[i+6]||''
            if (c2.match(/^\d/) && drv.trim()) rows.push(c2.trim()+','+drv.trim()+','+o.trim())
          }
        }
      }
      if (!rows.length) {
        for (let i = 0; i < ne.length - 1; i++) {
          const m = ne[i].trim().match(/^#?(\d{1,3})\.?$/)
          if (m && +m[1] < 200) {
            const drv = ne[i+1] ? cleanName(ne[i+1]) : ''
            const org = ne[i+2] ? ne[i+2].trim() : ''
            if (drv && /[A-Za-z]{2}/.test(drv)) { rows.push(m[1]+','+drv+','+org); i+=2 }
          }
        }
      }
      setBulkText(rows.join('\n'))
      setShowBulk(true)
      if (rows.length > 0) {
        setPdfStatus('Found ' + rows.length + ' drivers -- scroll down to import')
      } else {
        setPdfStatus('No drivers found. First items: ' + ne.slice(0,6).join(' | '))
      }
    } catch(err) {
      setPdfStatus('Error: ' + (err.message || 'PDF parse failed'))
    }
    setPdfParsing(false)
  }

  const loadEntries = async (s, config) => {
    if (!config) return
    const { data } = await supabase
      .from('entry_list')
      .select('*')
      .eq('series', s)
      .eq('race_year', config.correlation_year)
      .eq('track_name', config.track_name)
      .order('car_number')
    setEntries(data || [])
  }

  React.useEffect(() => {
    supabase.from('featured_weekend').select('*').eq('series', series).single()
      .then(({ data }) => { setCfg(data); loadEntries(series, data) })
  }, [series])

  const addEntry = async () => {
    if (!newDriver.trim() || !cfg) return
    const { error } = await supabase.from('entry_list').upsert({
      series, race_year: cfg.correlation_year, track_name: cfg.track_name,
      car_number: newCar.trim() || null,
      driver_name: newDriver.trim(),
      organization: newOrg.trim() || null,
    })
    if (error) { showStatus('Error: ' + error.message, true); return }
    setNewCar(''); setNewDriver(''); setNewOrg('')
    await loadEntries(series, cfg)
    showStatus('Added ' + newDriver.trim())
  }

  const deleteEntry = async (id) => {
    await supabase.from('entry_list').delete().eq('id', id)
    setEntries(p => p.filter(e => e.id !== id))
  }

  const clearAll = async () => {
    if (!cfg || !window.confirm('Clear all entries for this race weekend?')) return
    await supabase.from('entry_list').delete()
      .eq('series', series).eq('race_year', cfg.correlation_year).eq('track_name', cfg.track_name)
    setEntries([])
    showStatus('Cleared')
  }

  const bulkImport = async () => {
    if (!cfg || !bulkText.trim()) return
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    const rows = []
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 2 && parts[1]) {
        rows.push({
          series, race_year: cfg.correlation_year, track_name: cfg.track_name,
          car_number: parts[0] || null,
          driver_name: parts[1],
          organization: parts[2] || null,
        })
      }
    }
    if (!rows.length) { showStatus('No valid lines parsed', true); return }
    const { error } = await supabase.from('entry_list').upsert(rows, { onConflict: 'series,race_year,track_name,driver_name' })
    if (error) { showStatus('Error: ' + error.message, true); return }
    await loadEntries(series, cfg)
    setBulkText(''); setShowBulk(false)
    showStatus('Imported ' + rows.length + ' drivers')
  }

  const inp = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.825rem',
  }
  const btn = (extra) => ({
    padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--accent)', color: '#fff', cursor: 'pointer',
    fontSize: '0.825rem', fontWeight: 600, ...extra,
  })

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>
          Entry List{cfg ? ' ' + cfg.track_label + ' ' + cfg.correlation_year : ''}
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{entries.length} drivers</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {SERIES_OPTS.map(o => (
          <button key={o.value} onClick={() => setSeries(o.value)} style={btn({
            background: series === o.value ? 'var(--accent)' : 'transparent',
            color: series === o.value ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border)', padding: '5px 12px', fontWeight: 500,
          })}>{o.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Car #" value={newCar} onChange={e => setNewCar(e.target.value)}
          style={{ ...inp, width: 64 }} />
        <input placeholder="Driver Name" value={newDriver} onChange={e => setNewDriver(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEntry()}
          style={{ ...inp, flex: 1, minWidth: 160 }} />
        <input placeholder="Organization" value={newOrg} onChange={e => setNewOrg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEntry()}
          style={{ ...inp, flex: 1, minWidth: 160 }} />
        <button onClick={addEntry} style={btn({})}>+ Add</button>
      </div>

      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Import from PDF
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ cursor: pdfParsing ? 'wait' : 'pointer', display: 'inline-block' }}>
            <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} disabled={pdfParsing}
              onChange={e => { const f = e.target.files && e.target.files[0]; if (f) parsePdf(f); e.target.value = '' }} />
            <span style={{ padding: '6px 18px', borderRadius: 5, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', opacity: pdfParsing ? 0.7 : 1 }}>
              {pdfParsing ? 'Parsing...' : 'Choose Entry List PDF'}
            </span>
          </label>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Download from Jayski, then upload here -- auto-fills the import box below
          </span>
        </div>
        {pdfStatus && (
          <div style={{ marginTop: 7, fontSize: '0.78rem', color: pdfStatus.startsWith('Error') ? '#f87171' : pdfStatus.startsWith('Found') ? '#4ade80' : 'var(--text-muted)' }}>
            {pdfStatus}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setShowBulk(p => !p)} style={btn({
          background: 'transparent', color: 'var(--accent)',
          border: '1px solid var(--accent)', fontSize: '0.78rem', padding: '5px 12px',
        })}>
          {showBulk ? ' Hide Bulk Import' : ' Bulk Import (Jayski paste)'}
        </button>
        {showBulk && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              One driver per line: <code>car#, Driver Name, Organization</code>
            </p>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              rows={8}
              placeholder={"12, Ryan Blaney, Team Penske\n5, Kyle Larson, Hendrick Motorsports"}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem',
                padding: '8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={bulkImport} style={btn({})}>Import</button>
              <button onClick={clearAll} style={btn({
                background: 'transparent', color: '#ef4444', border: '1px solid #ef4444',
              })}>Clear All</button>
            </div>
          </div>
        )}
      </div>

      {status && (
        <div style={{ fontSize: '0.8rem', color: status.isErr ? '#ef4444' : '#22c55e', marginBottom: 8 }}>
          {status.msg}
        </div>
      )}

      {entries.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 7, border: '1px solid var(--border)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['#','Driver','Organization',''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'left',
                    color: 'var(--text-secondary)', fontWeight: 600,
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)' }}>
                  <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: 'var(--text-muted)', width: 50 }}>{e.car_number || ''}</td>
                  <td style={{ padding: '6px 12px' }}>{e.driver_name}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{e.organization || ''}</td>
                  <td style={{ padding: '6px 4px', width: 32 }}>
                    <button onClick={() => deleteEntry(e.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 6px' }}></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entries.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
          No entries yet. Add drivers above or use Bulk Import from Jayski.
        </p>
      )}
    </div>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [series, setSeries] = useState('cup')
  const [trackName, setTrackName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [sessionNum, setSessionNum] = useState(1)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [preview, setPreview] = useState(null)

  function handleLogin(e) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('Incorrect password')
    }
  }

  async function handleFileSelect(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setUploadStatus(null)
    try {
      const parsed = await parsePracticeExcel(f, series)
      const graded = gradePracticeSession(parsed.drivers)
      setPreview({ parsed, graded })
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
      setPreview(null)
    }
  }

  async function handleUpload() {
    if (!file || !trackName || !preview) return
    setUploading(true)
    setUploadStatus(null)
    try {
      let raceId = null
      const { data: existingRace } = await supabase
        .from('races').select('id')
        .eq('track_name', trackName).eq('year', year).eq('series', series)
        .single()

      if (existingRace) {
        raceId = existingRace.id
      } else {
        const { data: newRace, error: raceError } = await supabase
          .from('races')
          .insert({ race_name: `${trackName} ${year}`, series, year, track_name: trackName })
          .select('id').single()
        if (raceError) throw raceError
        raceId = newRace.id
      }

      // Delete and re-insert practice session summaries
      await supabase.from('practice_sessions').delete()
        .eq('race_id', raceId).eq('series', series).eq('session_number', sessionNum)

      const rows = preview.graded.map(d => ({
        race_id: raceId,
        driver_name: d.driver,
        series, year,
        track_name: trackName,
        session_number: sessionNum,
        qualifying_position: d.start,
        car_number: d.carNumber || null,
        practice_group: d.group || null,
        total_laps: d.totalLaps,
        best_lap: d.bestLap,
        overall_avg: d.overallAvg,
        late_run_avg: d.lateRunAvg,
        trend_slope: d.trendSlope,
        num_stints: d.stints,
        longest_stint: d.longestStint,
        practice_score: d.composite,
        practice_grade: d.grade,
        notes: d.notes || null,
      }))

      const { error: insertError } = await supabase.from('practice_sessions').insert(rows)
      if (insertError) throw insertError

      // Also store individual lap times in practice_laps (if table exists and lapData is present)
      try {
        await supabase.from('practice_laps').delete()
          .eq('series', series).eq('year', year)
          .eq('track_name', trackName).eq('session_number', sessionNum)

        const lapRows = []
        for (const d of (preview.parsed.drivers || [])) {
          if (!d.lapData) continue
          const entries = Object.entries(d.lapData)
          for (const [lapNum, lapTime] of entries) {
            const t = parseFloat(lapTime)
            if (isNaN(t) || t <= 0) continue
            lapRows.push({
              series, year, track_name: trackName, session_number: sessionNum,
              driver_name: d.driver,
              car_number: d.carNumber || null,
              starting_position: d.start || null,
              lap_number: parseInt(lapNum),
              lap_time: t,
            })
          }
        }

        if (lapRows.length > 0) {
          // Insert in batches of 500 to avoid request size limits
          for (let i = 0; i < lapRows.length; i += 500) {
            const batch = lapRows.slice(i, i + 500)
            const { error: lapErr } = await supabase.from('practice_laps').insert(batch)
            if (lapErr) throw lapErr
          }
        }
      } catch (lapTableErr) {
        // practice_laps table may not exist yet — don't fail the whole upload
        console.warn('practice_laps insert skipped:', lapTableErr.message)
      }

      setUploadStatus({
        type: 'success',
        message: `Uploaded ${rows.length} drivers for ${trackName} ${year} ${series} Session ${sessionNum}`,
      })
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
    } finally {
      setUploading(false)
    }
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>Admin Access</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <input type="password" placeholder="Admin password" value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none' }} />
            </div>
            {authError && <p style={{ color: '#E74C3C', fontSize: '0.75rem', marginBottom: 12 }}>{authError}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Sign in</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Upload practice data, load race results &amp; configure featured weekends</p>
      </div>

      <LoadNewRace />
      <WeekendConfig />
      <LoadQualifying />
      <LoadQualifyingOrder />
      <EntryListManager />

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 20 }}>Upload Practice Session</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Series</label>
            <select value={series} onChange={e => setSeries(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem' }}>
              {SERIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Track Name</label>
            <input type="text" placeholder="e.g. Pocono Raceway" value={trackName} onChange={e => setTrackName(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Year</label>
            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Session #</label>
            <select value={sessionNum} onChange={e => setSessionNum(parseInt(e.target.value))} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem' }}>
              <option value={1}>Session 1</option>
              <option value={2}>Session 2</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
            Practice Excel File — optional columns: Car # and Group (A/B)
          </label>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', cursor: 'pointer' }} />
        </div>

        {uploadStatus && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: '0.8125rem', background: uploadStatus.type === 'success' ? '#145A3220' : '#922B2120', border: `1px solid ${uploadStatus.type === 'success' ? '#145A3240' : '#922B2140'}`, color: uploadStatus.type === 'success' ? '#27AE60' : '#E74C3C' }}>
            {uploadStatus.message}
          </div>
        )}

        {preview && (
          <div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Parsed {preview.parsed.totalDrivers} drivers from sheet "{preview.parsed.sheetName}" — ready to grade and upload
            </div>
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th style={{ width: 52 }}>Car</th><th className="left">Driver</th>
                    <th style={{ width: 60 }}>Group</th><th>Laps</th><th>Avg Lap</th>
                    <th>Late Run</th><th>Best Lap</th><th>Score</th><th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.graded.slice(0, 10).map((d, i) => (
                    <tr key={d.driver}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{d.carNumber ? `#${d.carNumber}` : ''}</td>
                      <td className="left" style={{ fontWeight: i < 3 ? 600 : 400 }}>{d.driver}</td>
                      <td>{d.group ? <span className="grade-pill" style={{ background: d.group === 'A' ? '#1A5276' : '#6E2F8D', color: '#fff', fontSize: '0.7rem', padding: '2px 8px' }}>{d.group}</span> : ''}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.totalLaps}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.overallAvg?.toFixed(3) || ''}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.lateRunAvg?.toFixed(3) || ''}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{d.bestLap?.toFixed(3) || ''}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.composite?.toFixed(1) || ''}</td>
                      <td><span className="grade-pill" style={{ background: '#1A5276', color: '#fff' }}>{d.grade || ''}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !trackName} style={{ minWidth: 160 }}>
              {uploading ? 'Uploading...' : `Upload ${preview.graded.length} drivers`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
