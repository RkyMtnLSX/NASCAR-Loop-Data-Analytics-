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

// Entry List Manager
const SERIES_OPTS = [
  { value: 'cup', label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks', label: 'Truck Series' },
]

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

// Ã¢ÂÂÃ¢ÂÂ Load Qualifying Results from PDF Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Parses official NASCAR.com qualifying result PDFs (pos / car # / driver / speed)
// and inserts directly into the qualifying_results Supabase table.
function LoadQualifyingPdf() {
  const [qSeries, setQSeries] = React.useState('cup')
  const [qTrack, setQTrack] = React.useState('')
  const [qYear, setQYear] = React.useState(new Date().getFullYear())
  const [qRaceNum, setQRaceNum] = React.useState('')

  const [parsing, setParsing] = React.useState(false)
  const [parseStatus, setParseStatus] = React.useState(null)
  const [drivers, setDrivers] = React.useState([])

  const [uploading, setUploading] = React.useState(false)
  const [uploadStatus, setUploadStatus] = React.useState(null)

  const MAKES = ['toyota', 'chevrolet', 'chevy', 'ford']

  // PDF name corrections: handles truncations (Shane Van Ã¢ÂÂ full name) and
  // normalization mismatches (AJ without dots Ã¢ÂÂ A.J.)
  const NAME_CORRECTIONS = {
    'Shane Van': 'Shane Van Gisbergen',
    'Aj Allmendinger': 'A.J. Allmendinger',
    'Tj Bell': 'T.J. Bell',
    'Bj McLeod': 'B.J. McLeod',
    'Rj Segals': 'R.J. Segals',
    'Rickey Stenhouse Jr': 'Ricky Stenhouse Jr',
    'John Hunter': 'John Hunter Nemechek',
    'John H. Nemechek': 'John Hunter Nemechek',
    'Ricky Stenhouse Jr.': 'Ricky Stenhouse Jr',
    'Ricky Stenhouse': 'Ricky Stenhouse Jr',
    'Austin Hill(*)': 'Austin Hill',
  }

  function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }

  // Fix compound prefixes that toTitleCase gets wrong: "Mcdowell"Ã¢ÂÂ"McDowell"
  function fixSpecialCaps(name) {
    return name.replace(/\b(Mc|Mac)([a-z])/g, (_, p, c) => p + c.toUpperCase())
  }

  function normalizeDriverName(raw) {
    const trimmed = raw.trim()
    // Handle "LAST, FIRST" timing-sheet format
    const commaIdx = trimmed.indexOf(',')
    if (commaIdx > 0) {
      const last = trimmed.substring(0, commaIdx).trim()
      const first = trimmed.substring(commaIdx + 1).trim()
      return fixSpecialCaps(toTitleCase(first + ' ' + last))
    }
    return fixSpecialCaps(toTitleCase(trimmed))
  }

  async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    return window.pdfjsLib
  }

  async function handlePdfSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    setParsing(true)
    setParseStatus('Parsing PDF...')
    setDrivers([])
    setUploadStatus(null)

    try {
      const pdfjsLib = await loadPdfJs()
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      // Reconstruct text lines using y-coordinate grouping.
      // PDF.js gives individual text items with transform[4]=x, transform[5]=y.
      // Items with the same y (within 2px tolerance) are on the same visual line.
      const allLines = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const content = await page.getTextContent()

        const lineMap = {}
        for (const item of content.items) {
          const y = Math.round(item.transform[5] / 5) * 5  // 5px bucket Ã¢ÂÂ groups mixed-font-size items on same visual row
          if (!lineMap[y]) lineMap[y] = []
          lineMap[y].push({ x: item.transform[4], str: item.str.trim() })
        }

        const pageLines = Object.entries(lineMap)
          .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))  // top of page first
          .map(([, items]) =>
            items.sort((a, b) => a.x - b.x)
              .map(i => i.str).filter(s => s).join(' ').trim()
          )
          .filter(l => l)

        allLines.push(...pageLines)
      }

      const parsed = []
      let ftqIdx = 0

      for (const line of allLines) {
        // Strip leading asterisk Ã¢ÂÂ some PDFs mark FTQ entries with * before name/number
        const normLine = line.trimStart().replace(/^\*\s*/, '')
        const posMatch = normLine.match(/^(\d{1,2})\s+(.+)$/)

        if (!posMatch) {
          // No leading position number Ã¢ÂÂ try to parse as a pure-name FTQ entry.
          // Triggered when original line had * prefix OR has (i)/(x) status suffix.
          if (line.trim().startsWith('*') || /\([^)]{1,5}\)/.test(line)) {
            let cleanN = normLine.replace(/\([^)]{1,5}\)/g, ' ').trim()
            cleanN = cleanN.replace(/\s+[\d]+\.[\d]+.*$/, '').trim()
            if (/^[A-Za-z]/.test(cleanN) && cleanN.length >= 3) {
              // car number may still lead the name
              const carF = cleanN.match(/^(\d{1,3}[A-Za-z]?)\s+(.+)$/)
              let carN = '', nameR = cleanN
              if (carF) { carN = carF[1]; nameR = carF[2] }
              // name extraction (mirrors main path)
              const wsFtq = nameR.split(/\s+/).filter(w => w)
              let tkFtq = Math.min(2, wsFtq.length)
              if (wsFtq.length >= 3) {
                if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(wsFtq[2])) tkFtq = 3
                else if (/^[A-Z]\.$/.test(wsFtq[1])) tkFtq = Math.min(4, wsFtq.length)
              }
              const rnFtq = fixSpecialCaps(toTitleCase(wsFtq.slice(0, tkFtq).join(' ')))
              const dnFtq = NAME_CORRECTIONS[rnFtq] || rnFtq
              if (dnFtq.length >= 3 && /[A-Za-z]{2}/.test(dnFtq) &&
                  !/^(driver|car|pos|position|make|speed|time|sponsor|team)\b/i.test(dnFtq)) {
                parsed.push({ position: 900 + ftqIdx++, carNumber: carN, driverName: dnFtq, speed: null })
              }
            }
          }
          continue
        }

        const pos = parseInt(posMatch[1])
        if (pos < 1 || pos > 99) continue

        // Strip asterisk from rest if present (e.g. line was "15 * Casey Mears")
        const rest = posMatch[2].trim().replace(/^\*\s*/, '')

        // Car number: 1-3 chars, starts with a digit (e.g. "11", "48", "23XI")
        const carMatch = rest.match(/^(\d{1,3}[A-Za-z]?)\s+(.+)$/)

        // FTQ fallback: if rest doesn't start with a car number, the leading
        // number (pos) IS the car number Ã¢ÂÂ FTQ sections often omit a position prefix
        let carNumber, afterCar, ftqFallback = false
        if (carMatch) {
          carNumber = carMatch[1]
          afterCar = carMatch[2].trim()
        } else if (/^[A-Za-z]/.test(rest)) {
          carNumber = String(pos)
          afterCar = rest
          ftqFallback = true
        } else {
          continue
        }

        // Speed: first float in mph range 50-300
        let speed = null
        let driverPart = afterCar
        const allSpeedMatches = [...afterCar.matchAll(/(\d+\.\d+)/g)]
        if (allSpeedMatches.length > 0) {
          // Cut driver name at first number (lap time); find mph value (>=100) for speed
          driverPart = afterCar.substring(0, allSpeedMatches[0].index).trim()
          const mphMatch = allSpeedMatches.find(m => { const v = parseFloat(m[1]); return v >= 100 && v <= 300 })
          if (mphMatch) speed = parseFloat(mphMatch[1])
        }

        // Strip make AND everything after it (sponsor names follow make in some PDFs)
        let rawName = driverPart.replace(/^\*\s*/, '').trim()  // strip FTQ asterisk marker
        for (const make of MAKES) {
          rawName = rawName.replace(new RegExp(`\\b${make}\\b.*$`, 'i'), '').trim()
        }
        // Strip trailing status indicators like "(i)"
        rawName = rawName.replace(/\s*\([^)]{1,5}\)\s*$/, '').trim()  // strip (i), (*), (x) etc.
        // Smart name extraction: allow First Last plus optional Jr/Sr/II/III suffix.
        // A middle initial (e.g. "H.") allows the word after it as well.
        // Handles "John H. Nemechek", "Ricky Stenhouse Jr", "A.J. Allmendinger"
        // while still blocking sponsor overflow on lines without a make name.
        {
          const ws = rawName.split(/\s+/).filter(w => w)
          let take = Math.min(2, ws.length)
          if (ws.length >= 3) {
            const isSuffix = /^(Jr\.?|Sr\.?|II|III|IV)$/i.test(ws[2])
            const isMiddleInitial = /^[A-Z]\.$/.test(ws[1])
            if (isSuffix) take = 3
            else if (isMiddleInitial) take = Math.min(4, ws.length)
          }
          rawName = ws.slice(0, take).join(' ')
    rawName = rawName.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()  // strip embedded markers
        }

        const rawDriverName = normalizeDriverName(rawName)
        const driverName = NAME_CORRECTIONS[rawDriverName] || rawDriverName

        if (driverName.length < 3 || !/[A-Za-z]{2}/.test(driverName)) continue
        // Skip header rows
        if (/^(driver|car|pos|position|make|speed|time|sponsor|team)\b/i.test(driverName)) continue

        parsed.push({ position: ftqFallback ? (900 + ftqIdx++) : pos, carNumber, driverName, speed })
      }

      // Dedup: separate genuine qualifiers (pos<900) from FTQ fallback entries (posÃ¢ÂÂ¥900).
      // FTQ entries get positions immediately after the last genuine qualifier.
      const seenPos = new Set()
      const seenName = new Set()
      const qualEntries = []
      const ftqEntries = []

      for (const d of parsed.sort((a, b) => a.position - b.position)) {
        if (seenName.has(d.driverName)) continue
        seenName.add(d.driverName)
        if (d.position >= 900) {
          ftqEntries.push(d)
        } else if (!seenPos.has(d.position)) {
          seenPos.add(d.position)
          qualEntries.push(d)
        }
      }

      const maxQualPos = qualEntries.length > 0
        ? Math.max(...qualEntries.map(d => d.position)) : 40
      const ftqFixed = ftqEntries.map((d, i) => ({ ...d, position: maxQualPos + 1 + i }))
      const deduped = [...qualEntries, ...ftqFixed].sort((a, b) => a.position - b.position)

      if (deduped.length === 0) {
        setParseStatus(`No drivers found. First 8 lines: ${allLines.slice(0, 8).join(' | ')}`)
      } else {
        setDrivers(deduped)
        setParseStatus(`Parsed ${deduped.length} drivers Ã¢ÂÂ review below, then upload`)
      }
    } catch (err) {
      setParseStatus(`Error: ${err.message}`)
    } finally {
      setParsing(false)
    }
  }

  async function handleUpload() {
    if (!drivers.length || !qTrack.trim()) return
    setUploading(true)
    setUploadStatus(null)

    try {
      const raceNum = qRaceNum ? parseInt(qRaceNum) : null
      // Use same racing_reference_id format as api/load-qualifying.js so that
      // loading from Racing Reference later overwrites the PDF data cleanly.
      const slug = qTrack.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      const refId = raceNum
        ? `${qYear}-${String(raceNum).padStart(2, '0')}-qual-${qSeries}`
        : `${qYear}-pdf-${slug}-${qSeries}`

      await supabase.from('qualifying_results').delete()
        .eq('racing_reference_id', refId)

      const rows = drivers.map(d => ({
        series: qSeries,
        year: parseInt(qYear),
        race_number: raceNum,
        track_name: qTrack.trim(),
        racing_reference_id: refId,
        driver_name: d.driverName,
        car_number: d.carNumber || null,
        qualifying_position: d.position,
        qualifying_speed: d.speed || null,
      }))

      const { error } = await supabase.from('qualifying_results').insert(rows)
      if (error) throw error

      setUploadStatus({
        type: 'success',
        message: `Loaded ${rows.length} qualifying results for ${qTrack.trim()} ${qYear} (ref: ${refId})`,
      })
      setDrivers([])
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
    } finally {
      setUploading(false)
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
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>
        Load Qualifying Results from PDF
      </h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Upload the official NASCAR.com qualifying results PDF. Extracts position, car #, driver, and speed Ã¢ÂÂ uploads to Supabase.
        If Race # matches an already-loaded Racing Reference session, it will be replaced.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Series</label>
          <select value={qSeries} onChange={e => setQSeries(e.target.value)} style={inputStyle}>
            {SERIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Track Name</label>
          <input type="text" placeholder="e.g. Pocono Raceway" value={qTrack}
            onChange={e => setQTrack(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Year</label>
          <input type="number" value={qYear}
            onChange={e => setQYear(parseInt(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Race # (optional)</label>
          <input type="number" placeholder="e.g. 18" value={qRaceNum}
            onChange={e => setQRaceNum(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ cursor: parsing ? 'wait' : 'pointer', display: 'inline-block' }}>
          <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
            disabled={parsing} onChange={handlePdfSelect} />
          <span style={{
            display: 'inline-block', padding: '7px 20px', borderRadius: 6,
            background: 'var(--accent)', color: '#fff',
            fontWeight: 600, fontSize: '0.8125rem',
            opacity: parsing ? 0.7 : 1, cursor: parsing ? 'wait' : 'pointer',
          }}>
            {parsing ? 'Parsing...' : 'Choose Qualifying PDF'}
          </span>
        </label>
        {parseStatus && (
          <span style={{
            marginLeft: 12, fontSize: '0.78rem',
            color: parseStatus.startsWith('Error') ? '#f87171'
              : parseStatus.startsWith('Parsed') ? '#4ade80'
              : 'var(--text-muted)',
          }}>
            {parseStatus}
          </span>
        )}
      </div>

      {uploadStatus && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.8125rem',
          background: uploadStatus.type === 'success' ? '#145A3220' : '#922B2120',
          border: `1px solid ${uploadStatus.type === 'success' ? '#145A3240' : '#922B2140'}`,
          color: uploadStatus.type === 'success' ? '#27AE60' : '#E74C3C',
        }}>
          {uploadStatus.message}
        </div>
      )}

      {drivers.length > 0 && (
        <div>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                  {['Pos', 'Car', 'Driver', 'Speed'].map(h => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: 'left',
                      color: 'var(--text-secondary)', fontWeight: 600,
                      fontSize: '0.7rem', textTransform: 'uppercase',
                      letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => (
                  <tr key={d.position} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)' }}>
                    <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{d.position}</td>
                    <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>#{d.carNumber}</td>
                    <td style={{ padding: '5px 10px', fontWeight: i < 3 ? 600 : 400 }}>{d.driverName}</td>
                    <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                      {d.speed ? `${d.speed} mph` : <span style={{ color: 'var(--text-muted)' }}>Ã¢ÂÂ</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading || !qTrack.trim()}
              style={{ minWidth: 200, fontSize: '0.8125rem' }}
            >
              {uploading ? 'Uploading...' : `Upload ${drivers.length} results to Supabase`}
            </button>
            {!qTrack.trim() && (
              <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Track name required</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Load New Race (Loop Data) Section â parses pasted Racing Reference HTML client-side
function LoadNewRace() {
  const [lrSeries, setLrSeries] = useState('oreilly')
  const [lrYear, setLrYear] = useState('2026')
  const [lrRaceNum, setLrRaceNum] = useState('')
  const [lrTrackName, setLrTrackName] = useState('')
  const [lrHtml, setLrHtml] = useState('')
  const [lrStatus, setLrStatus] = useState(null)
  const [lrLoading, setLrLoading] = useState(false)

  const seriesCodeMap = { cup: 'W', xfinity: 'B', oreilly: 'B', trucks: 'C' }
  const rrCode = seriesCodeMap[lrSeries] || 'B'
  const rrUrl = lrYear && lrRaceNum
    ? 'https://www.racing-reference.info/loopdata/' + lrYear + '-' + String(lrRaceNum).padStart(2,'0') + '/' + rrCode
    : null

  function textOf(html) {
    return html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(parseInt(n,10))).trim()
  }
  function parseCells(rowHtml) {
    const cells=[]; const re=/<td[^>]*>([\s\S]*?)<\/td>/gi; let m
    while((m=re.exec(rowHtml))!==null) cells.push(textOf(m[1]))
    return cells
  }
  function parseDataRows(html,minCols=17) {
    const rows=[]; const re=/<tr[^>]*>([\s\S]*?)<\/tr>/gi; let m
    while((m=re.exec(html))!==null){const cells=parseCells(m[1]);if(cells.length>=minCols)rows.push(cells)}
    return rows
  }
  function toInt(s){if(!s||s==='--'||s==='-'||s.trim()==='')return null;const n=parseInt(s.replace(/[^0-9-]/g,''),10);return isNaN(n)?null:n}
  function toFloat(s){if(!s||s==='--'||s==='-'||s.trim()==='')return null;const n=parseFloat(s.replace(/[^0-9.-]/g,''));return isNaN(n)?null:n}

  async function handleLoad() {
    if (!lrHtml.trim() || !lrRaceNum) return
    setLrLoading(true); setLrStatus(null)
    try {
      const html = lrHtml
      const year = parseInt(lrYear)
      const raceNumber = parseInt(lrRaceNum)
      const series = lrSeries
      const racingRefId = year + '-' + String(raceNumber).padStart(2,'0') + '-' + rrCode

      // Parse track name
      let trackName = null
      const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleM) {
        let t = titleM[1].replace(/\s*[|\u2013-].*Racing Reference.*/i,'').replace(/^\d{4}\s+/,'').replace(/\s*Loop\s*Data\s*$/i,'').trim()
        if (t.length > 2) trackName = t
      }
      if (!trackName) { const h1M=html.match(/<h1[^>]*>([^<]+)<\/h1>/i); if(h1M){const t=textOf(h1M[1]).replace(/\d{4}/,'').replace(/Loop\s*Data/i,'').trim();if(t.length>2)trackName=t} }
      if (!trackName) trackName = 'Race ' + raceNumber + ' ' + year
      if (lrTrackName.trim()) trackName = lrTrackName.trim()

      // Parse driver rows
      const allRows = parseDataRows(html, 17)
      const driverRows = allRows.filter(cells => {
        const first = (cells[0]||'').trim()
        return first.length>0 && first.toLowerCase()!=='driver' && /[A-Za-z]/.test(first) && !/^(pos|place|rank)/i.test(first)
      })
      if (driverRows.length === 0) {
        setLrStatus({ ok: false, message: 'No driver data found. Make sure you pasted the full Racing Reference page source (Ctrl+U â Ctrl+A â Ctrl+C).' })
        setLrLoading(false); return
      }

      // Check for existing race
      const { data: existing } = await supabase.from('races').select('id,track_name').eq('racing_reference_id', racingRefId).maybeSingle()
      if (existing) { setLrStatus({ ok: false, message: 'Already loaded: ' + existing.track_name + ' ' + year + ' (' + racingRefId + ')' }); setLrLoading(false); return }

      // Find winner + total laps
      let winningDriver=null, totalLaps=0
      for(const row of driverRows){ const f=toInt(row[3]),l=toInt(row[17]); if(f===1&&!winningDriver)winningDriver=row[0]; if(l&&l>totalLaps)totalLaps=l }

      // Insert race record
      const { data: raceRec, error: raceErr } = await supabase.from('races').insert({
        racing_reference_id: racingRefId, race_name: trackName+' '+year,
        track_name: trackName, year, race_number: raceNumber,
        series, winning_driver: winningDriver, total_laps: totalLaps||null,
        racing_reference_url: rrUrl||''
      }).select('id').single()
      if (raceErr) { setLrStatus({ ok: false, message: 'Race insert failed: '+raceErr.message }); setLrLoading(false); return }

      // Insert loop_data rows
      let inserted=0; const errorLog=[]
      for(const row of driverRows){
        const driverName=(row[0]||'').trim(); if(!driverName)continue
        const lapsComp=toInt(row[17]), finishPos=toInt(row[3])
        const finishStatus=(lapsComp!=null&&totalLaps>0&&lapsComp<totalLaps*0.9)?'dnf':'running'
        const { error } = await supabase.from('loop_data').insert({
          race_id: raceRec.id, driver_name: driverName, series, year, track_name: trackName,
          start_position: toInt(row[1]), mid_race_position: toInt(row[2]), finish_position: finishPos,
          high_position: toInt(row[4]), low_position: toInt(row[5]), avg_position: toFloat(row[6]),
          pass_diff: toInt(row[7]), green_flag_passes: toInt(row[8]), green_flag_times_passed: toInt(row[9]),
          quality_passes: toInt(row[10]), pct_quality_passes: toFloat(row[11]), fastest_laps: toInt(row[12]),
          top15_laps: toInt(row[13]), pct_top15_laps: toFloat(row[14]), laps_led: toInt(row[15]),
          pct_laps_led: toFloat(row[16]), laps_completed: lapsComp, driver_rating: toFloat(row[18]),
          finish_status: finishStatus,
        })
        if(error) errorLog.push(driverName+': '+error.message); else inserted++
      }
      setLrStatus({ ok: true, message: 'Loaded '+inserted+' drivers for '+trackName+' '+year+(errorLog.length?' ('+errorLog.length+' errors: '+errorLog.slice(0,3).join(', ')+')':'') })
      if (inserted > 0) setLrHtml('')
    } catch(e) { setLrStatus({ ok: false, message: e.message }) }
    setLrLoading(false)
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Load Loop Data</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
        Racing Reference blocks server requests. Instead: fill in Series/Year/Race#, click the link, then on that page press <strong>Ctrl+U</strong> (view source) â <strong>Ctrl+A</strong> â <strong>Ctrl+C</strong>, and paste below.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Series</label>
          <select value={lrSeries} onChange={e => setLrSeries(e.target.value)} className="input" style={{ width: 160 }}>
            {SERIES_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Year</label>
          <input className="input" style={{ width: 80 }} type="number" value={lrYear} onChange={e => setLrYear(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Race #</label>
          <input className="input" style={{ width: 80 }} type="number" placeholder="e.g. 17" value={lrRaceNum} onChange={e => setLrRaceNum(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Track Name (override)</label>
          <input className="input" style={{ width: '100%' }} type="text" placeholder="e.g. Pocono Raceway" value={lrTrackName} onChange={e => setLrTrackName(e.target.value)} />
        </div>
      </div>
      {rrUrl && (
        <p style={{ fontSize: '0.8rem', marginBottom: 10 }}>
          Step 1 â open this URL: <a href={rrUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{rrUrl}</a>
        </p>
      )}
      <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
        Step 2 â Paste Page Source Here (Ctrl+U â Ctrl+A â Ctrl+C)
      </label>
      <textarea
        value={lrHtml}
        onChange={e => setLrHtml(e.target.value)}
        placeholder="Paste the full Racing Reference page source here..."
        rows={5}
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', resize: 'vertical' }}
      />
      <button className="btn btn-primary" onClick={handleLoad} disabled={lrLoading || !lrHtml.trim() || !lrRaceNum} style={{ marginTop: 10, minWidth: 140 }}>
        {lrLoading ? 'Loading...' : 'Load Loop Data'}
      </button>
      {lrStatus && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 6, fontSize: '0.8rem',
          background: lrStatus.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${lrStatus.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: lrStatus.ok ? '#10b981' : '#ef4444',
        }}>
          {lrStatus.message}
        </div>
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
        longest_stint: d.longestStint ?? d.longestStintLen ?? null,
        practice_score: d.composite,
        practice_grade: d.grade,
        notes: d.notes || null,
      }))

      const { error: insertError } = await supabase.from('practice_sessions').insert(rows)
      if (insertError) throw insertError

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
          for (let i = 0; i < lapRows.length; i += 500) {
            const batch = lapRows.slice(i, i + 500)
            const { error: lapErr } = await supabase.from('practice_laps').insert(batch)
            if (lapErr) throw lapErr
          }
        }
      } catch (lapTableErr) {
        setUploadStatus({ type: 'error', message: 'Grades saved, but lap-by-lap insert failed: ' + lapTableErr.message })
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
        <p className="page-subtitle">Upload practice data & configure featured weekends</p>
      </div>

      <WeekendConfig />
      <EntryListManager />
      <LoadQualifyingPdf />

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
            Practice Excel File Ã¢ÂÂ optional columns: Car # and Group (A/B)
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
              Parsed {preview.parsed.totalDrivers} drivers from sheet "{preview.parsed.sheetName}" Ã¢ÂÂ ready to grade and upload
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

      <LoadNewRace />
      </div>
    </div>
  )
}
