# Equipment EL19 — owner list merge and Equipment Form review (2026-10-05, Claude Code)

Owner request (chat, 2026-10-05): merge the supplied equipment list (303 rows) into the existing equipment database and check
whether the Equipment Form is redundant, usable and correct. Decision record: `docs/architecture/DECISION_LOG.md` D-EL19-01.

## Inputs and outputs
| File | Role |
|---|---|
| `internal/equipment_inputs/OWNER_EQUIPMENT_LIST_20261005.csv` | owner list, verbatim (303 rows, SHA-256 in the audit) |
| `internal/3PM_Equipment_Catalog_CANONICAL_EL18_FORM_UX_2026_09_30_R1.json` | baseline, **unchanged** (683 records) |
| `app/tests/phase01/build_equipment_catalog_el19.py` | reproducible, idempotent merge (re-running gives identical bytes) |
| `internal/3PM_Equipment_Catalog_CANONICAL_EL19_OWNER_LIST_2026_10_05_R1.json` | EL19 canonical, 879 records |
| `internal/3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json` | every row decision, rename, fold, conflict, anomaly, hold |
| `app/static/equipment_catalog.js` | regenerated runtime catalog (equals the canonical JSON) |

879 = 683 EL18 − 9 folded duplicates + 205 owner records. Verified records: 674 (the 683 EL18 facts minus the 9 duplicates,
whose sources and ids live on in the kept record). Owner records: 205, all `source_type: owner_supplied_unverified`.

## Merge policy (why the data is trustworthy)
- **Verified data is never overwritten.** Where the owner value differs from a manufacturer-sourced value the verified value
  is kept and the difference is reported (8 conflicts, below).
- **Owner rows are catalogued, not trusted.** They are marked `status: unverified`, `confidence: low`, keep the raw row
  (`owner_row`, `owner_values`) and store numbers only as `reported_*` fields. They never carry the fields the form
  auto-fills or locks (`mass_g`, `mass_oz`, `gpi`, ID/OD, `weight_gr`, `spine`, …). The form shows the reported value as
  text: "Owner list · unverified · reported … — confirm with manufacturer or measure".
- **Product identity is kept separate from size/weight.** Limbs get Short/Medium/Long only when the owner lists the
  standard 66/68/70 in bow lengths (a non-standard length such as 72 is kept as `bow_lengths_unmapped_in`, not guessed);
  marked weight ranges use the form format ("22-50 lb").
- **Ambiguous rows are held, not guessed** (12 holds, below). A held row adds nothing.

Row decisions: 201 add, 90 match (already in the catalog — nothing added), 12 hold.

## Equipment Form review — findings and fixes
| # | Finding (EL18 behaviour) | Effect | Fix in EL19 |
|---|---|---|---|
| F1 | Same product listed twice in one selector: e.g. Shibuya `Vanquish Long Rod` and `VANQUISH`; `MXT-XT Foam` and `MXT-XT` · Foam Core; WNS `SVT Long Rod` and `SVT`; case variants Win&Win `Meta DX`/`META DX`, `Winex`/`WINEX` | coach must guess which entry; two records for one fact | 9 duplicate records folded into the kept record (`merged_ids`, `model_aliases`, `additional_sources`; full removed record kept in the audit); case variants renamed so both length records sit under one entry |
| F2 | Core material embedded in the model name (`NS-G2 Foam`, `Vellator V3 Wood`, `ARGON X Foam Core` …) | model list doubled; core chosen twice | 13 renames: model + `variant` (Foam Core / Wood Core); old spelling kept as alias |
| F3 | Limb Construction joined every construction/core/material with " / " ("Carbon/Foam / Carbon/Wood") | field showed both cores as one value | one value per variant; several → editable choice list ("Choose once: …"); one verified → filled + locked |
| F4 | Saved setups store "<brand> <model>"; after a rename/fold these names no longer existed | saved setup would come back empty (proven: 22/22 old names failed to restore with the EL18 layer) | restore matches ids, `merged_ids` and `model_aliases` (0/22 fail) |
| F5 | Restore read the saved limb name after the brand change had already cleared it | old "… NS-G2 Wood" setup restored the model but lost the core (found by the Chromium gate) | saved name read before restore; core restored as "Wood Core" |
| F6 | (new data) owner values must not look like catalog facts | an unverified mass could be auto-filled/locked | unverified records never auto-fill; labels "· unverified" / "[unverified]"; reported value shown as text with ⚠ when flagged doubtful |
| F7 | Script cache key stayed `el18-formux-r1` | a browser could keep the old catalog with the duplicates | cache keys bumped to `el19-owner-r1` (asserted by the form test) |

Kept as designed (checked, no change): model identity vs size vs marked weight vs measured values are separate fields;
factory vs actual shaft length, catalog point reference vs actual point weight, measured finished arrow weight; the
Pandarus Champion 11-spine matrix (300–800, ID 4.2); 2 Hoyt Carbon Velos records; no RamRods "Ultra V4" alias.

## Conflicts — owner value differs from a verified source (verified kept)
| CSV line | Product | Field | Owner | Verified (kept) |
|---|---|---|---|---|
| 24 | Hoyt Arcos | mass @ 25 in | 1338 g | 1225 g (Hoyt 2022 Target Product Guide) |
| 27 | Hoyt GMX 3 Series | lengths | 25/27 in | 25 in |
| 28 | Hoyt Xceed 2 | lengths | 25 in | 25/27 in |
| 61 | Win&Win ATF-X | mass @ 25 in | 1300 g | 1280 g (WIAWIS 2025 catalog) |
| 62 | Win&Win META DX | mass @ 25 in | 1300 g | 1380 g (WIAWIS 2025 catalog) |
| 64 | Win&Win CX7 | mass @ 25 in | 1250 g | 1280 g (WIAWIS 2025 catalog) |
| 100 | Fivics Vellator | lengths | 25 in | 23/25 in |
| 234 | Pandarus Champion | inside diameter | 3.2 mm | 4.2 mm (mandatory 11-spine matrix) |

## Holds — owner confirmation needed (nothing added for these rows)
| CSV line | Row | Why held |
|---|---|---|
| 101 | Fivics Vellator V2 (riser) | catalog has VELLATOR and Vellator 2026; which generation "V2" is cannot be told |
| 111 | MK Korea Z-Series (riser) | catalog has MK Korea ZX — maybe the same riser |
| 112 | MK Korea Mach 3 (limbs) | catalog has Mach X — different or misnamed? |
| 139 | RamRods Vektor | catalog has Vektor V1.1 (verified); original vs V1.1 not separable (RamRods Priority 1) |
| 141 | RamRods Ultra v4 S | "Super Stiff" may be a variant of Ultra 4, not a model (RamRods Priority 1) |
| 144 | RamRods K2 v2.1 | may be a revision of K2 2 (verified) (RamRods Priority 1) |
| 174 | Fivics Tenfix 6D (tab) | catalog has Tenfix |
| 175 | AAE Cavalier Elite (tab) | catalog has Cavalier |
| 178 | Fairweather Mod Tab | catalog has MODULUS Olympic |
| 189 | Avalon Tec One (tab) | catalog has Tec One Prime Tab |
| 233 | Pandarus Elite CA320 (shaft) | catalog has Elite and CA320 as separate shafts |
| 284 | Easton G-Nock | catalog has 4MM G Nock (list says ID 4.2) |

## Anomalies — kept, flagged, shown with ⚠ in the form (32 records from 31 rows)
- 9 · release year given only as a decade.
- 15 · repeated riser masses that look like placeholders: Hoyt 1224 g ×6, 1315 g ×4, 1133 g ×3; Win&Win 1300 g ×2 added (×3 in the list).
- 6 · several model names in one row, kept exactly as listed (Hoyt `Prodigy / XT`, `F2 / F3 / F4`; RamRods `Ultra v1 / v2` long + side;
  Pandarus point `CA320 / Champion`; EliVanes `S3 / P3`) — owner to say whether these are separate products.
- 1 · aluminum shaft (Easton RX-7) listed with a carbon insert-ID class.
- 1 · Gold Medalist TD4 year 2000 doubtful.

## Tests (all run; red-first evidence where a defect was fixed)
- `app/tests/test_equipment_catalog_el19.js` — counts; runtime = canonical; every EL18 record kept or folded with full audit;
  no undocumented field change; one selector entry per product; 303 rows each one decision; owner records carry no auto-fill
  fields; conflicts keep verified values; anomaly flags; mandatory lineage guards.
- `app/tests/test_equipment_form_el19.js` — all 22 old names restore; owner records never give a mass/weight (also with a
  synthetic owner record carrying `mass_g`); ⚠ text; limb core once per variant; lock only for one verified option; cache keys.
- `app/tests/p108_browser/run_equipment_form_el19_chromium.cjs` — real Chromium, real `index.html`: 18 checks incl. labels,
  single META DX / VANQUISH entry, owner riser/long-rod/damper/point and nock/vane pickers never auto-fill, verified damper still fills, EL18-era
  saved setup restores META DX / NS-G2 Wood Core / VANQUISH, no page errors.
- Mutation check: 6 deliberate defects (EL18 limb options, alias restore removed, owner mass gate removed, owner lock, verified
  Arcos mass overwritten, owner `mass_g` added) — all 6 caught. The pre-fix restore order makes the Chromium gate fail 17/18.

## Not done / limits
- Owner values were not checked against manufacturer sources here; they stay unverified until a source or a measurement exists.
- No RamRods Priority-1 research was done in this round; the 3 RamRods holds need a RamRods source.
- Saved setups are restored by name; a setup saved with a held or custom name stays as typed (custom).
