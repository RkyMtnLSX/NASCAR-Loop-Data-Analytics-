import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { parsePracticeExcel } from '../lib/excelParser'
import { gradePracticeSession } from '../lib/practiceGrader'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD

const SERIES_OPTIONS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

const ALL_YEARS = [2022, 2023, 2024, 2025, 2026]

//  Weekend Config Section 
function WeekendConfig() {
  const [configs, setConfigs]       = useState({})
  const [tracks, setTracks]         = useState([])
  const [saving, setSaving]         = useState({})
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
        track_name:        cfg.track_name,
        track_label:       cfg.track_label || cfg.track_name.replace(/ Raceway| Motor Speedway| Superspeedway| International Speedway| Speedway/g, '').trim(),
        track_years:       cfg.track_years || [],
        correlation_label: cfg.correlation_label || (track ? track.correlation_group_label : ''),
        correlation_year:  parseInt(cfg.correlation_year) || new Date().getFullYear(),
        updated_at:        new Date().toISOString(),
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
                <input
                  type="text"
                  value={cfg.correlation_label || ''}
                  onChange={e => updateField(s, 'correlation_label', e.target.value)}
                  placeholder="e.g. High Speed Intermediates"
                  style={inputStyle}
                />
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

//  Main Admin Page 

//  Entry List Manager 
const SERIES_OPTS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

function EntryListManager() {
  const [series, setSeries]         = React.useState('cup')
  const [cfg, setCfg]               = React.useState(null)
  const [entries, setEntries]       = React.useState([])
  const [newCar, setNewCar]         = React.useState('')
  const [newDriver, setNewDriver]   = React.useState('')
  const [newOrg, setNewOrg]         = React.useState('')
  const [bulkText, setBulkText]     = React.useState('')
  const [showBulk, setShowBulk]     = React.useState(false)
  const [pdfParsing, setPdfParsing]   = React.useState(false)
  const [pdfStatus, setPdfStatus]     = React.useState('')
  const showStatus = (msg, isErr) => {
    setStatus({ msg, isErr })
    setTimeout(() => setStatus(null), 3000)
  }

  const parsePdf = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setPdfStatus('Please select a PDF file')
      return
    }
    setPdfParsing(true)
    setPdfStatus('Parsing PDF...')
    try {
      const arrayBuffer = await file.arrayBuffer()
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          s.onload = resolve; s.onerror = reject
          document.head.appendChild(s)
        })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const entries = []
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p)
        const content = await page.getTextContent()
        const items = content.items.map(i => i.str)
        let group = [], started = false
        for (const item of items) {
          if (!started) { if (/^\d+$/.test(item) && group.length === 0) started = true; else continue }
          if (item === '' && group.length > 0) {
            if (group.length >= 7) entries.push({ car_number: group[2], driver_name: group[4], organization: group[6] || '' })
            group = []
          } else { group.push(item) }
        }
        if (group.length >= 7) entries.push({ car_number: group[2], driver_name: group[4], organization: group[6] || '' })
      }
      if (!entries.length) throw new Error('No entries found  check this is a NASCAR entry list PDF')
      setBulkText(entries.map(e => e.car_number + ', ' + e.driver_name + ', ' + e.organization).join('\n'))
      setShowBulk(true)
      setPdfStatus('Found ' + entries.length + ' drivers  review below and click Import')
    } catch (e) {
      setPdfStatus('Error: ' + e.message)
    } finally {
      setPdfParsing(false)
    }
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
    const { error } = await supabase.from('entry_list').upsert(rows)
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
          Entry List{cfg ? '  ' + cfg.track_label + ' ' + cfg.correlation_year : ''}
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{entries.length} drivers</span>
      </div>

      {/* Series tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {SERIES_OPTS.map(o => (
          <button key={o.value} onClick={() => setSeries(o.value)} style={btn({
            background: series === o.value ? 'var(--accent)' : 'transparent',
            color: series === o.value ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border)', padding: '5px 12px', fontWeight: 500,
          })}>{o.label}</button>
        ))}
      </div>

      {/* Add single driver */}
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

      {/* PDF upload */}
      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Import from PDF
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ cursor: pdfParsing ? 'wait' : 'pointer', display: 'inline-block' }}>
            <input
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              disabled={pdfParsing}
              onChange={e => { const f = e.target.files && e.target.files[0]; if (f) parsePdf(f); e.target.value = '' }}
            />
            <span style={{ padding: '6px 18px', borderRadius: 5, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', opacity: pdfParsing ? 0.7 : 1, pointerEvents: pdfParsing ? 'none' : 'auto' }}>
              {pdfParsing ? 'Parsing...' : 'Choose Entry List PDF'}
            </span>
          </label>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Download from Jayski, then upload here  auto-fills the import box below
          </span>
        </div>
        {pdfStatus && (
          <div style={{ marginTop: 7, fontSize: '0.78rem', color: pdfStatus.startsWith('Error') ? '#f87171' : pdfStatus.startsWith('Found') ? '#4ade80' : 'var(--text-muted)' }}>
            {pdfStatus}
          </div>
        )}
      </div>

      {/* Bulk import toggle */}
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

      {/* Entries table */}
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
  const [authed, setAuthed]         = useState(false)
  const [password, setPassword]     = useState('')
  const [authError, setAuthError]   = useState('')

  const [series, setSeries]         = useState('cup')
  const [trackName, setTrackName]   = useState('')
  const [year, setYear]             = useState(new Date().getFullYear())
  const [sessionNum, setSessionNum] = useState(1)
  const [file, setFile]             = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [preview, setPreview]       = useState(null)

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

      await supabase.from('practice_sessions').delete()
        .eq('race_id', raceId).eq('series', series).eq('session_number', sessionNum)

      const rows = preview.graded.map(d => ({
        race_id:             raceId,
        driver_name:         d.driver,
        series, year,
        track_name:          trackName,
        session_number:      sessionNum,
        qualifying_position: d.start,
        car_number:          d.carNumber || null,
        practice_group:      d.group     || null,
        total_laps:          d.totalLaps,
        best_lap:            d.bestLap,
        overall_avg:         d.overallAvg,
        late_run_avg:        d.lateRunAvg,
        trend_slope:         d.trendSlope,
        num_stints:          d.stints,
        longest_stint:       d.longestStint,
        practice_score:      d.composite,
        practice_grade:      d.grade,
        notes:               d.notes || null,
      }))

      const { error: insertError } = await supabase.from('practice_sessions').insert(rows)
      if (insertError) throw insertError

      setUploadStatus({ type: 'success', message: `Uploaded ${rows.length} drivers  ${trackName} ${year} ${series} Session ${sessionNum}` })
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
        <p className="page-subtitle">Upload practice data &amp; configure featured weekends</p>
      </div>

      <WeekendConfig />
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
            Practice Excel File  optional columns: Car # and Group (A/B)
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
              Parsed {preview.parsed.totalDrivers} drivers from sheet "{preview.parsed.sheetName}"  ready to grade and upload
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
