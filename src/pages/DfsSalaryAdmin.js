import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim() // 2026-08-14: NFD accent fold (Suarez matching), standard name-join rule

function parseSalaries(text, drivers) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const out = {}, unmatched = [], ids = {}   // ids: DK player IDs from 'Name (12345678)' or ID columns
  const byNorm = {}, byLast = {}
  drivers.forEach(d => { const n = norm(d.name); byNorm[n] = d.name; const p = n.split(' '); if (p.length) byLast[p[p.length - 1]] = d.name })
  lines.forEach(line => {
    let name = null, sal = null
    const cells = line.includes(',') ? line.split(',') : line.split(/\t/)
    if (cells.length > 1) {
      for (const cell of cells) { const m = cell.replace(/[$,\s]/g, '').match(/^\d{4,5}$/); if (m) { const v = +m[0]; if (v >= 2000 && v <= 20000) { sal = v; break } } }
      for (const cell of cells) { const nc = norm(cell.replace(/\(.*\)/, '')); if (byNorm[nc]) { name = byNorm[nc]; break } }
    }
    if (sal === null) { const nums = line.replace(/[$,]/g, '').match(/\b\d{4,5}\b/g) || []; for (const x of nums) { const v = +x; if (v >= 2000 && v <= 20000) { sal = v; break } } }
    if (!name) { const nl = norm(line); for (const d of drivers) { if (nl.indexOf(norm(d.name)) >= 0) { name = d.name; break } } }
    if (!name) { const nl = norm(line); for (const last in byLast) { if (last.length > 2 && new RegExp('\\b' + last + '\\b').test(nl)) { name = byLast[last]; break } } }
    if (name && sal) { out[name] = sal; const idm = line.match(/\((\d{6,10})\)/) || line.replace(/[$]/g, '').match(/(?:^|[,\t])(\d{7,9})(?:[,\t]|$)/); if (idm) ids[name] = idm[1] }
    else if (sal && !name) unmatched.push(line.slice(0, 44))
  })
  return { out, unmatched, ids }
}

export default function DfsSalaryAdmin() {
  const [series, setSeries] = useState('cup')
  const [race, setRace] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [salaries, setSalaries] = useState({})
  const [loading, setLoading] = useState(false)
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [ownPaste, setOwnPaste] = useState('')
  const [ownType, setOwnType] = useState('gpp')
  const [ownMsg, setOwnMsg] = useState('')
  const [ownRaces, setOwnRaces] = useState([])
  const [ownRaceKey, setOwnRaceKey] = useState('')

  // Ownership race selector (2026-08-14): post-contest data is for a PAST race -
  // it was being tagged to the current sim-board week. Completed races only.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('races')
        .select('id,year,race_number,track_name,race_date')
        .eq('series', series).lte('race_date', today)
        .order('race_date', { ascending: false }).limit(12)
      if (!alive) return
      const rs = data || []
      setOwnRaces(rs)
      setOwnRaceKey(rs.length ? rs[0].year + '|' + rs[0].race_number : '')
    })()
    return () => { alive = false }
  }, [series])

  useEffect(() => {
    let alive = true
    setLoading(true); setSalaries({}); setMsg(''); setSaveMsg('')
    ;(async () => {
      const { data } = await supabase.from('sim_results').select('track_name,race_year,race_number,results').eq('series', series).order('published_at', { ascending: false }).limit(1)   // FIX 2026-07-23: id is a UUID - ordering by it is RANDOM (same bug as DFSPage)
      if (!alive) return
      const row = data && data[0]
      if (!row) { setDrivers([]); setRace(null); setLoading(false); return }
      const r = { track: row.track_name, year: row.race_year, rn: row.race_number }
      setRace(r)
      const ds = (row.results || []).map(d => ({ name: d.driver_name, car: d.car_number, projDK: +d.proj_dk || 0 })).filter(d => d.name).sort((a, b) => b.projDK - a.projDK)
      setDrivers(ds)
      let q = supabase.from('dfs_salaries').select('salaries').eq('series', series).eq('race_year', r.year)
      q = r.rn != null ? q.eq('race_number', r.rn) : q.is('race_number', null)
      const { data: sd } = await q.order('updated_at', { ascending: false }).limit(1)
      if (!alive) return
      if (sd && sd[0] && sd[0].salaries) setSalaries(sd[0].salaries)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [series])

  const salCount = Object.values(salaries).filter(v => v > 0).length
  const setSal = (name, val) => setSalaries(s => ({ ...s, [name]: val === '' ? 0 : Math.round(+val) || 0 }))
  // ── Ownership ingest (2026-08-08): DK contest-standings CSV carries a player
  // block with %Drafted. One row per driver per contest type per race.
  const parseOwnership = (text, extraNames) => {
    const byNorm = {}
    drivers.forEach(d => { byNorm[norm(d.name)] = d.name })
    ;(extraNames || []).forEach(n2 => { byNorm[norm(n2)] = n2 }) // past-race field from loop_data
    // first+last fallback (2026-08-14): DK prints 'John H. Nemechek', loop_data has
    // 'John Hunter Nemechek' - middle names/initials never norm-match. Key first+last too.
    const byFL = {}
    Object.keys(byNorm).forEach(k => { const p = k.split(' '); if (p.length >= 2) byFL[p[0] + ' ' + p[p.length - 1]] = byNorm[k] })
    const found = {}
    ;(text || '').split(/\r?\n/).forEach(line => {
      const cells = line.split(',').map(c => c.trim())
      let name = null, pct = null, fpts = null
      for (let ci = 0; ci < cells.length; ci++) {
        const cell = cells[ci]
        const pm = cell.match(/^(\d+(?:\.\d+)?)%$/)
        if (pm) { pct = parseFloat(pm[1]); const nx = parseFloat(cells[ci + 1]); if (isFinite(nx)) fpts = nx; continue }
        const nc = norm(cell)
        if (byNorm[nc]) { name = byNorm[nc] } else if (nc.includes(' ')) { const p2 = nc.split(' '); const k2 = p2[0] + ' ' + p2[p2.length - 1]; if (byFL[k2]) name = byFL[k2] }
      }
      if (name && pct != null && pct >= 0 && pct <= 100) found[name] = { pct: pct, fpts: fpts }
    })
    return found
  }
  const doOwnIngest = async (text) => {
    const sel = ownRaces.find(r2 => (r2.year + '|' + r2.race_number) === ownRaceKey)
    if (!sel) { setOwnMsg('Pick which race this contest was for first.'); return }
    let extra = []
    try {
      const { data: ld } = await supabase.from('loop_data').select('driver_name').eq('race_id', sel.id)
      extra = [...new Set((ld || []).map(d2 => d2.driver_name))]
    } catch (e3) {}
    const found = parseOwnership(text, extra)
    const n = Object.keys(found).length
    if (!n) { setOwnMsg('No driver ownership rows recognized in that paste/file.'); return }
    const rows2 = Object.keys(found).map(name => ({
      series, race_year: sel.year, race_number: sel.race_number,
      track_name: sel.track_name, driver_name: name,
      own_pct: found[name].pct, fpts: found[name].fpts, contest_type: ownType,
    }))
    // Contest field distribution (2026-08-14): entry rows carry Rank/EntryId/Points.
    // Bank winner/median/percentiles + decile curve so the weekly optimizer-replay
    // report can place our optimal lineup in the real contest field.
    try {
      const scores = []
      ;(text || '').split(/\r?\n/).forEach(line2 => {
        const c2 = line2.split(',')
        if (c2.length >= 5 && /^\d{6,}$/.test((c2[1] || '').trim())) { const v = parseFloat(c2[4]); if (isFinite(v)) scores.push(v) }
      })
      if (scores.length >= 50) {
        scores.sort((a, b) => b - a)
        const pick = f2 => scores[Math.min(scores.length - 1, Math.floor(f2 * (scores.length - 1)))]
        const dec = []; for (let k2 = 0; k2 <= 10; k2++) dec.push(pick(k2 / 10))
        await supabase.from('dfs_contests').upsert({
          series, race_year: sel.year, race_number: sel.race_number, track_name: sel.track_name,
          contest_type: ownType, entries: scores.length, winner_score: scores[0],
          median_score: pick(0.5), pct90: pick(0.1), pct75: pick(0.25), pct25: pick(0.75),
          scores_sample: dec,
        }, { onConflict: 'series,race_year,race_number,contest_type' })
      }
    } catch (e4) {}
    const { error } = await supabase.from('dfs_ownership')
      .upsert(rows2, { onConflict: 'series,race_year,race_number,driver_name,contest_type' })
    setOwnMsg(error
      ? 'Save failed: ' + error.message + (error.message.includes('does not exist') ? ' - run dfs_ownership_schema.sql in Supabase first.' : '')
      : 'Saved ownership + FPTS for ' + n + ' drivers (' + ownType.toUpperCase() + ', ' + sel.year + ' R' + sel.race_number + ' ' + sel.track_name + ').')
  }
  const doOwnFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setOwnPaste(String(ev.target.result || '')); doOwnIngest(String(ev.target.result || '')) }
    reader.readAsText(file)
    e.target.value = ''
  }
  const doFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target.result || '')
      setPaste(text)
      const { out, unmatched, ids } = parseSalaries(text, drivers)
      setSalaries(s => ({ ...s, ...out, __ids: { ...(s.__ids || {}), ...ids } }))
      const n = Object.keys(out).length, ni = Object.keys(ids).length
      setMsg('File: matched ' + n + ' driver' + (n === 1 ? '' : 's') + ', ' + ni + ' DK IDs captured.' + (unmatched.length ? ' Unmatched: ' + unmatched.length + ' (edit below).' : '') + (ni < n ? ' WARNING: some drivers have no DK ID - lineup export will be incomplete.' : ''))
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  const doPaste = () => {
    const { out, unmatched, ids } = parseSalaries(paste, drivers)
    setSalaries(s => ({ ...s, ...out, __ids: { ...(s.__ids || {}), ...ids } }))
    const n = Object.keys(out).length
    const ni = Object.keys(ids).length; setMsg('Matched ' + n + ' driver' + (n === 1 ? '' : 's') + ', ' + ni + ' DK IDs.' + (unmatched.length ? ' Unmatched: ' + unmatched.length + ' (edit below).' : '') + (ni === 0 ? ' NOTE: no DK IDs in paste - upload the DK CSV file for lineup-export IDs.' : ''))
  }
  const clearAll = () => { setSalaries({}); setMsg('Cleared (not yet saved).') }
  const save = async () => {
    if (!race) return
    setSaveMsg('Saving\u2026')
    try {
      let del = supabase.from('dfs_salaries').delete().eq('series', series).eq('race_year', race.year)
      del = race.rn != null ? del.eq('race_number', race.rn) : del.is('race_number', null)
      await del
      const { error } = await supabase.from('dfs_salaries').insert({ series, race_year: race.year, race_number: race.rn, track_name: race.track, salaries })
      if (error) setSaveMsg('Save failed: ' + error.message)
      else setSaveMsg('Saved ' + salCount + ' salaries \u2014 live on the DFS Center for everyone.')
    } catch (e) { setSaveMsg('Save failed: ' + (e.message || e)) }
  }

  const inp = { background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }
  return (
    <div>
      <h3 style={{ margin: '4px 0 10px' }}>DFS Salaries</h3>
      <div style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13, marginBottom: 12 }}>
        Paste the DraftKings salary export or edit manually, then Save. Salaries publish to the public DFS Center.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {SERIES.map(s => (
          <button key={s.v} onClick={() => setSeries(s.v)} style={{ padding: '6px 13px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: series === s.v ? '#e8b923' : 'transparent', color: series === s.v ? '#111' : 'var(--text-secondary,#9aa0aa)', fontWeight: series === s.v ? 700 : 400 }}>{s.label}</button>
        ))}
        {race && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{race.track} &middot; {race.year} &middot; Race {race.rn} &middot; {salCount}/{drivers.length} set</span>}
      </div>

      {loading && <div style={{ color: 'var(--text-secondary,#9aa0aa)' }}>Loading\u2026</div>}
      {!loading && !drivers.length && <div style={{ color: 'var(--text-secondary,#9aa0aa)' }}>No published sim for this series yet.</div>}

      {!loading && drivers.length > 0 && <>
        <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste DraftKings salary CSV (or Name, Salary rows)\u2026"
          style={{ width: '100%', minHeight: 80, ...inp, fontFamily: 'monospace', fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0 14px', flexWrap: 'wrap' }}>
          <button onClick={doPaste} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text,#e8eaed)' }}>Import from paste</button>
          <label style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid #e8b923', background: 'transparent', color: '#e8b923', fontWeight: 600 }}>
            Upload DK CSV file
            <input type="file" accept=".csv,text/csv" onChange={doFile} style={{ display: 'none' }} />
          </label>
          <button onClick={save} style={{ padding: '6px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#e8b923', color: '#111', fontWeight: 700 }}>Save salaries</button>
          <button onClick={clearAll} style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text-secondary,#9aa0aa)' }}>Clear</button>
          {msg && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>{msg}</span>}
          {saveMsg && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>{saveMsg}</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Driver</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Proj DK</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Salary</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Value</th>
            </tr></thead>
            <tbody>
              {drivers.map(d => {
                const sal = salaries[d.name] || 0
                const val = sal > 0 ? (d.projDK / (sal / 1000)).toFixed(2) : '\u2014'
                return (
                  <tr key={d.name} style={{ borderBottom: '1px solid var(--border,#22252b)' }}>
                    <td style={{ padding: '4px 8px' }}>{d.car ? '#' + d.car + ' ' : ''}{d.name}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.projDK.toFixed(1)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input value={sal || ''} onChange={e => setSal(d.name, e.target.value)} placeholder="\u2014" style={{ width: 66, textAlign: 'right', ...inp }} />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{val}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--border,#2a2d34)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Ownership (post-contest)</h3>
          <div style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13, marginBottom: 10 }}>
            After the race, export the DK contest standings CSV (it contains %Drafted per driver) and upload it here.
            This builds the ground-truth table the ownership-projection model will train on.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <select value={ownRaceKey} onChange={e => setOwnRaceKey(e.target.value)} style={{ ...inp, padding: '6px 10px' }}>
              {ownRaces.map(r2 => (
                <option key={r2.year + '|' + r2.race_number} value={r2.year + '|' + r2.race_number}>
                  {r2.year} R{r2.race_number} · {r2.track_name}
                </option>
              ))}
            </select>
            <select value={ownType} onChange={e => setOwnType(e.target.value)} style={{ ...inp, padding: '6px 10px' }}>
              <option value="gpp">GPP / Tournament</option>
              <option value="cash">Cash / 50-50</option>
            </select>
            <label style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid #e8b923', background: 'transparent', color: '#e8b923', fontWeight: 600 }}>
              Upload contest standings CSV
              <input type="file" accept=".csv,text/csv" onChange={doOwnFile} style={{ display: 'none' }} />
            </label>
            <button onClick={() => doOwnIngest(ownPaste)} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text,#e8eaed)' }}>Import from paste</button>
            {ownMsg && <span style={{ color: ownMsg.includes('failed') || ownMsg.includes('No driver') ? '#ef4444' : '#22c55e', fontSize: 13 }}>{ownMsg}</span>}
          </div>
          <textarea value={ownPaste} onChange={e => setOwnPaste(e.target.value)} placeholder="Or paste the contest standings CSV text here\u2026"
            style={{ width: '100%', minHeight: 60, ...inp, fontFamily: 'monospace', fontSize: 12 }} />
        </div>
      </>}
    </div>
  )
}
