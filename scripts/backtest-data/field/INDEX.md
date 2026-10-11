# DK contest fields (2026-10-11)

Every DraftKings contest-standings export on the operator's computer (July-October 2026), de-duplicated to
`{ lineup[6], copies, points }` per distinct lineup, entry names dropped. Extracted by the script in BACKTEST_LOG
2026-10-11 ("THE REAL FIELD ARRIVES"); mapped to races by contest date / series (post-export files by size + roster).
The live corpus from this date on is `dfs_field_lineups` (sql/dfs_field_lineups.sql), filled by the standings ingest.

| contest | series | race | track | entries | distinct | max copies |
|---|---|---|---|---|---|---|
| 192132073 | cup | 20 | Atlanta | 489 | 390 | 21 |
| 192132081 | cup | 20 | Atlanta | 1469 | 1047 | 57 |
| 192296961 | cup | 21 | North Wilkesboro | 4113 | 2970 | 24 |
| 192343608 | cup | 21 | North Wilkesboro | 486 | 380 | 10 |
| 192343616 | cup | 21 | North Wilkesboro | 1462 | 1004 | 24 |
| 193288059 | oreilly | 23 | Iowa | 4740 | 3612 | 19 |
| 193494026 | cup | 23 | Iowa | 1415 | 1151 | 8 |
| 193602251 | cup | 24 | Richmond | 14224 | 9417 | 70 |
| 193661840 | trucks | 17 | Richmond | 2378 | 1853 | 25 |
| 194069772 | cup | 25 | New Hampshire | 14168 | 8877 | 64 |
| 194069793 | trucks | 18 | New Hampshire | 2369 | 1880 | 17 |
| 194622706 | oreilly | 24 | Daytona | 923 | 695 | 54 |
| 194919870 | cup | 27 | Darlington | 1179 | 956 | 37 |
| 194920057 | oreilly | 25 | Darlington | 1106 | 841 | 45 |
| 194920059 | oreilly | 25 | Darlington | 1188 | 882 | 43 |
| 194920060 | oreilly | 25 | Darlington | 1180 | 919 | 42 |
| 194920587 | oreilly | 25 | Darlington | 291 | 255 | 5 |
| 195147460 | cup | 27 | Darlington | 1189 | 954 | 31 |
| 195183255 | cup | 27 | Darlington | 712 | 615 | 11 |
| 195756974 | trucks | 19 | Bristol | 842 | 556 | 20 |
| 195756975 | trucks | 19 | Bristol | 878 | 589 | 21 |
| 195756976 | trucks | 19 | Bristol | 1130 | 828 | 21 |
| 195778330 | trucks | 19 | Bristol | 585 | 462 | 10 |
| 195957612 | cup | 30 | Kansas | 5907 | 3671 | 60 |
| 196075794 | trucks | 20 | Kansas | 1199 | 906 | 21 |
| 196227891 | cup | 31 | Las Vegas | 18969 | 12078 | 153 |
| 196227899 | cup | 31 | Las Vegas | 9446 | 6271 | 100 |
| 196227902 | cup | 31 | Las Vegas | 584 | 493 | 9 |
| 196227928 | oreilly | 28 | Las Vegas | 9484 | 5572 | 152 |
| 196482083 | trucks | 21 | Charlotte | 1881 | 1509 | 9 |
