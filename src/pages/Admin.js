import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { parsePracticeExcel } from '../lib/excelParser'
import { gradePracticeSession } from '../lib/practiceGrader'
import SimulationCenter, { DEFAULT_WEIGHTS, ROAD_COURSE_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, TRUCK_ROAD_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } from './SimulationCenter'
import GradeCenter from './GradeCenter'

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

function normMfr(t){ var s=(t||'').toString().toLowerCase(); if(/chevrolet|chevy|\bchv\b|camaro|silverado/.test(s)) return 'Chevrolet'; if(/toyota|camry|tundra|\btyt\b|\btoy\b/.test(s)) return 'Toyota'; if(/\bford\b|mustang|f-?150|\bfd\b/.test(s)) return 'Ford'; if(/\bram\b|dodge/.test(s)) return 'Ram'; return ''; }

function EntryListManager() {
  const [series, setSeries] = React.useState('cup')
  const [cfg, setCfg] = React.useState(null)
  const [entries, setEntries] = React.useState([])
  const [newCar, setNewCar] = React.useState('')
  const [newDriver, setNewDriver] = React.useState('')
  const [newOrg, setNewOrg] = React.useState('')
  const [newMfr, setNewMfr] = React.useState('')
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
            const carNum = (+s >= 101 && +s <= 199) ? String(+s - 100) : s
            var mfr = ''; for (var mk = i + 2; mk < ne.length && mk <= i + 6; mk++) { if (/^\d{1,3}$/.test((ne[mk] || '').trim())) break; var mm = normMfr(ne[mk]); if (mm) { mfr = mm; break; } } rows.push(carNum + ',' + drv + ',' + org + ',' + mfr)
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
        manufacturer: normMfr(newMfr) || null,
    })
    if (error) { showStatus('Error: ' + error.message, true); return }
    setNewCar(''); setNewDriver(''); setNewOrg(''); setNewMfr('')
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
          manufacturer: normMfr(parts[3]) || null,
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
        <select value={newMfr} onChange={e => setNewMfr(e.target.value)} style={{ ...inp, width: 120 }}><option value="">Mfr</option><option value="Chevrolet">Chevrolet</option><option value="Ford">Ford</option><option value="Toyota">Toyota</option><option value="Ram">Ram</option></select>
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
              placeholder={"12, Ryan Blaney, Team Penske, Ford\n5, Kyle Larson, Hendrick Motorsports, Chevrolet"}
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
                {['#','Driver','Organization','Mfr',''].map((h, i) => (
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
                  <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{e.organization || ''}</td><td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{e.manufacturer || '-'}</td>
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
  const [series, setSeries]     = useState('cup')
  const [year, setYear]         = useState(new Date().getFullYear().toString())
  const [raceNum, setRaceNum]   = useState('')
  const [pasteText, setPasteText] = useState('')
  const [status, setStatus]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [raceDate, setRaceDate]   = useState('')
  const [selTrack, setSelTrack] = useState('')
  const [tracks, setTracks] = useState([])
  useEffect(() => { supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name))) }, [])

  const NAME_MAP = {
    'John H. Nemechek':      'John Hunter Nemechek',
    'Baltazar Leguizamon':   'Baltazar Leguizam - n',
    'Daniel Suarez':         'Daniel Su - rez',
    'A.J. Allmendinger':     'AJ Allmendinger',
    'Christopher Bell Jr':   'Christopher Bell',
  }
  // Last-name-only fallback for drivers Racing Reference abbreviates inconsistently
  const NAME_LAST = [
    { key: 'Nemechek',    val: 'John Hunter Nemechek' },
    { key: 'Leguizamon',  val: 'Baltazar Leguizam - n' },
    { key: 'Su - rez',      val: 'Daniel Su - rez' },
    { key: 'Suarez',      val: 'Daniel Su - rez' },
  ]
  function normalizeDriverName(name) {
    if (NAME_MAP[name]) return NAME_MAP[name]
    for (const { key, val } of NAME_LAST) {
      if (name.includes(key)) return val
    }
    return name
  }
  function parseLoopData(text) {
    const atMatch = text.match(/\bat\s+([A-Z][^,\n(]+)/)
    const trackName = atMatch ? atMatch[1].trim() : ('Race ' + raceNum + ' ' + year)
    const lapsMatch = text.match(/(\d+)\s+laps?\*/i)
    const expectedLaps = lapsMatch ? parseInt(lapsMatch[1]) : 0
    const driverRowRe = /^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s*$/gm
    const rows = []
    let m
    while ((m = driverRowRe.exec(text)) !== null) {
      rows.push({
        driver_name: normalizeDriverName(m[1].trim()),
        start_position: parseInt(m[2]), mid_race_position: parseInt(m[3]),
        finish_position: parseInt(m[4]), high_position: parseInt(m[5]),
        low_position: parseInt(m[6]), avg_position: parseFloat(m[7]),
        pass_diff: parseInt(m[8]), green_flag_passes: parseInt(m[9]),
        green_flag_times_passed: parseInt(m[10]), quality_passes: parseInt(m[11]),
        pct_quality_passes: parseFloat(m[12]), fastest_laps: parseInt(m[13]),
        top15_laps: parseInt(m[14]), pct_top15_laps: parseFloat(m[15]),
        laps_led: parseInt(m[16]), pct_laps_led: parseFloat(m[17]),
        laps_completed: parseInt(m[18]), driver_rating: parseFloat(m[19]),
      })
    }
    const __cautM = text.match(/Cautions:\s*(\d+)\s+for\s+(\d+)/i)
  const __leadM = text.match(/Lead changes:\s*(\d+)/i)
  const __spdM = text.match(/Average speed:\s*([\d.]+)/i)
  const __gfpM = text.match(/Green flag passes:\s*([\d,]+)/i)
  const __movM = text.match(/Margin of victory:\s*([\d.]+)/i)
  return { trackName, expectedLaps, rows, totalCautions: __cautM ? parseInt(__cautM[1]) : null, totalCautionLaps: __cautM ? parseInt(__cautM[2]) : null, leadChanges: __leadM ? parseInt(__leadM[1]) : null, avgSpeed: __spdM ? parseFloat(__spdM[1]) : null, greenFlagPasses: __gfpM ? parseInt(__gfpM[1].replace(/,/g, '')) : null, marginOfVictory: __movM ? parseFloat(__movM[1]) : null }
  }

  async function handleLoad() {
    if (!pasteText.trim()) return setStatus({ error: 'Paste the Racing Reference loop data page first.' })
    if (!raceNum) return setStatus({ error: 'Enter a race number.' })
    setLoading(true)
    setStatus(null)
    try {
      const { trackName: parsedTrack, expectedLaps, rows, totalCautions, totalCautionLaps, leadChanges, avgSpeed, greenFlagPasses, marginOfVictory } = parseLoopData(pasteText); const trackName = selTrack || parsedTrack
      if (rows.length === 0) return setStatus({ error: 'No driver rows found. Make sure you copied the full page (Ctrl+A, Ctrl+C).' })
      const seriesCodeMap = { cup: 'W', oreilly: 'B', xfinity: 'B', trucks: 'C', truck: 'C' }
      const racingRefId = year + '-' + String(raceNum).padStart(2,'0') + '-' + (seriesCodeMap[series] || 'W')
      const { data: existing } = await supabase.from('races').select('id,track_name').eq('racing_reference_id', racingRefId).maybeSingle()
      if (existing) return setStatus({ error: 'Already loaded: ' + existing.track_name + ' ' + year + ' (' + racingRefId + ')' })
      const totalLaps = expectedLaps || Math.max(...rows.map(r => r.laps_completed || 0))
      const winner = rows.find(r => r.finish_position === 1)?.driver_name || null
      const { data: raceRecord, error: raceErr } = await supabase.from('races').insert({
        racing_reference_id: racingRefId,
        race_name: trackName + ' ' + year,
        track_name: trackName,
        year: parseInt(year),
        race_number: parseInt(raceNum),
        series,
        winning_driver: winner,
        total_laps: totalLaps || null,
        total_cautions: totalCautions,
        total_caution_laps: totalCautionLaps,
        lead_changes: leadChanges,
        avg_speed: avgSpeed,
        green_flag_passes: greenFlagPasses,
        margin_of_victory: marginOfVictory,
        racing_reference_url: 'https://www.racing-reference.info/loopdata/' + year + '-' + String(raceNum).padStart(2,'0') + '/' + (seriesCodeMap[series] || 'W'),
        race_date: raceDate || null,
      }).select('id').single()
      if (raceErr) return setStatus({ error: 'Race insert failed: ' + raceErr.message })
      const raceId = raceRecord.id
      let inserted = 0
      const errors = []
      const { count: priorCount } = await supabase.from('races').select('id', { count: 'exact', head: true }).eq('track_name', trackName).eq('year', parseInt(year)).eq('series', series).neq('id', raceId)
      const trackRaceNum = (priorCount || 0) + 1
      for (const row of rows) {
        await supabase.from('drivers').upsert({ name: row.driver_name, series }, { onConflict: 'name,series', ignoreDuplicates: true })
        const finishStatus = (row.laps_completed && totalLaps && row.laps_completed < totalLaps * 0.9) ? 'dnf' : 'running'
        const { error } = await supabase.from('loop_data').insert({
          race_id: raceId, driver_name: row.driver_name, series,
          race_number: trackRaceNum,
          year: parseInt(year), track_name: trackName,
          start_position: row.start_position, mid_race_position: row.mid_race_position,
          finish_position: row.finish_position, high_position: row.high_position,
          low_position: row.low_position, avg_position: row.avg_position,
          pass_diff: row.pass_diff, green_flag_passes: row.green_flag_passes,
          green_flag_times_passed: row.green_flag_times_passed,
          quality_passes: row.quality_passes, pct_quality_passes: row.pct_quality_passes,
          fastest_laps: row.fastest_laps, top15_laps: row.top15_laps,
          pct_top15_laps: row.pct_top15_laps, laps_led: row.laps_led,
          pct_laps_led: row.pct_laps_led, laps_completed: row.laps_completed,
          driver_rating: row.driver_rating, finish_status: finishStatus,
        })
        if (error) errors.push(row.driver_name + ': ' + error.message)
        else inserted++
      }
      setStatus({ success: 'Loaded ' + inserted + ' drivers for ' + trackName + ' ' + year, errors })
    } catch (err) {
      setStatus({ error: 'Unexpected error: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem' }
  const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Load New Race</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 16px' }}>
        Visit the Racing Reference loop data page in your browser, press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong>, and paste below.
      </p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inputStyle}>
            <option value="cup">Cup Series</option>
            <option value="oreilly">O'Reilly Series</option>
            <option value="trucks">Truck Series</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Track</label>
          <select value={selTrack} onChange={e => setSelTrack(e.target.value)} style={{ ...inputStyle, width: 200 }}>
            <option value="">-- select track --</option>
            {tracks.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Year</label>
          <input value={year} onChange={e => setYear(e.target.value)} style={{ ...inputStyle, width: 70 }} />
        </div>
        <div>
          <label style={labelStyle}>Race #</label>
          <input value={raceNum} onChange={e => setRaceNum(e.target.value)} style={{ ...inputStyle, width: 60 }} />
        </div>
        <div>
          <label style={labelStyle}>Race Date</label>
          <input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} style={{ ...inputStyle, width: 140 }} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Paste Racing Reference Page (Ctrl+A, Ctrl+C on the loop data page)</label>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder="Paste here..."
          rows={6}
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem' }}
        />
      </div>
      <button onClick={handleLoad} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
        {loading ? 'Loading - ' : 'Parse & Load'}
      </button>
      {status?.success && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, color: '#4ade80', fontSize: '0.85rem' }}>
          {status.success}
          {status.errors?.length > 0 && <pre style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{status.errors.join('\n')}</pre>}
        </div>
      )}
      {status?.error && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f87171', fontSize: '0.85rem' }}>
          {status.error}
        </div>
      )}
    </div>
  )
}

async function loadPdfJs() {
  if (window._pdfjs) return window._pdfjs
  return new Promise((resolve, reject) => {
    if (document.getElementById('pdfjs-script')) {
      const check = setInterval(() => {
        if (window.pdfjsLib) { clearInterval(check); window._pdfjs = window.pdfjsLib; resolve(window._pdfjs) }
      }, 100)
      return
    }
    const script = document.createElement('script')
    script.id = 'pdfjs-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      window._pdfjs = window.pdfjsLib
      resolve(window._pdfjs)
    }
    script.onerror = () => reject(new Error('Failed to load PDF.js'))
    document.head.appendChild(script)
  })
}

function LoadQualifying() {
  const SERIES_CODES = { cup: 'W', oreilly: 'B', trucks: 'C' }
  const [series, setSeries]         = useState('cup')
  const [year, setYear]             = useState(new Date().getFullYear())
  const [raceNumber, setRaceNumber] = useState('')
  const [trackName, setTrackName]   = useState('')
  const [tracks, setTracks] = useState([])
  useEffect(() => { supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name))) }, [])
  const [pastedText, setPastedText] = useState('')
  const [preview, setPreview]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [status, setStatus]         = useState(null)
  const [inputMode, setInputMode]   = useState('pdf')
  const [pdfParsing, setPdfParsing] = useState(false)
  const [lineupSource, setLineupSource] = useState('qualifying')

  function getRacingRefUrl() {
    if (!year || !raceNumber) return null
    const padded = String(raceNumber).padStart(2, '0')
    const code = SERIES_CODES[series] || 'W'
    return 'https://www.racing-reference.info/qual-results/' + year + '-' + padded + '/' + code
  }

  function parseText(text) {
    const drivers = []
    const mfrs = ['Toyota','Chevrolet','Chevy','Ford','Dodge']
    for (const line of text.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 4) continue
      const rank = parseInt(parts[0])
      if (isNaN(rank) || rank < 1 || rank > 60) continue
      let mfrIdx = -1
      for (let i = 2; i < parts.length; i++) { if (mfrs.indexOf(parts[i]) >= 0) { mfrIdx = i; break } }
      let carNumber = null, driverName = '', speed = null
      if (mfrIdx >= 3) {
        carNumber = parts[mfrIdx - 1]
        driverName = parts.slice(1, mfrIdx - 1).join(' ')
        if (mfrIdx < parts.length - 1) { const sp = parseFloat(parts[parts.length - 1]); if (!isNaN(sp) && sp >= 50) speed = sp }
      } else if (/^\d{1,3}[A-Z]?$/.test(parts[1])) {
        carNumber = parts[1]
        const mid = parts.slice(2)
        while (mid.length > 0 && (mfrs.indexOf(mid[mid.length - 1]) >= 0 || !isNaN(parseFloat(mid[mid.length - 1])))) mid.pop()
        driverName = mid.join(' ')
        const sp = parseFloat(parts[parts.length - 1]); if (!isNaN(sp) && sp >= 50) speed = sp
      } else { continue }
      driverName = driverName.replace(/\(i\)/gi, '').replace(/[#()*]/g, '').trim()
      if (!carNumber || !/^\d{1,3}[A-Z]?$/.test(carNumber) || !driverName) continue
      drivers.push({ rank, carNumber, driverName, speed })
    }
    return drivers
  }

  async function parsePdfQualifying(file) {
    if (!series || !year || !trackName) {
      setStatus({ type: 'error', msg: 'Set series, year, and track name before uploading PDF.' })
      return
    }
    setPdfParsing(true)
    setStatus(null)
    setPreview(null)
    try {
      const lib = await loadPdfJs()
      const buf = await file.arrayBuffer()
      const pdf = await lib.getDocument({ data: buf }).promise

      let allItems = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const tc = await page.getTextContent()
        for (const item of tc.items) {
          if (item.str && item.str.trim()) {
            allItems.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] })
          }
        }
      }

      // Group by Y coordinate (same row within 4px)
      const rowMap = new Map()
      for (const item of allItems) {
        let matched = null
        for (const [ky] of rowMap) {
          if (Math.abs(ky - item.y) < 4) { matched = ky; break }
        }
        const key = matched !== null ? matched : item.y
        if (!rowMap.has(key)) rowMap.set(key, [])
        rowMap.get(key).push(item)
      }

      // Sort rows top-to-bottom, items left-to-right
      const rows = [...rowMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.str))

      // Parse: each result row has POS CAR ... TIME SPEED
      // TIME and SPEED are both XX.XXX decimal pattern
      const timeRx = /^\d{2,3}\.\d{3}$/
      const parsed = []

      for (const parts of rows) {
        // Find two time-like values at the end
        let speedIdx = -1, timeIdx = -1
        for (let i = parts.length - 1; i >= 0; i--) {
          if (timeRx.test(parts[i])) {
            if (speedIdx === -1) speedIdx = i
            else if (timeIdx === -1) { timeIdx = i; break }
          }
        }
        // time/speed optional: rain-out lineups have none (0.000)

        const lapTime = timeIdx >= 0 ? parts[timeIdx] : '0.000'
        const speed   = speedIdx >= 0 ? parseFloat(parts[speedIdx]) : 0
        if (speed !== 0 && (speed < 50 || speed > 250)) continue

        // Find POS and CAR â skip any leading "Row" / "N:" tokens
        let si = 0
        while (si < parts.length && (parts[si] === 'Row' || /^\d+:$/.test(parts[si]) || /^Row\s*\d+:?$/.test(parts[si]))) si++

        const pos = parseInt(parts[si])
        if (isNaN(pos) || pos < 1 || pos > 60) continue
        const car = parts[si + 1]
        if (!car || !/^\d{1,3}[A-Z]?$/.test(car)) continue

        parsed.push({ pos, car, lapTime, speed })
      }

      if (parsed.length === 0) {
        setStatus({ type: 'error', msg: 'No qualifying rows found. Check PDF format.' })
        return
      }

      // Look up driver names from entry_list by car number
      const { data: entryList } = await supabase
        .from('entry_list')
        .select('car_number, driver_name')
        .eq('series', series)
        .eq('race_year', parseInt(year))

      const carMap = {}
      if (entryList) {
        for (const e of entryList) carMap[String(e.car_number).trim()] = e.driver_name
      }

      const previewRows = parsed
        .map(p => ({
          rank:       p.pos,
          carNumber:  p.car,
          driverName: carMap[String(p.car).trim()] || ('Car #' + p.car),
          lapTime:    p.lapTime,
          speed:      p.speed,
        }))
        .sort((a, b) => a.rank - b.rank)

      setPreview(previewRows)
    } catch (err) {
      setStatus({ type: 'error', msg: 'PDF parse failed: ' + err.message })
    } finally {
      setPdfParsing(false)
    }
  }

  async function handleTextPreview() {
    setStatus(null)
    const drivers = parseText(pastedText)
    if (!drivers.length) { setStatus({ type: 'error', msg: 'No drivers parsed. Check format.' }); return }
    setPreview(drivers)
  }

  async function handleSubmit() {
    if (!preview || !trackName || !year) return
    setLoading(true)
    setStatus(null)
    try {
      const racingRefUrl  = getRacingRefUrl()
      const racingRefId   = trackName.toLowerCase().replace(/\s+/g, '_') + '_' + year + '_' + (raceNumber || '0')
      // Delete existing for this race
      await supabase.from('qualifying_results').delete().eq('racing_reference_id', racingRefId)
      const rows = preview.map(d => ({
        series,
        year:               parseInt(year),
        race_number:        parseInt(raceNumber) || 0,
        track_name:         trackName,
        racing_reference_id: racingRefId,
        driver_name:        d.driverName,
        car_number:         d.carNumber || null,
        qualifying_position: d.rank,
        lineup_source: lineupSource,
        qualifying_speed:   d.speed || null,
        lap_time:           d.lapTime || null,
      }))
      const { error } = await supabase.from('qualifying_results').upsert(rows, { onConflict: 'series,year,track_name,race_number,driver_name' })
      if (error) throw error
      const pole = preview[0]
      setStatus({ type: 'success', msg: 'Loaded ' + rows.length + ' drivers for ' + trackName + ' ' + year + '. Pole: ' + pole.driverName + ' (' + (pole.speed || pole.lapTime) + ')' })
      setPreview(null)
      setPastedText('')
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  const tabStyle   = (active) => ({ padding: '6px 14px', marginRight: 6, cursor: 'pointer', borderRadius: 4, border: '1px solid #555', background: active ? '#3b82f6' : '#2a2a2a', color: '#fff', fontWeight: active ? 700 : 400 })
  const inputStyle = { width: '100%', padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 12 }}>Load Qualifying Results</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inputStyle}>
            <option value="cup">Cup</option>
            <option value="oreilly">O'Reilly</option>
            <option value="trucks">Trucks</option>
          </select>
        </div>
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Race #</label>
          <input type="number" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} style={inputStyle} placeholder="e.g. 17" />
        </div>
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Track Name (exact)</label>
          <select value={trackName} onChange={e => setTrackName(e.target.value)} style={inputStyle}><option value="">-- select track --</option>{tracks.map(t => <option key={t} value={t}>{t}</option>)}</select>
        </div>
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Lineup source</label>
          <select value={lineupSource} onChange={e => setLineupSource(e.target.value)} style={inputStyle}><option value="qualifying">Qualifying (on-track)</option><option value="metric">Metric / owner points</option><option value="rain">Rain (no qualifying)</option><option value="practice">Practice-set</option></select>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ marginBottom: 12 }}>
        <button style={tabStyle(inputMode === 'pdf')}   onClick={() => { setInputMode('pdf');   setPreview(null); setStatus(null) }}>Upload PDF</button>
        <button style={tabStyle(inputMode === 'paste')} onClick={() => { setInputMode('paste'); setPreview(null); setStatus(null) }}>Paste Text (Racing Reference)</button>
      </div>

      {inputMode === 'pdf' && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Upload the official NASCAR "Starting Line Up by Row" PDF from NASCAR.com</p>
          <input
            type="file"
            accept=".pdf"
            style={{ color: '#eee' }}
            onChange={async e => { const f = e.target.files[0]; if (f) await parsePdfQualifying(f) }}
          />
          {pdfParsing && <p style={{ color: '#f59e0b', marginTop: 8 }}>Parsing PDF...</p>}
        </div>
      )}

      {inputMode === 'paste' && (
        <div style={{ marginBottom: 12 }}>
          {getRacingRefUrl() && (
            <p style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>
              Source: <a href={getRacingRefUrl()} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{getRacingRefUrl()}</a>
            </p>
          )}
          <textarea
            rows={12}
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder="Paste Racing Reference qualifying results here..."
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={handleTextPreview} style={{ marginTop: 8, padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Preview
          </button>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>{preview.length} drivers parsed. Review before loading:</p>
          <div style={{ maxHeight: 300, overflowY: 'auto', background: '#111', borderRadius: 4, padding: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#888' }}>
                  <th style={{ textAlign: 'left', padding: '2px 8px' }}>Pos</th>
                  <th style={{ textAlign: 'left', padding: '2px 8px' }}>Car</th>
                  <th style={{ textAlign: 'left', padding: '2px 8px' }}>Driver</th>
                  <th style={{ textAlign: 'left', padding: '2px 8px' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '2px 8px' }}>Speed</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((d, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #222', color: i === 0 ? '#f59e0b' : '#ddd' }}>
                    <td style={{ padding: '3px 8px' }}>{d.rank}</td>
                    <td style={{ padding: '3px 8px' }}>{d.carNumber}</td>
                    <td style={{ padding: '3px 8px' }}>{d.driverName}</td>
                    <td style={{ padding: '3px 8px' }}>{d.lapTime || '-'}</td>
                    <td style={{ padding: '3px 8px' }}>{d.speed || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ marginTop: 10, padding: '8px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Loading...' : 'Confirm & Load to Database'}
          </button>
        </div>
      )}

      {status && (
        <div style={{ padding: '8px 12px', borderRadius: 4, background: status.type === 'success' ? '#064e3b' : '#7f1d1d', color: status.type === 'success' ? '#6ee7b7' : '#fca5a5', fontSize: 13 }}>
          {status.msg}
        </div>
      )}
    </div>
  )
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
    const name = m[3].replace(/,\s*/g, ' ').replace(/\s+/g, ' ').trim()
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
  const [raceNumber, setRaceNumber] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rawText, setRawText] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [tracks, setTracks] = useState([])
  useEffect(() => { supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name))) }, [])

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
        race_number: parseInt(raceNumber) || 0,
        driver_name: r.driver_name,
        draw_order: r.draw_order,
      }))
      const { error } = await supabase
        .from('qualifying_results')
        .upsert(records, { onConflict: 'series,year,track_name,race_number,driver_name' })
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
        <input type="number" placeholder="Race #" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} style={{ width: 80, fontSize: '0.875rem' }} />
        <select value={trackName} onChange={e => setTrackName(e.target.value)} style={{ minWidth: 220, fontSize: '0.875rem' }}><option value="">-- select track --</option>{tracks.map(t => <option key={t} value={t}>{t}</option>)}</select>
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


// Load Fastest Laps
const FL_TRACK_TYPES = ['Short Track', 'Intermediate', 'Superspeedway', 'Road Course', 'Other']

function LoadFastestLaps() {
  const [year, setYear]           = useState(new Date().getFullYear())
  const [trackType, setTrackType] = useState('Intermediate')
  const [raceName, setRaceName]   = useState('')
  const [raceDate, setRaceDate]   = useState('')
  const [trackName, setTrackName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [parsed, setParsed]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [status, setStatus]       = useState(null)
  const [tracks, setTracks] = useState([])
  useEffect(() => { supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name))) }, [])

  // Lap Raptor Lap Performance columns (use ?report=lap_performance tab):
  // Driver  Car  Make  Start  Finish  Status  ARP  FL#  FL_Time(s)  P50_Time  P95_Time  FL_Speed(mph)  P50_Speed  P95_Speed
  function parsePaste() {
    const RE = /^(.+?)\s+(\d{1,3})\s+(?:Chevy|Chevrolet|Ford|Toyota|Dodge|Ram)\s+(\d+)\s+(\d+)\s+(\w+)\s+[\d.]+\s+(\d+)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+([\d.]+)/gm
    const rows = []
    let m
    while ((m = RE.exec(pasteText)) !== null) {
      rows.push({
        driver:          m[1].trim(),
        car:             m[2].trim(),
        start_pos:       m[3].trim(),
        finish_pos:      m[4].trim(),
        status:          m[5].trim(),
        fastest_lap_num: m[6].trim(),
        fastest_time:    m[7].trim(),
        fastest_speed:   m[8].trim(),
      })
    }
    // Sort by fastest_time ascending and assign rank (1 = fastest lap in race)
    rows.sort((a, b) => parseFloat(a.fastest_time) - parseFloat(b.fastest_time))
    rows.forEach((r, i) => { r.rank = i + 1 })
    setParsed(rows)
    if (rows.length === 0) {
      setStatus({ type: 'error', msg: 'No rows parsed - go to Lap Raptor race page, click Lap Performance tab, Ctrl+A, Ctrl+C, paste here' })
    } else {
      setStatus({ type: 'info', msg: 'Parsed ' + rows.length + ' drivers - fill in metadata then click Load' })
    }
  }

  async function handleLoad() {
    if (!parsed?.length || !raceName || !raceDate || !trackName) return
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/load-fastest-laps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: String(year),
          track_type: trackType,
          race_name: raceName,
          race_date: raceDate,
          track: trackName,
          rows: parsed,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Load failed')
      setStatus({ type: 'success', msg: data.message || `Loaded ${parsed.length} drivers` })
      setParsed(null)
      setPasteText('')
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    }
    setLoading(false)
  }

  const inputStyle = {
    padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Load Fastest Laps</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Go to the Lap Raptor race page, click the Lap Performance tab, then Ctrl+A, Ctrl+C, paste below. Fill in metadata, Parse, then Load.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ ...inputStyle, width: 80 }} />
        </div>
        <div>
          <label style={labelStyle}>Track Type</label>
          <select value={trackType} onChange={e => setTrackType(e.target.value)} style={inputStyle}>
            {FL_TRACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Race Name</label>
          <input value={raceName} onChange={e => setRaceName(e.target.value)} style={{ ...inputStyle, width: 220 }} placeholder="Anduril 250" />
        </div>
        <div>
          <label style={labelStyle}>Race Date (MM/DD/YYYY)</label>
          <input value={raceDate} onChange={e => setRaceDate(e.target.value)} style={{ ...inputStyle, width: 130 }} placeholder="06/22/2026" />
        </div>
        <div>
          <label style={labelStyle}>Track Name</label>
          <select value={trackName} onChange={e => setTrackName(e.target.value)} style={{ ...inputStyle, width: 260 }}><option value="">-- select track --</option>{tracks.map(t => <option key={t} value={t}>{t}</option>)}</select>
        </div>
      </div>

      <textarea
        value={pasteText}
        onChange={e => { setPasteText(e.target.value); setParsed(null); setStatus(null) }}
        placeholder="Paste Lap Raptor race page here (Ctrl+A, Ctrl+C)"
        rows={6}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 10 }}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={parsePaste} disabled={!pasteText.trim()} style={{ fontSize: '0.8125rem' }}>
          Parse
        </button>
        <button className="btn btn-primary" onClick={handleLoad}
          disabled={loading || !parsed?.length || !raceName || !raceDate || !trackName}
          style={{ fontSize: '0.8125rem' }}>
          {loading ? 'Loading...' : (parsed ? 'Load (' + parsed.length + ' drivers)' : 'Load')}
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 12, fontSize: '0.8125rem',
          color: status.type === 'success' ? '#22c55e' : status.type === 'info' ? 'var(--accent)' : '#ef4444' }}>
          {status.msg}
        </div>
      )}
    </div>
  )
}


function SimFormulaPanel() {
  const __WROWS = [['corrHistory','Corr. History'],['longRunPace','Long Run Pace'],['shortRunPace','Short Run Pace'],['startPos','Start Position'],['tireFalloff','Tire Falloff'],['trackHistory','Track History'],['winConversion','Win Conversion']]
  const __pctRows = w => __WROWS.map(([k, lab]) => [lab, Math.round((w[k] || 0) * 100) + '%'])
  const ovalW = __pctRows(DEFAULT_WEIGHTS)
  const rcW = __pctRows(ROAD_COURSE_WEIGHTS)
  const ssW = __pctRows(SUPERSPEEDWAY_WEIGHTS)
  const trW = __pctRows(TRUCK_ROAD_WEIGHTS)
  const oreSSW = __pctRows(ONEILLY_SUPERSPEEDWAY_WEIGHTS)
  const factors = [
    ['Corr. History',  'driver_rating at correlated tracks (same correlation group), year-weighted. 100% rating - avg_finish is used only as a fallback when a driver has no rating. Confidence = min(1, nRaces / 4); thin history shrinks toward 50 (neutral).'],
    ['Long Run Pace',  'overall_avg from practice_sessions - all clean laps across all stints, any lap over 8% slower than session median dropped. Lower is better.'],
    ['Short Run Pace', 'late_run_avg from practice_sessions - short-stint laps, mock-qual stints excluded. Lower is better.'],
    ['Start Position', 'qualifying_position from qualifying_results (falls back to practice_sessions qualifying_position if quali is not loaded). Lower is better.'],
    ['Tire Falloff',   'trend_slope from practice_sessions - lap-time slope vs lap number in longest stint (min 10 laps, else neutral 50). Lower is better.'],
    ['Track History',  'driver_rating + avg_finish at this specific track only, same year weights. 90% rating / 10% finish blend, confidence = min(1, nTrackRaces / 4). Now active on ovals (15%); 0% on road and superspeedway.'],
    ['Win Conversion',  'Oreilly superspeedways only: year-weighted win rate (wins-only, small-sample shrunk). Rewards proven pack-race closers over steady-but-winless drivers.'],
  ]
  const yearW = [
    ['2026', '2.0x'],
    ['2025', '1.3x'],
    ['2024', '0.9x'],
    ['2023', '0.6x'],
    ['2022-', '0.4x'],
  ]
  const cell  = { padding: '4px 10px', fontSize: '0.78125rem', borderBottom: '1px solid var(--border-color)' }
  const hd    = { ...cell, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.6875rem' }
  const tbl   = { borderCollapse: 'collapse', width: '100%' }
  const label = { fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Sim Center Formula</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Read-only reference  -  current weights and data sources used by Race Simulation.
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
          <div style={label}>Road: Cup / O\u2019Reilly</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Factor</th><th style={{ ...hd, textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
              {rcW.map(([f, w]) => (
                <tr key={f}><td style={cell}>{f}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={label}>Superspeedway Weights</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Factor</th><th style={{ ...hd, textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
            {ssW.map(([f, w]) => (
              <tr key={f}><td style={cell}>{f}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w}</td></tr>
            ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={label}>Superspeedway: O'Reilly</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Factor</th><th style={{ ...hd, textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
            {oreSSW.map(([f, w]) => (
              <tr key={f}><td style={cell}>{f}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w}</td></tr>
            ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={label}>Road: Trucks</div>
          <table style={tbl}>
            <thead><tr><th style={hd}>Factor</th><th style={{ ...hd, textAlign: 'right' }}>Weight</th></tr></thead>
            <tbody>
            {trW.map(([f, w]) => (
              <tr key={f}><td style={cell}>{f}</td><td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w}</td></tr>
            ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={label}>Year Weights (History + Craft)</div>
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
      <table style={{ ...tbl, tableLayout: 'fixed' }}>
        <thead><tr><th style={{ ...hd, width: 130 }}>Factor</th><th style={hd}>Source &amp; Logic</th></tr></thead>
        <tbody>
          {factors.map(([f, desc]) => (
            <tr key={f}>
              <td style={{ ...cell, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{f}</td>
              <td style={{ ...cell, color: 'var(--text-muted)', lineHeight: 1.5, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
        All factors are field-normalized 0-100 before weighting. Drivers missing data default to 50 (neutral).
        Road course and superspeedway auto-detected by track name  -  weights switch automatically in Simulation Center.
      </p>
    </div>
  )
}

function TrackDbPanel() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    supabase.from('tracks').select('name, track_type, correlation_group, correlation_group_label').then(({ data }) => {
      const d = (data || []).slice().sort((a, b) => {
        const ga = a.correlation_group == null ? 999 : a.correlation_group
        const gb = b.correlation_group == null ? 999 : b.correlation_group
        return ga - gb || (a.name || '').localeCompare(b.name || '')
      })
      setRows(d)
    })
  }, [])
  const cell = { padding: '4px 10px', fontSize: '0.78125rem', borderBottom: '1px solid var(--border)' }
  const hd = { ...cell, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.68rem' }
  const unassigned = rows.filter(t => t.correlation_group == null).length
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Track Database ({rows.length})</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        All tracks and their correlation group. Rows in red have no group and won't share history with any track.
        {unassigned > 0 ? ' (' + unassigned + ' unassigned)' : ''}
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <thead><tr>
          <th style={hd}>Track</th>
          <th style={{ ...hd, width: 130 }}>Type</th>
          <th style={{ ...hd, width: 70, textAlign: 'center' }}>Group</th>
          <th style={{ ...hd, width: 160 }}>Label</th>
        </tr></thead>
        <tbody>
        {rows.map(tr => (
          <tr key={tr.name} style={tr.correlation_group == null ? { background: 'rgba(239,68,68,0.1)' } : null}>
            <td style={{ ...cell, fontWeight: 600 }}>{tr.name}</td>
            <td style={{ ...cell, color: 'var(--text-secondary)' }}>{tr.track_type || '-'}</td>
            <td style={{ ...cell, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{tr.correlation_group == null ? '\u2014' : tr.correlation_group}</td>
            <td style={{ ...cell, color: 'var(--text-muted)' }}>{tr.correlation_group_label || '-'}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  )
}



function LoadGreenFlagSpeed() {
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [raceNum, setRaceNum] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [raceName, setRaceName] = useState('')
  const [selTrack, setSelTrack] = useState('')
  const [tracks, setTracks] = useState([])
  const [parsed, setParsed] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => { supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name))) }, [])

  async function parsePdf(file) {
    setParsed(null); setStatus({ msg: 'Loading pdf.js...' })
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      const buf = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
      let tc = null
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const c = await page.getTextContent()
        const head = c.items.map(i => i.str).join(' ').slice(0, 40)
        if (head.indexOf('Green Flag Speed') === 0) { tc = c; break }
      }
      if (!tc) { setStatus({ error: 'No Green Flag Speed page found in this PDF (expected around page 10).' }); return }
      const byY = {}
      tc.items.forEach(it => { const s = (it.str || '').trim(); if (!s) return; const y = Math.round(it.transform[5]); (byY[y] = byY[y] || []).push({ s: s, x: it.transform[4] }) })
      const ys = Object.keys(byY).map(Number).sort((a, b) => b - a)
      const lineText = ys.map(y => byY[y].slice().sort((a, b) => a.x - b.x).map(o => o.s).join(' '))
      const track = (lineText[1] || '').trim()
      const rname = (lineText[2] || '').trim()
      let rdate = null
      lineText.slice(0, 6).forEach(ln => { ln.split(' ').forEach(tok => { const p = tok.split('/'); if (p.length === 3 && p.every(x => x !== '' && !isNaN(parseInt(x)))) { rdate = p[2].padStart(4, '0') + '-' + p[0].padStart(2, '0') + '-' + p[1].padStart(2, '0') } }) })
      let teamX = 200
      ys.forEach(y => { byY[y].forEach(o => { if (o.s === 'Team') teamX = o.x }) })
      const rows = []
      ys.forEach(y => {
        const items = byY[y].slice().sort((a, b) => a.x - b.x)
        if (items.length < 5) return
        if (isNaN(parseInt(items[0].s)) || String(parseInt(items[0].s)) !== items[0].s) return
        const last = items[items.length - 1].s
        if (last.indexOf('.') < 0 || isNaN(parseFloat(last)) || parseFloat(last) < 40) return
        const rank = parseInt(items[0].s)
        const car = items[1].s
        const gfs = parseFloat(last)
        const finTok = items[items.length - 2].s
        const finish = (!isNaN(parseInt(finTok)) && String(parseInt(finTok)) === finTok) ? parseInt(finTok) : null
        const mid = items.slice(2, items.length - 2)
        const driver = mid.filter(o => o.x < teamX - 15).map(o => o.s).join(' ').trim()
        const team = mid.filter(o => o.x >= teamX - 15).map(o => o.s).join(' ').trim()
        if (driver) rows.push({ rank: rank, car: car, driver: driver, team: team, finish: finish, gfs: gfs })
      })
      if (!rows.length) { setStatus({ error: 'Found the Green Flag Speed page but parsed no driver rows.' }); return }
      setParsed({ track: track, race_name: rname, report_date: rdate, rows: rows })
      if (rname) setRaceName(rname)
      const matchTrack = tracks.find(tn => tn === track)
      if (matchTrack) setSelTrack(matchTrack)
      setStatus({ msg: 'Parsed ' + rows.length + ' drivers from ' + (track || 'the PDF') + '. Review and Load.' })
    } catch (e) { setStatus({ error: 'PDF error: ' + (e.message || e) }) }
  }

  async function load() {
    if (!selTrack) return setStatus({ error: 'Select a track.' })
    if (!raceNum) return setStatus({ error: 'Enter a race number.' })
    if (!raceDate) return setStatus({ error: 'Enter a race date.' })
    if (!parsed || !parsed.rows.length) return setStatus({ error: 'Upload and parse a PDF first.' })
    setLoading(true); setStatus({ msg: 'Loading...' })
    try {
      const { data: existing } = await supabase.from('green_flag_speed').select('id').eq('series', series).eq('year', parseInt(year)).eq('race_number', parseInt(raceNum)).limit(1)
      if (existing && existing.length) { setStatus({ error: 'Already loaded: ' + selTrack + ' ' + year + ' race ' + raceNum + '. Delete those rows first to reload.' }); setLoading(false); return }
      const lapsByFin = {}; let maxLaps = 0
      const { data: ld } = await supabase.from('loop_data').select('finish_position, laps_completed').eq('series', series).eq('year', parseInt(year)).eq('race_number', parseInt(raceNum))
      if (ld && ld.length) { ld.forEach(r => { lapsByFin[r.finish_position] = r.laps_completed; if ((r.laps_completed || 0) > maxLaps) maxLaps = r.laps_completed }) }
      const insertRows = parsed.rows.map(r => {
        const laps = lapsByFin[r.finish]
        const shortRun = (maxLaps > 0 && laps != null) ? (laps < 0.40 * maxLaps) : false
        return { series: series, year: parseInt(year), track: selTrack, race_name: raceName || parsed.race_name || null, report_date: parsed.report_date || null, race_number: parseInt(raceNum), race_date: raceDate, gfs_rank: r.rank, car: String(r.car), driver: r.driver, team: r.team || null, finish_pos: r.finish, green_flag_speed: r.gfs, laps_completed: (laps != null ? laps : null), short_run: shortRun, gfs_rank_valid: null }
      })
      const valid = insertRows.filter(r => !r.short_run).slice().sort((a, b) => b.green_flag_speed - a.green_flag_speed)
      valid.forEach((r, i) => { r.gfs_rank_valid = i + 1 })
      const { error } = await supabase.from('green_flag_speed').insert(insertRows)
      if (error) { setStatus({ error: 'Insert error: ' + error.message }); setLoading(false); return }
      setStatus({ msg: 'Loaded ' + insertRows.length + ' drivers for ' + selTrack + ' ' + year + (maxLaps > 0 ? ' (short-run flags set from loop_data)' : ' (load loop data first to get short-run flags)') })
      setParsed(null)
    } catch (e) { setStatus({ error: 'Error: ' + (e.message || e) }) }
    setLoading(false)
  }

  const fld = { display: 'flex', flexDirection: 'column', gap: 3 }
  const lab = { fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }
  const inp = { padding: '6px 8px', fontSize: '0.8125rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Load Green Flag Speed</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 14 }}>Upload the loop-data PDF; the Green Flag Speed page (usually page 10) is parsed automatically. Same fields and dedup as Load New Race. Load the race's loop data first so short-run flags compute.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={fld}><label style={lab}>Series</label><select style={{ ...inp, width: 110 }} value={series} onChange={e => setSeries(e.target.value)}><option value="cup">cup</option><option value="oreilly">oreilly</option><option value="trucks">trucks</option></select></div>
        <div style={fld}><label style={lab}>Track</label><select style={{ ...inp, width: 230 }} value={selTrack} onChange={e => setSelTrack(e.target.value)}><option value="">Select track...</option>{tracks.map(tn => <option key={tn} value={tn}>{tn}</option>)}</select></div>
        <div style={fld}><label style={lab}>Year</label><input style={{ ...inp, width: 70 }} value={year} onChange={e => setYear(e.target.value)} /></div>
        <div style={fld}><label style={lab}>Race #</label><input style={{ ...inp, width: 60 }} value={raceNum} onChange={e => setRaceNum(e.target.value)} /></div>
        <div style={fld}><label style={lab}>Race date</label><input type="date" style={{ ...inp, width: 150 }} value={raceDate} onChange={e => setRaceDate(e.target.value)} /></div>
      </div>
      <input type="file" accept="application/pdf" onChange={e => { const f = e.target.files[0]; if (f) parsePdf(f) }} style={{ fontSize: '0.8rem', marginBottom: 10 }} />
      {parsed && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Parsed <b>{parsed.rows.length}</b> drivers &middot; {parsed.track || '(track?)'} &middot; {parsed.race_name || '(race?)'} &middot; {parsed.report_date || '(no date)'} &middot; top: {parsed.rows.slice(0, 3).map(r => r.driver + ' ' + r.gfs).join(', ')}</div>}
      <button onClick={load} disabled={loading} style={{ padding: '8px 18px', cursor: 'pointer', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--text)', color: 'var(--bg)', fontWeight: 600, fontSize: '0.82rem' }}>{loading ? 'Loading...' : 'Load Green Flag Speed'}</button>
      {status && <div style={{ marginTop: 10, fontSize: '0.8rem', color: status.error ? '#ef4444' : 'var(--text-secondary)' }}>{status.error || status.msg}</div>}
    </div>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [adminTab, setAdminTab] = useState('admin')

  const [series, setSeries] = useState('cup')
  const [trackName, setTrackName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [sessionNum, setSessionNum] = useState(1)
  const [practiceRaceNum, setPracticeRaceNum] = useState(1)
  const [trackList, setTrackList] = useState([])

  useEffect(() => {
    supabase.from('tracks').select('name').order('name').then(function (r) { setTrackList(r.data || []) })
  }, [])
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
        .eq('track_name', trackName).eq('year', year).eq('series', series).eq('race_number', practiceRaceNum)
        .single()

      if (existingRace) {
        raceId = existingRace.id
      } else {
        const { data: newRace, error: raceError } = await supabase
          .from('races')
          .insert({ race_name: `${trackName} ${year} R${practiceRaceNum}`, series, year, track_name: trackName, race_number: practiceRaceNum })
          .select('id').single()
        if (raceError) throw raceError
        raceId = newRace.id
      }

      // Delete and re-insert practice session summaries
      await supabase.from('practice_sessions').delete()
        .eq('race_id', raceId).eq('series', series).eq('session_number', sessionNum).eq('race_number', practiceRaceNum)

      const rows = preview.graded.map(d => ({
        race_id: raceId,
        driver_name: d.driver,
        series, year,
        track_name: trackName,
        session_number: sessionNum,
        race_number: practiceRaceNum,
        qualifying_position: d.start,
        car_number: d.carNumber || null,
        practice_group: d.group || null,
        total_laps: d.totalLaps,
        best_lap: d.bestLap,
        overall_avg: d.overallAvg,
        late_run_avg: d.lateRunAvg,
        trend_slope: d.trendSlope,
        avg_pace: d.avgPace,
        best_stint: d.bestStint,
        long_run: d.longRun,
        consistency: d.consistency,
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
          .eq('track_name', trackName).eq('session_number', sessionNum).eq('race_number', practiceRaceNum)

        const lapRows = []
        for (const d of (preview.parsed.drivers || [])) {
          if (!d.lapData) continue
          const entries = Object.entries(d.lapData)
          for (const [lapNum, lapTime] of entries) {
            const t = parseFloat(lapTime)
            if (isNaN(t) || t <= 0) continue
            lapRows.push({
              series, year, track_name: trackName, session_number: sessionNum,
            race_number: practiceRaceNum,
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

  const __tabBar = (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(128,128,128,0.25)', marginBottom: 16 }}>
      {[['admin', 'Admin'], ['sim', 'Sim Admin'], ['grader', 'Sim Grader'], ['load', 'Load Data']].map(t => (
        <button key={t[0]} onClick={() => setAdminTab(t[0])} style={{ padding: '8px 16px', border: 'none', background: 'none', borderBottom: adminTab === t[0] ? '2px solid #e8b923' : '2px solid transparent', color: adminTab === t[0] ? '#e8b923' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}>{t[1]}</button>
      ))}
    </div>
  )
  if (adminTab === 'sim') return (<div><div className="page" style={{ maxWidth: 960, paddingBottom: 0 }}>{__tabBar}</div><SimulationCenter isSubscriber={true} embedded={true} /></div>)
  if (adminTab === 'grader') return (<div><div className="page" style={{ maxWidth: 960, paddingBottom: 0 }}>{__tabBar}</div><GradeCenter /></div>)
  return (
    <div className="page" style={{ maxWidth: 960 }}>
      {__tabBar}
      <div className="page-header">
        <h1 className="page-title">{adminTab === 'load' ? 'Load Data' : 'Admin'}</h1>
        <p className="page-subtitle">Upload practice data &amp; configure featured weekends</p>
      </div>

      {adminTab === 'admin' && (<>
      <WeekendConfig />
      <QualSimConfig />
      <EntryListManager />
      <SimFormulaPanel />
      <TrackDbPanel />

      </>)}
      {adminTab === 'load' && (<>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Data Audit</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Review loop data and practice sessions stored per race and track.
        </p>
        <a href="/loop-data-audit" style={{ color: '#f59e0b', fontSize: '0.875rem', textDecoration: 'none' }}>
          Open Loop Data Audit
        </a>
        <br />
        <a href="/practice-audit" style={{ color: '#f59e0b', fontSize: '0.875rem', textDecoration: 'none' }}>
          Open Practice Session Audit
        </a>
        <br />
        <a href="/qualifying-audit" style={{ color: '#f59e0b', fontSize: '0.875rem', textDecoration: 'none' }}>
          Open Qualifying Data Audit
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
            <select value={trackName} onChange={e => setTrackName(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none' }}>
              <option value="">Select track...</option>
              {[...trackList].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
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
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Race #</label>
            <input type="number" min="1" value={practiceRaceNum} onChange={e => setPracticeRaceNum(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', outline: 'none' }} />
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
      <LoadQualifying />
      <LoadQualifyingOrder />
      <LoadNewRace />
      <LoadFastestLaps />
      <LoadGreenFlagSpeed />
      </>)}
    </div>
  )
}
