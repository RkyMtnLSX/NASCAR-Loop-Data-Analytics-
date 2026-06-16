import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function LoopDataAudit() {
  const [activeSeries, setActiveSeries] = useState('cup')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [auditErr, setAuditErr] = useState(null)

  useEffect(() => { fetchAudit(activeSeries) }, [activeSeries])

  async function fetchAudit(s) {
    setLoading(true); setAuditErr(null)
    const { data, error } = await supabase.rpc('get_audit_data', { p_series: s })
    if (error) { setAuditErr(error.message); setLoading(false); return }
    const mapped = (data || []).map(r => ({
      year: r.year,
      race_number: r.race_number,
      track_name: r.track_name,
      count: Number(r.cnt)
    }))
    setRows(mapped)
    setLoading(false)
  }

  function countColor(n) {
    if (n >= 30) return '#27AE60'
    if (n >= 20) return '#F39C12'
    return '#E74C3C'
  }

  const byYear = {}
  rows.forEach(r => { if (!byYear[r.year]) byYear[r.year] = []; byYear[r.year].push(r) })
  const years = Object.keys(byYear).sort((a, b) => b - a)
  const totalRaces = rows.length

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1 className="page-title">Loop Data Audit</h1>
        <p className="page-subtitle">Verify race coverage and spot data gaps across all series</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ value: 'cup', label: 'Cup Series' }, { value: 'oreilly', label: "O'Reilly Series" }, { value: 'trucks', label: 'Truck Series' }].map(t => (
          <button key={t.value} onClick={() => setActiveSeries(t.value)}
            className={activeSeries === t.value ? 'btn btn-primary' : 'btn'}
            style={{ fontSize: '0.8125rem', padding: '6px 14px' }}>
            {t.label}
          </button>
        ))}
      </div>
      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading...</p>}
      {auditErr && <p style={{ color: '#E74C3C', fontSize: '0.875rem' }}>{auditErr}</p>}
      {!loading && !auditErr && years.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No data found.</p>
      )}
      {!loading && years.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {totalRaces} race{totalRaces !== 1 ? 's' : ''} loaded across {years.length} season{years.length !== 1 ? 's' : ''}
        </div>
      )}
      {!loading && years.map(yr => (
        <div key={yr} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {yr}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {byYear[yr].length} race{byYear[yr].length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th className="left">Track</th>
                  <th style={{ width: 90 }}>Drivers</th>
                </tr>
              </thead>
              <tbody>
                {byYear[yr].sort((a, b) => a.race_number - b.race_number).map(r => (
                  <tr key={`${yr}-${r.race_number}`}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {r.race_number}
                    </td>
                    <td className="left" style={{ fontSize: '0.875rem' }}>{r.track_name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: countColor(r.count) }}>
                        {r.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
