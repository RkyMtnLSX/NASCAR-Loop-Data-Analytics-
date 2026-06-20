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
          let drv = ne[i+1] ? cleanName(ne[i+1]) : ''
          const isMfrOrInd = n => /^\([a-zA-Z]\)$/.test(n) || /^(chevrolet|chevy|ford|toyota|tundra|silverado|f-?150|ram|dodge)/i.test(n)
          const isTeamName = t => /racing|motorsports|motor|penske|hendrick|gibbs|23xi|rfk|kaulig|haas|wood|trackhouse|spire|hyak|club|legacy|front row|ware/i.test(t)
          let org
          if (series === 'trucks') {
            org = ne[i+2] ? ne[i+2].trim() : ''
          } else {
            const rawOrg = ne[i+2] ? ne[i+2].trim() : ''
            // Detect surname continuation: PDF wraps "John Hunter" / "Nemechek" across lines
            const isSurnameSuffix = !isMfrOrInd(rawOrg) && /^[A-Z][a-z]/.test(rawOrg) && !rawOrg.includes(' ') && ne[i+3] && isTeamName(ne[i+3])
            if (isSurnameSuffix) {
              drv = drv + ' ' + rawOrg
              org = ne[i+3] ? ne[i+3].trim() : ''
            } else {
              org = isMfrOrInd(rawOrg) ? (ne[i+3] ? ne[i+3].trim() : '') : rawOrg
            }
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

// -- Qualifying Simulation Config ----------------------------------------------
function QualSimConfig() {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    supabase.from('qual_sim_config').select('*').eq('series', 'cup').single()
      .then(({ data }) => { if (data) setCfg(data) })
  }, [])

  function update(field, value) {
    setCfg(p => ({ ...p, [field]: value }))
  }

  function toggleYear(yr) {
    const current = cfg?.sim_corr_years || []
    const next = current.includes(yr)
      ? current.filter(y => y !== yr)
      : [...current, yr].sort()
    update('sim_corr_years', next)
  }

  async function save() {
    setSaving(true); setStatus(null)
    const { error } = await supabase.from('qual_sim_config').upsert({
      series: 'cup',
      show_sim: cfg.show_sim || false,
      sim_corr_years: cfg.sim_corr_years || [],
      nudge_oval: parseFloat(cfg.nudge_oval) || 0,
      nudge_short_track: parseFloat(cfg.nudge_short_track) || 0,
      nudge_superspeedway: parseFloat(cfg.nudge_superspeedway) || 0,
      nudge_road: parseFloat(cfg.nudge_road) || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'series' })
    setSaving(false)
    setStatus(error ? { type: 'error', msg: error.message } : { type: 'success', msg: 'Saved!' })
  }

  const labelSt = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }
  const inputSt = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.875rem' }
  const NUDGE_FORMATS = [
    { key: 'nudge_oval', label: 'Oval' },
    { key: 'nudge_short_track', label: 'Short Track' },
    { key: 'nudge_superspeedway', label: 'Superspeedway' },
    { key: 'nudge_road', label: 'Road Course' },
  ]

  if (!cfg) return null

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Qualifying Simulation -- Cup Series</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <input
          type="checkbox"
          checked={!!cfg.show_sim}
          onChange={e => update('show_sim', e.target.checked)}
          id="show-sim-toggle"
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <label htmlFor="show-sim-toggle" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          Show simulation on Qualifying Center
        </label>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelSt}>Correlated Track Years for Sim</label>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          When no same-track history exists, these correlated track years feed into each driver's projected positions.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_YEARS.map(yr => {
            const checked = (cfg.sim_corr_years || []).includes(yr)
            return (
              <button key={yr} onClick={() => toggleYear(yr)} style={{
                padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                background: checked ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)',
                color: checked ? 'var(--accent)' : 'var(--text-secondary)',
              }}>{yr}</button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelSt}>Draw Position Nudge (std dev floor per format)</label>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          Higher = more spread to reflect draw luck. Road course = 0 (group qualifying, draw irrelevant). Oval default ~3.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {NUDGE_FORMATS.map(({ key, label }) => (
            <div key={key}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                value={cfg[key] ?? 0}
                onChange={e => update(key, parseFloat(e.target.value) || 0)}
                style={inputSt}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ fontSize: '0.8rem', padding: '6px 18px' }}>
          {saving ? 'Saving...' : 'Save Sim Config'}
        </button>
        {status && (
          <span style={{ fontSize: '0.8rem', color: status.type === 'success' ? '#22c55e' : '#ef4444' }}>{status.msg}</span>
        )}
      </div>
    </div>
  )
}


// Load New Race
function LoadNewRace() {
  const [series, setSeries] = React.useState('cup')
  const [year, setYear] = React.useState(new Date().getFullYear())
  const [raceNumber, setRaceNumber] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState(null)

  async function handleLoad() {
    if (!raceNumber) return
    setLoading(true)
    setStatus(null)
    try {
      const resp = await fetch('/api/load-race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, year: parseInt(year), raceNumber: parseInt(raceNumber) }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed')
      setStatus({ type: 'success', msg: data.message })
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    fontSize: '0.825rem', fontFamily: 'var(--font-sans)',
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Load New Race</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Fetch loop data from Racing Reference and store in Supabase.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inp}>
            {SERIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} style={{ ...inp, width: 80 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Race #</label>
          <input type="number" placeholder="e.g. 14" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} style={{ ...inp, width: 80 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleLoad} disabled={loading || !raceNumber} style={{ fontSize: '0.8125rem' }}>
            {loading ? 'Loading...' : 'Load Race'}
          </button>
        </div>
      </div>
      {status && (
        <div style={{ fontSize: '0.8125rem', color: status.type === 'success' ? '#22c55e' : '#ef4444', padding: '8px 12px', borderRadius: 6, background: status.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: '1px solid ' + (status.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)') }}>
          {status.msg}
        </div>
      )}
    </div>
  )
}

// Load Qualifying Results
function LoadQualifying() {
  const SERIES_CODES = { cup: 'W', oreilly: 'B', trucks: 'C' }
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState(new Date().getFullYear())
  const [raceNumber, setRaceNumber] = useState('')
  const [trackName, setTrackName] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  function getRacingRefUrl() {
    if (!year || !raceNumber) return null
    const padded = String(raceNumber).padStart(2, '0')
    const code = SERIES_CODES[series] || 'W'
    return `https://www.racing-reference.info/qual-results/${year}-${padded}/${code}`
  }

  function parseText(text) {
    const drivers = []
    for (const line of text.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) continue
      const rank = parseInt(parts[0])
      if (isNaN(rank) || rank < 1 || rank > 99) continue
      const speed = parseFloat(parts[parts.length - 1])
      if (isNaN(speed) || speed < 50 || speed > 350) continue
      const lapTime = parts[parts.length - 2]
      if (!/^\d+:\d{2}\.\d+$/.test(lapTime)) continue
      const carNumber = parts[parts.length - 4]
      if (!/^\d{1,3}$/.test(carNumber)) continue
      const driverName = parts.slice(1, parts.length - 4).join(' ')
      if (!driverName || driverName.length < 2) continue
      drivers.push({ rank, driverName, carNumber, speed })
    }
    return drivers
  }

  function handleTextChange(text) {
    setPastedText(text)
    setStatus(null)
    if (text.trim()) {
      const drivers = parseText(text)
      setPreview(drivers.length > 0 ? drivers : null)
      if (drivers.length === 0) setStatus({ type: 'error', msg: 'No qualifying rows found — make sure you Ctrl+A / Ctrl+C the full Racing Reference page' })
    } else {
      setPreview(null)
    }
  }

  async function handleLoad() {
    if (!preview || !trackName || !raceNumber) return
    setLoading(true)
    setStatus(null)
    try {
      const racingRefId = `${year}-${String(raceNumber).padStart(2,'0')}-qual-${series}`
      await supabase.from('qualifying_results').delete().eq('racing_reference_id', racingRefId)
      const rows = preview.map(d => ({
        series,
        year: parseInt(year),
        race_number: parseInt(raceNumber),
        track_name: trackName,
        racing_reference_id: racingRefId,
        driver_name: d.driverName,
        car_number: d.carNumber || null,
        qualifying_position: d.rank,
        qualifying_speed: d.speed || null,
      }))
      const { error } = await supabase.from('qualifying_results').insert(rows)
      if (error) throw error
      setStatus({ type: 'success', msg: `Loaded ${rows.length} drivers for ${trackName} ${year}. Pole: ${preview[0].driverName} (${preview[0].speed} mph)` })
      setPastedText('')
      setPreview(null)
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  const url = getRacingRefUrl()
  const inp = { width: '100%', padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none' }
  const lbl = { display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Load Qualifying Results</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Go to Racing Reference, press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong>, then paste below.
        {url && <> <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginLeft: 6 }}>Open Racing Reference ↗</a></>}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inp}>
            {SERIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={inp} />
        </div>
        <div>
          <label style={lbl}>Race #</label>
          <input type="number" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} placeholder="e.g. 16" style={inp} />
        </div>
        <div>
          <label style={lbl}>Track Name</label>
          <input type="text" value={trackName} onChange={e => setTrackName(e.target.value)} placeholder="e.g. Autodromo Hermanos Rodriguez" style={inp} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Paste Racing Reference Page (Ctrl+A, Ctrl+C on the qual-results page)</label>
        <textarea
          value={pastedText}
          onChange={e => handleTextChange(e.target.value)}
          rows={6}
          placeholder={"Paste the full Racing Reference qualifying page here...\n\nExample line:\n1  Shane Van Gisbergen  88  Chevrolet  1:32.776  93.904"}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.78rem', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {preview && preview.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: 8 }}>
            Parsed {preview.length} drivers — Pole: {preview[0].driverName} ({preview[0].speed} mph)
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Pos','#','Driver','Speed'].map(h => <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((d, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)' }}>
                    <td style={{ padding: '4px 10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{d.rank}</td>
                    <td style={{ padding: '4px 10px', fontFamily: 'monospace' }}>{d.carNumber}</td>
                    <td style={{ padding: '4px 10px' }}>{d.driverName}</td>
                    <td style={{ padding: '4px 10px', fontFamily: 'monospace' }}>{d.speed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {status && (
        <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: '0.8rem', background: status.type === 'success' ? '#14532d20' : '#7f1d1d20', border: `1px solid ${status.type === 'success' ? '#14532d40' : '#7f1d1d40'}`, color: status.type === 'success' ? '#22c55e' : '#f87171' }}>
          {status.msg}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleLoad}
        disabled={loading || !preview || !trackName || !raceNumber}
        style={{ minWidth: 140, fontSize: '0.8125rem' }}
      >
        {loading ? 'Saving...' : `Load ${preview ? preview.length + ' Drivers' : 'Qualifying'}`}
      </button>
    </div>
  )
}


async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function parseSource(text) {
  const rows = []
  for (const line of text.split('\n')) {
    const clean = line.trim().replace(/\*/g, '').trim()
    if (!clean) continue
    // Jayski format: line starts with draw number, then optional car#, then driver name
    // e.g. "1 Ryan Blaney" or "1 12 Ryan Blaney" or "1. Ryan Blaney #12 Team Penske"
    const m = clean.match(/^(\d{1,2})[.\s]+(?:#?(\d{1,3})[.\s]+)?([A-Z][A-Za-z]+(?: [A-Za-z]+){1,3})/)
    if (!m) continue
    const draw = parseInt(m[1])
    if (isNaN(draw) || draw < 1 || draw > 70) continue
    const name = m[3].trim()
    if (name.length < 4) continue
    rows.push({ draw_order: draw, driver_name: name })
  }
  // Deduplicate by draw_order (keep first)
  const seen = new Set()
  return rows.filter(r => { if (seen.has(r.draw_order)) return false; seen.add(r.draw_order); return true })
}

function LoadQualifyingOrder() {
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState(new Date().getFullYear())
  const [trackName, setTrackName] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rawText, setRawText] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  async function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(null)
    setStatus({ type: 'info', msg: 'Parsing PDF...' })
    try {
      const pdfjs = await loadPdfJs()
      const arrayBuf = await f.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise
      let fullText = ''
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const content = await page.getTextContent()
        // Group text items by Y coordinate to reconstruct lines
        const byY = {}
        for (const item of content.items) {
          const y = Math.round(item.transform[5])
          if (!byY[y]) byY[y] = []
          byY[y].push(item.str)
        }
        const lines = Object.keys(byY).map(Number).sort((a, b) => b - a)
          .map(y => byY[y].join(' ').trim()).filter(l => l)
        fullText += lines.join('\n') + '\n'
      }
      setRawText(fullText)
      const rows = parseSource(fullText)
      if (rows.length === 0) throw new Error('No draw order rows found. Check PDF format.')
      setPreview(rows)
      setStatus(null)
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
      setPreview(null)
    }
  }

  async function handleSave() {
    if (!preview || !trackName || !year) return
    setLoading(true)
    setStatus(null)
    try {
      const records = preview.map(r => ({
        series,
        year: parseInt(year),
        track_name: trackName,
        driver_name: r.driver_name,
        draw_order: r.draw_order,
      }))
      const { error } = await supabase
        .from('qualifying_results')
        .upsert(records, { onConflict: 'series,year,track_name,driver_name' })
      if (error) throw error
      setStatus({ type: 'success', msg: `Saved draw order for ${records.length} drivers.` })
      setFile(null)
      setPreview(null)
    } catch (e) {
      setStatus({ type: 'error', msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 600 }}>Load Qualifying Order (Jayski PDF)</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={series} onChange={e => setSeries(e.target.value)} style={{ fontSize: '0.875rem' }}>
          <option value="cup">Cup</option>
          <option value="oreilly">O'Reilly</option>
          <option value="trucks">Trucks</option>
        </select>
        <input type="number" placeholder="Year" value={year} onChange={e => setYear(e.target.value)}
          style={{ width: 80, fontSize: '0.875rem' }} />
        <input type="text" placeholder="Track name (exact)" value={trackName} onChange={e => setTrackName(e.target.value)}
          style={{ minWidth: 220, fontSize: '0.875rem' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Upload Jayski qualifying draw order PDF:
        </label>
        <input type="file" accept=".pdf" onChange={handleFileChange} style={{ fontSize: '0.8125rem' }} />
      </div>
      {status && (
        <div style={{ marginBottom: 8, fontSize: '0.8125rem',
          color: status.type === 'success' ? 'var(--success)' : status.type === 'error' ? 'var(--error)' : 'var(--text-muted)' }}>
          {status.msg}
        </div>
      )}
      {status && status.type === 'error' && rawText && (
        <details style={{ marginBottom: 8 }}>
          <summary style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Show raw extracted text (for debugging)</summary>
          <textarea readOnly rows={10} value={rawText.slice(0, 3000)}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.72rem', marginTop: 4, boxSizing: 'border-box' }} />
        </details>
      )}
      {preview && (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxHeight: 160, overflowY: 'auto', marginBottom: 8, fontFamily: 'monospace' }}>
            {preview.map((r, i) => <div key={i}>{r.draw_order}. {r.driver_name}</div>)}
          </div>
          <button onClick={handleSave} disabled={loading || !trackName}
            style={{ fontSize: '0.8125rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
            {loading ? 'Saving...' : `Save ${preview.length} Draw Orders`}
          </button>
        </>
      )}
    </div>
  )
}


function LoadFastestLaps() {
  const [year, setYear] = React.useState(new Date().getFullYear())
  const [trackType, setTrackType] = React.useState('')
  const [raceName, setRaceName] = React.useState('')
  const [raceDate, setRaceDate] = React.useState('')
  const [track, setTrack] = React.useState('')
  const [csvText, setCsvText] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState(null)

  function parseRows(text) {
    return text.trim().split('\n').filter(l => l.trim()).map(function(line) {
      const parts = line.split(',').map(function(p) { return p.trim() })
      return {
        driver: parts[0] || '',
        car: parts[1] || null,
        fastest_lap_num: parts[2] || null,
        fastest_time: parts[3] || null,
        fastest_speed: parts[4] || null,
        start_pos: parts[5] || null,
        finish_pos: parts[6] || null,
        status: parts[7] || null,
      }
    })
  }

  async function handleLoad() {
    if (!raceName || !raceDate || !track || !csvText.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const rows = parseRows(csvText)
      const resp = await fetch('/api/load-fastest-laps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year), track_type: trackType || null, race_name: raceName, race_date: raceDate, track, rows }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed')
      setStatus({ type: 'success', msg: data.message })
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    fontSize: '0.825rem', fontFamily: 'var(--font-sans)',
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Load Fastest Laps</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Paste fastest lap data from Lap Raptor (CSV: driver, car, lap#, time, speed, start, finish, status).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Track Type</label>
          <input type="text" placeholder="e.g. oval" value={trackType} onChange={e => setTrackType(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Race Name</label>
          <input type="text" placeholder="e.g. Pocono 400" value={raceName} onChange={e => setRaceName(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Race Date</label>
          <input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Track</label>
          <input type="text" placeholder="e.g. Pocono Raceway" value={track} onChange={e => setTrack(e.target.value)} style={inp} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>
          CSV Data (driver, car#, lap#, time, speed, start, finish, status)
        </label>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8}
          placeholder="Kyle Larson,5,312,28.456,189.2,1,1,Running"
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
      <button className="btn btn-primary" onClick={handleLoad} disabled={loading || !raceName || !raceDate || !track || !csvText.trim()} style={{ fontSize: '0.8125rem' }}>
        {loading ? 'Loading...' : 'Load Fastest Laps'}
      </button>
      {status && (
        <div style={{ marginTop: 10, fontSize: '0.8125rem', color: status.type === 'success' ? '#22c55e' : '#ef4444', padding: '8px 12px', borderRadius: 6, background: status.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: '1px solid ' + (status.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)') }}>
          {status.msg}
        </div>
      )}
    </div>
  )
}


// ============================================================
// Sim Center Formula Panel — read-only reference for Admin
// ============================================================
function SimFormulaPanel() {
  const ovalW = [
    ['Corr. History',  '30%'],
    ['Long Run Pace',  '25%'],
    ['Short Run Pace', '15%'],
    ['Start Position', '15%'],
    ['Tire Falloff',   '10%'],
    ['Race Craft',      '5%'],
  ]
  const rcW = [
    ['Corr. History',  '40%'],
    ['Long Run Pace',  '15%'],
    ['Short Run Pace', '15%'],
    ['Start Position', '10%'],
    ['Tire Falloff',   '10%'],
    ['Race Craft',     '10%'],
  ]
  const factors = [
    ['Corr. History',  'driver_ratings + avg_finish at correlated tracks, year-weighted. Blended 70% rating / 30% finish score. Confidence = min(1, nRaces / 4).'],
    ['Long Run Pace',  'overall_avg from practice_sessions — all laps across all stints, any lap >8% slower than session median dropped (V5.1). Lower is better.'],
    ['Short Run Pace', 'late_run_avg from practice_sessions — short-stint laps, mock-qual stints excluded. Lower is better.'],
    ['Start Position', 'qualifying_position from practice_sessions (placeholder until qual runs). Lower is better.'],
    ['Tire Falloff',   'trend_slope from practice_sessions — lap-time slope vs lap # in longest stint (min 10 laps required, else null → 50). Lower is better.'],
    ['Race Craft',     'Avg quality pass % (pct_quality_passes) from loop_data at correlated tracks, year-weighted (2026 = 3x, 2025 = 2x, older = 1x). Higher is better.'],
  ]
  const yearW = [
    ['2026', '2.0x'],
    ['2025', '1.2x'],
    ['2024', '1.0x'],
    ['2023', '0.8x'],
    ['2022-', '0.6x'],
  ]
  const cell  = { padding: '4px 10px', fontSize: '0.78125rem', borderBottom: '1px solid var(--border-color)' }
  const hd    = { ...cell, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }
  const tbl   = { borderCollapse: 'collapse', width: '100%' }
  const label = { fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Sim Center Formula</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Read-only reference — current weights and data sources used by Race Simulation.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={label}>Oval Weights</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Factor</th><th style={{ ...hd, textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
              {ovalW.map(([f, w]) => (
                <tr key={f}><td style={cell}>{f}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={label}>Road Course Weights</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Factor</th><th style={{ ...hd, textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
              {rcW.map(([f, w]) => (
                <tr key={f}><td style={cell}>{f}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={label}>Year Weights (Corr. History)</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Year</th><th style={{ ...hd, textAlign: 'right' }}>Mult.</th></tr></thead>
            <tbody>
              {yearW.map(([y, m]) => (
                <tr key={y}><td style={cell}>{y}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={label}>Factor Definitions</div>
      <table style={tbl}>
        <thead><tr><th style={{ ...hd, width: 130 }}>Factor</th><th style={hd}>Source &amp; Logic</th></tr></thead>
        <tbody>
          {factors.map(([f, desc]) => (
            <tr key={f}>
              <td style={{ ...cell, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{f}</td>
              <td style={{ ...cell, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
        All factors are field-normalized 0-100 before weighting. Drivers missing data default to 50 (neutral).
        Road course auto-detected by track name — weights switch automatically in Simulation Center.
      </p>
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
        // practice_laps table may not exist yet -- don't fail the whole upload
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
        <p className="page-subtitle">Upload practice data &amp; configure featured weekends</p>
      </div>

      <WeekendConfig />
      <QualSimConfig />
      <EntryListManager />
      <LoadNewRace />
      <LoadQualifying />
      <LoadQualifyingOrder />
      <LoadFastestLaps />
      <SimFormulaPanel />
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Data Audit</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Review qualifying data loaded per race and track.
        </p>
        <a href="/loop-audit" style={{ color: '#f59e0b', fontSize: '0.875rem', textDecoration: 'none' }}>
          Open Loop Data Audit
        </a>
      </div>

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
            Practice Excel File -- optional columns: Car # and Group (A/B)
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
              Parsed {preview.parsed.totalDrivers} drivers from sheet "{preview.parsed.sheetName}" -- ready to grade and upload
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
