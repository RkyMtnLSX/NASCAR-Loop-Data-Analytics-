import React from 'react'

// Racing-stripe corner accents (2026-07-11): static on every page, mirrors the
// RkyMtnBets graphic language. Series identity: cup red / oreilly blue / trucks yellow.
const SEGS = [
  { c: '#f5c518', w: 16 }, { c: '#f5c518', w: 16 }, { c: '#f5c518', w: 16 },
  { c: '#e10600', w: 34 }, { c: '#e10600', w: 16 },
  { c: '#c2179b', w: 34 },
  { c: '#1d6fd1', w: 34 },
]

function Row({ mirror }) {
  const side = mirror ? { right: 0 } : { left: 0 }
  return (
    <div style={{
      position: 'fixed', top: 0, zIndex: 3000, pointerEvents: 'none',
      display: 'flex', gap: 6, padding: '0 12px',
      transform: mirror ? 'scaleX(-1)' : 'none',
      ...side,
    }}>
      {SEGS.map((s, i) => (
        <span key={i} style={{ width: s.w, height: 7, background: s.c, transform: 'skewX(-32deg)' }} />
      ))}
    </div>
  )
}

export default function RacingStripes() {
  return (<><Row /><Row mirror /></>)
}
