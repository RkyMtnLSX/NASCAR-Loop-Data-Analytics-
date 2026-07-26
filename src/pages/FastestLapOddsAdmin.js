import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const BOOKS = [{ v: 'dk', label: 'DraftKings' }, { v: 'fd', label: 'FanDuel' }, { v: 'hr', label: 'Hard Rock' }]
const am = (o) => (o == null ? '-' : (o > 0 ? '+' + o : String(o)))
const impl = (o) => (o == null ? null : (o > 0 ? 100 / (o + 100) * 100 : Math.abs(o) / (Math.abs(o) + 100) * 100))
const ts = (s) => { try { const d = new Date(s); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') } catch (e) { return String(s).slice(5, 16) } }

function parseFL(text) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim())
  const out = []
  const bad = /sportsbook|draftkings|fanduel|hard rock|odds|league|http|bet slip|server time|copyright|office|gambler|sign up|log in|view all|nascar|series|futures|props|winner|fastest lap|today|tomorrow|am$|pm$/i
  for (let i = 0; i < lines.length - 1; i++) {
    const nm = lines[i], od = lines[i + 1]
    if (!nm || !od) continue
    if (!/^[+-]\d{2,6}$/.test(od)) continue
    if (!/^[A-Za-z][A-Za-z .'\u00c0-\u024f-]{2,34}$/.test(nm)) continue
    if (bad.test(nm)) continue
    if (nm.split(/\s+/).length < 2) continue
    out.push({ driver: nm.replace(/\.$/, ''), odds: parseInt(od, 10) })
    i++
  }
  const seen = {}
  return out.filter(r => { const k = r.driver.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true })
}

export default function FastestLapOddsAdmin() {
  const [series, setSeries] = useState('cup')
  const [book, setBook] = useState('dk')
  const [year, setYear] = useState(new Date().getFullYear())
  const [raceNum, setRaceNum] = useState('')
  const [track, setTrack] = useState('')
  const [tracks, setTracks] = useState([])
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [races, setRaces] = useState([])
  const [sel, setSel] = useState('')
  const [hist, setHist] = useState([])
  const [loading, setLoading] = useState(false)

  const parsed = useMemo(() => parseFL(paste), [paste])

  useEffect(() => {
    supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name)))
  }, [])

  useEffect(() => {
    let alive = true
    supabase.from('featured_weekend').select('track_name,race_number').eq('series', series).maybeSingle()
      .then(({ data }) => { if (alive && data) { if (data.track_name) setTrack(data.track_name); if (data.race_number) setRaceNum(String(data.race_number)) } })
    return () => { alive = false }
  }, [series])

  async function loadRaces() {
    const { data } = await supabase.from('fastest_lap_odds')
      .select('series,race_year,race_number,track_name')
      .order('race_year', { ascending: false }).order('race_number', { ascending: false }).limit(4000)
    const m = {}
    ;(data || []).forEach(r => {
      const k = r.series + '|' + r.race_year + '|' + r.race_number
      if (!m[k]) m[k] = { key: k, series: r.series, race_year: r.race_year, race_number: r.race_number, track_name: r.track_name, n: 0 }
      m[k].n++
    })
    const list = Object.keys(m).map(k => m[k])
    list.sort((a, b) => (b.race_year - a.race_year) || (b.race_number - a.race_number) || a.series.localeCompare(b.series))
    setRaces(list)
    setSel(prev => prev || (list.length ? list[0].key : ''))
  }

  async function loadHist(key) {
    if (!key) { setHist([]); return }
    setLoading(true)
    const p = key.split('|')
    const { data } = await supabase.from('fastest_lap_odds').select('*')
      .eq('series', p[0]).eq('race_year', +p[1]).eq('race_number', +p[2])
      .order('captured_at', { ascending: false }).limit(3000)
    setHist(data || []); setLoading(false)
  }

  useEffect(() => { loadRaces() }, []) // eslint-disable-line
  useEffect(() => { loadHist(sel) }, [sel]) // eslint-disable-line

  async function save() {
    if (!parsed.length) { setMsg('Nothing parsed.'); return }
    if (!track) { setMsg('Pick a track.'); return }
    if (!raceNum || !parseInt(raceNum, 10)) { setMsg('Enter a race number.'); return }
    setSaving(true); setMsg('')
    const stamp = new Date().toISOString()
    const rows = parsed.map(r => ({
      series: series, race_year: parseInt(year, 10), race_number: parseInt(raceNum, 10),
      track_name: track, book: book, driver_name: r.driver, odds: r.odds, captured_at: stamp
    }))
    const { error } = await supabase.from('fastest_lap_odds').insert(rows)
    setSaving(false)
    if (error) { setMsg('Save failed: ' + error.message); return }
    setMsg('Saved ' + rows.length + ' fastest-lap prices for ' + track + ' R' + raceNum + ' (' + book + ').')
    setPaste('')
    loadRaces(); loadHist(series + '|' + year + '|' + parseInt(raceNum, 10)); setSel(series + '|' + year + '|' + parseInt(raceNum, 10))
  }

  const grouped = useMemo(() => {
    const byCap = {}
    hist.forEach(r => { (byCap[r.captured_at + '|' + r.book] = byCap[r.captured_at + '|' + r.book] || []).push(r) })
    return Object.keys(byCap).sort().reverse().map(k => {
      const rows = byCap[k].slice().sort((a, b) => a.odds - b.odds)
      const sum = rows.reduce((a, b) => a + (impl(b.odds) || 0), 0)
      return { key: k, cap: k.split('|')[0], book: k.split('|')[1], rows: rows, vig: +(sum - 100).toFixed(1), sum: +sum.toFixed(1) }
    })
  }, [hist])

  const inp = { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px' }
  const td = { padding: '3px 8px', borderBottom: '1px solid rgba(128,128,128,0.15)', whiteSpace: 'nowrap' }

  return (
    <div>
      <h3 style={{ margin: '4px 0 6px' }}>Fastest Lap Odds</h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Paste a sportsbook fastest-lap board. Stored per series / year / race number / track so it builds history by venue. Archive only \u2014 no flags, no model probability (the sim's avg_fast_laps is an expected count, not a P(fastest lap), and this market is driven by late green-flag pit strategy).
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
        <label style={{ fontSize: 12 }}>Series<br />
          <select value={series} onChange={e => setSeries(e.target.value)} style={{ ...inp, marginTop: 3 }}>
            {SERIES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Book<br />
          <select value={book} onChange={e => setBook(e.target.value)} style={{ ...inp, marginTop: 3 }}>
            {BOOKS.map(b => <option key={b.v} value={b.v}>{b.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Year<br />
          <input value={year} onChange={e => setYear(e.target.value)} style={{ ...inp, width: 70, marginTop: 3 }} />
        </label>
        <label style={{ fontSize: 12 }}>Race #<br />
          <input value={raceNum} onChange={e => setRaceNum(e.target.value)} style={{ ...inp, width: 70, marginTop: 3 }} />
        </label>
        <label style={{ fontSize: 12 }}>Track<br />
          <select value={track} onChange={e => setTrack(e.target.value)} style={{ ...inp, marginTop: 3, minWidth: 240 }}>
            <option value="">-- pick --</option>
            {tracks.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <textarea value={paste} onChange={e => setPaste(e.target.value)}
        placeholder="Paste the fastest-lap board (driver name on one line, odds on the next)\u2026"
        style={{ width: '100%', minHeight: 110, ...inp, fontFamily: 'monospace', fontSize: 12 }} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 16px', flexWrap: 'wrap' }}>
        <button onClick={save} disabled={saving || !parsed.length}
          style={{ padding: '6px 16px', borderRadius: 8, cursor: (saving || !parsed.length) ? 'not-allowed' : 'pointer', border: 'none', background: parsed.length ? '#e8b923' : 'var(--border)', color: parsed.length ? '#111' : 'var(--text-muted)', fontWeight: 700 }}>
          {saving ? 'Saving\u2026' : 'Save ' + (parsed.length || '') + ' prices'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {parsed.length ? ('parsed ' + parsed.length + ' drivers \u00b7 ' + parsed.slice(0, 3).map(r => r.driver + ' ' + am(r.odds)).join(', ') + (parsed.length > 3 ? '\u2026' : '')) : 'nothing parsed yet'}
        </span>
        {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <b style={{ fontSize: '0.9rem' }}>History</b>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...inp, minWidth: 320 }}>
            {races.map(r => <option key={r.key} value={r.key}>{r.series + ' R' + r.race_number + ' ' + (r.track_name || '') + ' \u00b7 ' + r.n + ' rows'}</option>)}
          </select>
          <button onClick={() => loadHist(sel)} style={{ padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reload</button>
        </div>

        {loading && <div style={{ color: 'var(--text-secondary)' }}>Loading\u2026</div>}
        {!loading && !grouped.length && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No fastest-lap odds stored yet.</div>}

        {!loading && grouped.map(g => (
          <div key={g.key} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              {ts(g.cap)} \u00b7 <b style={{ textTransform: 'uppercase' }}>{g.book}</b> \u00b7 {g.rows.length} drivers \u00b7 book sum <b>{g.sum}%</b>{' '}
              <span style={{ color: g.vig > 40 ? '#ef4444' : 'var(--text-muted)' }}>(vig {g.vig > 0 ? '+' : ''}{g.vig})</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ color: 'var(--text-muted)' }}>
                  <th style={{ ...td, textAlign: 'left' }}>Driver</th>
                  <th style={{ ...td, textAlign: 'right' }}>Odds</th>
                  <th style={{ ...td, textAlign: 'right' }}>Impl %</th>
                  <th style={{ ...td, textAlign: 'right' }}>De-vig %</th>
                </tr></thead>
                <tbody>
                  {g.rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ ...td, textAlign: 'left' }}>{r.driver_name}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{am(r.odds)}</td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--text-muted)' }}>{impl(r.odds).toFixed(2)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{(impl(r.odds) / g.sum * 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
