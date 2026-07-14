import { supabase } from './supabase'

// EXHIBITION GUARD (2026-07-14)
//
// All-Star / non-points races run a REDUCED FIELD (~20 cars vs ~38). This is not a cosmetic
// difference -- it mechanically inflates driver_rating, because 'pct_top15_laps' and the
// rating formula's percentile components are computed against the field. In a 20-car field the
// top 15 pct of laps is a far larger share of the grid, so every driver's rating drifts upward.
// The invitational entry list adds availability bias on top (only winners/past champs are there).
//
// These races must never feed the model~ not corrHistory, not trackHistory, not the caution
// preset, not the race-length/DNF estimate, and not the public averages tables.
//
// loop_data has NO exhibition column, and both the sim and the LoopData page read loop_data by
// track_name WITHOUT joining races -- so flagging races.exhibition alone does NOT protect them.
// The single source of truth is races.exhibition; we resolve it to a race_id list and exclude.
//
// Known members~ Dover 2026 (Cup All-Star, races.id 399). North Wilkesboro Cup All-Star is NOT
// loaded and should stay that way (see BACKTEST_LOG).

let _cache = null

export async function getExhibitionRaceIds() {
  if (_cache) return _cache
  _cache = (async () => {
    try {
      const { data } = await supabase.from('races').select('id').eq('exhibition', true)
      return (data || []).map(function (r) { return r.id })
    } catch (e) {
      return []
    }
  })()
  return _cache
}

// Wrap any supabase query on a table that has a race_id column.
export function excludeExhibition(query, ids) {
  if (!ids || !ids.length) return query
  return query.not('race_id', 'in', '(' + ids.join(',') + ')')
}
