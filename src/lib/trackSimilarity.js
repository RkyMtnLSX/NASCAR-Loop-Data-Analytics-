// ── Track Similarity — Qualifying Edition ─────────────────────────────────────
// Data sourced from public records: NASCAR.com, track websites, Wikipedia, Racing Reference
// Formula tuned for QUALIFYING correlation (single flying lap), NOT race performance:
//   - Tire wear excluded (irrelevant for 1-lap effort)
//   - Banking weighted heavily (determines corner speed on a hot lap)
//   - HP package is the hard dividing line (completely different car setup)
//
// For race sim, import TRACK_DATA and write a separate raceSimilarity() with
//   tire wear and track position weighted more heavily.

// Speed tier encoding: 0=Slow 1=Low-Medium 2=Medium 3=Medium-High 4=Fast
const SPEED = { SLOW: 0, LOW_MED: 1, MED: 2, MED_HIGH: 3, FAST: 4 }

// Track attributes — physical facts from public sources
// mi: length in miles | bank: avg turn banking (degrees) | pkg: HP package (670/750/'draft')
// speed: speed tier (SPEED.*) | surface: 'asphalt'|'concrete'|'mixed' | turns: corner count
export const TRACK_DATA = {
  // ── 670hp Ovals ──────────────────────────────────────────────────────────────
  'Pocono Raceway':                    { mi: 2.50,  bank: 9.3,  pkg: 670,     speed: SPEED.MED_HIGH, surface: 'asphalt',  turns: 3 },
  'Indianapolis Motor Speedway':       { mi: 2.50,  bank: 9.2,  pkg: 670,     speed: SPEED.MED_HIGH, surface: 'asphalt',  turns: 4 },
  'Michigan International Speedway':   { mi: 2.00,  bank: 18.0, pkg: 670,     speed: SPEED.FAST,     surface: 'asphalt',  turns: 4 },
  'Charlotte Motor Speedway':          { mi: 1.50,  bank: 24.0, pkg: 670,     speed: SPEED.MED_HIGH, surface: 'asphalt',  turns: 4 },
  'Kansas Speedway':                   { mi: 1.50,  bank: 18.5, pkg: 670,     speed: SPEED.MED_HIGH, surface: 'asphalt',  turns: 4 },
  'Las Vegas Motor Speedway':          { mi: 1.50,  bank: 20.0, pkg: 670,     speed: SPEED.FAST,     surface: 'asphalt',  turns: 4 },
  'Texas Motor Speedway':              { mi: 1.50,  bank: 22.0, pkg: 670,     speed: SPEED.FAST,     surface: 'asphalt',  turns: 4 },
  'Homestead-Miami Speedway':          { mi: 1.50,  bank: 19.0, pkg: 670,     speed: SPEED.MED,      surface: 'asphalt',  turns: 4 },
  // ── Drafting Superspeedways ───────────────────────────────────────────────────
  'Daytona International Speedway':    { mi: 2.50,  bank: 31.0, pkg: 'draft', speed: SPEED.FAST,     surface: 'asphalt',  turns: 4 },
  'Talladega Superspeedway':           { mi: 2.66,  bank: 33.0, pkg: 'draft', speed: SPEED.FAST,     surface: 'asphalt',  turns: 4 },
  'Atlanta Motor Speedway':            { mi: 1.54,  bank: 28.0, pkg: 'draft', speed: SPEED.FAST,     surface: 'asphalt',  turns: 4 },
  // ── 750hp Ovals ──────────────────────────────────────────────────────────────
  'Bristol Motor Speedway':            { mi: 0.533, bank: 26.0, pkg: 750,     speed: SPEED.LOW_MED,  surface: 'concrete', turns: 4 },
  'Dover Motor Speedway':              { mi: 1.00,  bank: 24.0, pkg: 750,     speed: SPEED.MED,      surface: 'concrete', turns: 4 },
  'Nashville Superspeedway':           { mi: 1.33,  bank: 14.0, pkg: 750,     speed: SPEED.MED_HIGH, surface: 'concrete', turns: 4 },
  'Darlington Raceway':                { mi: 1.366, bank: 24.5, pkg: 750,     speed: SPEED.MED_HIGH, surface: 'asphalt',  turns: 4 },
  'Phoenix Raceway':                   { mi: 1.00,  bank: 9.7,  pkg: 750,     speed: SPEED.LOW_MED,  surface: 'asphalt',  turns: 4 },
  'Richmond Raceway':                  { mi: 0.75,  bank: 14.0, pkg: 750,     speed: SPEED.SLOW,     surface: 'asphalt',  turns: 4 },
  'Martinsville Speedway':             { mi: 0.526, bank: 12.0, pkg: 750,     speed: SPEED.SLOW,     surface: 'asphalt',  turns: 4 },
  'New Hampshire Motor Speedway':      { mi: 1.058, bank: 4.5,  pkg: 750,     speed: SPEED.LOW_MED,  surface: 'asphalt',  turns: 4 },
  'Iowa Speedway':                     { mi: 0.875, bank: 13.0, pkg: 750,     speed: SPEED.LOW_MED,  surface: 'asphalt',  turns: 4 },
  'North Wilkesboro Speedway':         { mi: 0.625, bank: 14.0, pkg: 750,     speed: SPEED.LOW_MED,  surface: 'asphalt',  turns: 4 },
  // ── Road Courses ─────────────────────────────────────────────────────────────
  'Sonoma Raceway':                    { mi: 1.99,  bank: 0,    pkg: 750,     speed: SPEED.SLOW,     surface: 'asphalt',  turns: 12 },
  'Watkins Glen International':        { mi: 2.45,  bank: 0,    pkg: 750,     speed: SPEED.LOW_MED,  surface: 'asphalt',  turns: 7 },
  'Circuit of the Americas':           { mi: 2.40,  bank: 0,    pkg: 750,     speed: SPEED.SLOW,     surface: 'asphalt',  turns: 17 },
  'Chicago Street Course':             { mi: 2.20,  bank: 0,    pkg: 750,     speed: SPEED.SLOW,     surface: 'asphalt',  turns: 12 },
  'Indianapolis Motor Speedway Road Course': { mi: 2.40, bank: 0, pkg: 750,  speed: SPEED.SLOW,     surface: 'asphalt',  turns: 14 },
}

// ── Qualifying Similarity (0–100) ──────────────────────────────────────────────
// Weights are qualifying-specific — NOT the same as a race correlation formula
//
// Weight rationale:
//   pkg   35 — HP package is a hard dividing line; different package = different car, different aero map
//   bank  25 — Turn banking directly determines corner speed on a single flying lap
//   speed 15 — Speed tier correlates with aero sensitivity and gearing window
//   length 15 — Affects gearing and setup window but less than for a 400-mile race
//   surface 10 — Affects grip level and how rubber lays in during practice
//
// Returns null if either track is unknown; returns 0 for road course ↔ oval comparisons
export function qualSimilarity(trackA, trackB) {
  if (trackA === trackB) return 100
  const a = TRACK_DATA[trackA], b = TRACK_DATA[trackB]
  if (!a || !b) return null

  // Road course vs oval — fundamentally incompatible qualifying formats
  const aRoad = a.turns > 5, bRoad = b.turns > 5
  if (aRoad !== bRoad) return 0

  let score = 0

  // HP package (35pts)
  score += 35 * (a.pkg === b.pkg ? 1 : 0)

  // Banking (25pts) — linear decay, max meaningful diff ~30°
  score += 25 * Math.max(0, 1 - Math.abs(a.bank - b.bank) / 30)

  // Speed tier (15pts) — 4-step scale, penalize each tier of difference
  score += 15 * Math.max(0, 1 - Math.abs(a.speed - b.speed) / 4)

  // Length (15pts) — linear decay over 2.5mi max diff
  score += 15 * Math.max(0, 1 - Math.abs(a.mi - b.mi) / 2.5)

  // Surface (10pts) — full credit for match, 40% partial for asphalt/concrete
  score += 10 * (a.surface === b.surface ? 1 : 0.4)

  return Math.round(score)
}

// Convenience: return sorted list of most similar tracks to a given track
// Returns [{ track, score }, ...] sorted descending
export function similarTracks(trackName, { minScore = 0, excludeSelf = true } = {}) {
  return Object.keys(TRACK_DATA)
    .filter(t => !excludeSelf || t !== trackName)
    .map(t => ({ track: t, score: qualSimilarity(trackName, t) }))
    .filter(t => t.score != null && t.score >= minScore)
    .sort((a, b) => b.score - a.score)
}
