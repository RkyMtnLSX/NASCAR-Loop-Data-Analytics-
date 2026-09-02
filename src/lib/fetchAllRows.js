// Paginated Supabase read. Use this for ANY query whose result set can grow past a few thousand
// rows (added 2026-09-02).
//
// WHY THIS EXISTS: PostgREST silently caps every response at 5,000 rows. Not an error, not a
// warning, no flag on the response — the query just returns 5,000 and the code downstream has no
// way to know more existed. Verified live on 2026-09-02: `loop_data` for cup returns 5,000 of
// 6,348, `qualifying_results` for cup returns 5,000 of 5,943.
//
// Which rows get dropped is NOT predictable. An earlier version of this note claimed heap order
// drops the newest rows; measured live on 2026-09-02 (review) that is false for this database —
// an unordered cup `loop_data` read lost rows from EVERY season (2022: 517 of 1,322 missing,
// 2026: 494 of 981) and the set differed between requests. Updated rows move in the heap. Treat
// an unordered truncated read as a random sample with no error flag, which is worse.
//
// The `orderColumn` MUST be unique. `.range()` issues one request per page and Postgres guarantees
// no row order without a total ORDER BY, so ordering by a non-unique column lets rows tied on it
// reshuffle between requests: the same row can arrive twice while another never arrives at all.
// That is a separate bug from the cap, and it bit PitCrewRankings on 2026-09-02 (stop counts off by
// up to 2x in both directions). One helper prevents both.
//
// `build` must be a FUNCTION returning a fresh query builder — supabase builders are single-use
// thenables, so the same object cannot be re-ranged for a second page.
//
//   const { data, error } = await fetchAllRows(() =>
//     supabase.from('loop_data').select('...').eq('series', s))
//
export async function fetchAllRows(build, opts) {
  const o = opts || {}
  const orderColumn = o.orderColumn || 'id'
  const pageSize = o.pageSize || 1000
  // 200k rows. The largest table (practice_laps) is ~132k; the bail exists to stop a runaway loop,
  // NOT to bound normal reads. The original 60k default silently truncated odds_snapshots (68,832
  // rows) and dropped a race from the Line Movement picker - the exact failure this helper was
  // written to prevent - because every caller discards `error`. Hence console.error below.
  const maxPages = o.maxPages || 200
  let out = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize
    const { data, error } = await build()
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error: error }
    const batch = data || []
    out = out.concat(batch)
    if (batch.length < pageSize) return { data: out, error: null }
  }
  // Hitting this means the result set is larger than maxPages*pageSize. Returning what we have
  // WITH an error is deliberate: a caller that ignores `error` still degrades to the old truncating
  // behaviour rather than crashing, and one that checks it finds out instead of guessing. No
  // current caller checks it, so the truncation is also logged loudly - a silent partial read is
  // the whole reason this file exists.
  const msg = 'fetchAllRows: exceeded ' + maxPages * pageSize + ' rows; result is TRUNCATED. Raise maxPages or filter harder.'
  console.error(msg)
  return { data: out, error: new Error(msg) }
}

export default fetchAllRows
