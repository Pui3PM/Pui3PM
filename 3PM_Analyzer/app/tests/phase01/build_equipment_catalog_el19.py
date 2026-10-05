"""Build Equipment Catalog EL19 from EL18 + the owner-supplied list of 2026-10-05 (reproducible, monotonic).

Rules (AGENTS.md / HANDOFF items 4-9):
- Every EL18 verified record keeps its id and data. Only evidence-backed supersessions are applied, each written into the
  audit: (a) model spelling normalised to the manufacturer spelling (old spelling kept in model_aliases), (b) records that
  repeat an existing product with no additional facts are folded into it (id kept in merged_ids, source kept in
  additional_sources) so a product appears once in the Equipment Form.
- Owner rows have no per-row source. They are added ONLY when the product is not already in the catalog, as
  source_type 'owner_supplied_unverified' with their values stored as reported_* fields (never mass_g / gpi / inside
  diameter, which the form auto-fills or locks). Owner rows that name an existing product are matched, never overwrite
  verified data, and any disagreement is reported as a conflict. Ambiguous names are held for owner confirmation.
Usage: python3 app/tests/phase01/build_equipment_catalog_el19.py   (cwd = package root). Writes the EL19 canonical JSON,
the merge audit and app/static/equipment_catalog.js.
"""
import csv, json, re, hashlib, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EL18 = ROOT / 'internal/3PM_Equipment_Catalog_CANONICAL_EL18_FORM_UX_2026_09_30_R1.json'
OWNER = ROOT / 'internal/equipment_inputs/OWNER_EQUIPMENT_LIST_20261005.csv'
OUT_JSON = ROOT / 'internal/3PM_Equipment_Catalog_CANONICAL_EL19_OWNER_LIST_2026_10_05_R1.json'
OUT_AUDIT = ROOT / 'internal/3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json'
OUT_JS = ROOT / 'app/static/equipment_catalog.js'
VERSION = 'EL19-OWNER-LIST-2026-10-05-R1'
OWNER_SOURCE = 'Owner-supplied equipment list 2026-10-05 (no per-row source; values not independently verified)'

# ---------------------------------------------------------------- EL18 supersessions (evidence in 'why')
RENAMES = [  # id, new model, new variant (None = unchanged), why
    ('wiawis_win_win_meta_dx_riser', 'META DX', None, 'case variant of the manufacturer spelling (WIAWIS 2025 catalog: META DX); both appeared as two models'),
    ('wiawis_win_win_winex_riser', 'WINEX', None, 'case variant of the manufacturer spelling (WIAWIS 2025 catalog: WINEX)'),
    ('wiawis_win_win_winex_limbs', 'WINEX', None, 'case variant of the manufacturer spelling (WIAWIS 2025 catalog: WINEX)'),
    ('wiawis_win_win_ns_g2_foam_limbs', 'NS-G2', 'Foam Core', 'core moved from model name to variant, as in the WIAWIS 2025 catalog pattern (MXT-XT / Foam Core)'),
    ('wiawis_win_win_ns_g2_wood_limbs', 'NS-G2', 'Wood Core', 'core moved from model name to variant, as in the WIAWIS 2025 catalog pattern'),
    ('fivics_vellator_v3_foam_limbs', 'Vellator V3', 'Foam Core', 'core moved from model name to variant (one limb model, core chosen once)'),
    ('fivics_vellator_v3_wood_limbs', 'Vellator V3', 'Wood Core', 'core moved from model name to variant'),
    ('fivics_2020_argon_x_wood_core', 'ARGON X', 'Wood Core', 'core moved from model name to variant (FIVICS 2020 guide family ARGON X)'),
    ('fivics_2020_argon_x_foam_core', 'ARGON X', 'Foam Core', 'core moved from model name to variant'),
    ('fivics_2020_titan_ex_wood_core', 'TITAN EX', 'Wood Core', 'core moved from model name to variant (FIVICS 2020 guide family TITAN EX)'),
    ('fivics_2020_titan_ex_foam_core', 'TITAN EX', 'Foam Core', 'core moved from model name to variant'),
    ('fivics_2020_vellator_wood_core', 'VELLATOR', 'Wood Core', 'core moved from model name to variant (FIVICS 2020 guide family VELLATOR)'),
    ('fivics_2020_vellator_foam_core', 'VELLATOR', 'Foam Core', 'core moved from model name to variant'),
]
FOLDS = [  # duplicate id -> surviving id, why
    ('shibuya_vanquish_long_rod', 'shibuya_vanquish_long_rod_long_rod', 'same Shibuya Vanquish long rod; market listing asserted no specs; Shibuya official record kept'),
    ('wiawis_win_win_wiawis_acs_lx_long_rod', 'wiawis_win_win_acs_lx_long_rod', 'same WIAWIS ACS-LX long rod (brand prefix + category suffix only); listing asserted no specs'),
    ('wns_svt_long_rod', 'el10_wns_long_svt', 'same WNS SVT long rod (category suffix only); listing asserted no specs; manufacturer record kept'),
    ('wiawis_win_win_mxt_xt_foam_limbs', 'wiawis_win_win_mxt_xt_foam_core', 'retailer "MXT-XT Foam" = WIAWIS 2025 catalog MXT-XT / Foam Core; retailer asserted no specs'),
    ('wiawis_win_win_mxt_xt_wood_limbs', 'wiawis_win_win_mxt_xt_wood_core', 'retailer "MXT-XT Wood" = WIAWIS 2025 catalog MXT-XT / Wood Core'),
    ('wiawis_win_win_cx7_foam_limbs', 'wiawis_win_win_cx7_foam_core', 'retailer "CX7 Foam" = WIAWIS 2025 catalog CX7 / Foam Core'),
    ('wiawis_mxt_xp_foam_limbs', 'wiawis_win_win_mxt_xp_foam_core', 'retailer "MXT-XP Foam" = WIAWIS 2025 catalog MXT-XP / Foam Core'),
    ('wiawis_ns_g_foam_limbs', 'wiawis_win_win_ns_g_foam_core', 'retailer "NS-G Foam" = WIAWIS 2025 catalog NS-G / Foam Core'),
    ('fivics_argon_x_foam_limbs', 'fivics_2020_argon_x_foam_core', 'retailer "Argon X Foam" = FIVICS ARGON X / Foam Core; retailer listing asserted no specs (kept as additional source)'),
]

# ---------------------------------------------------------------- owner-row decisions
CAT = {'Riser': 'riser', 'Limbs': 'limbs', 'Tab': 'finger_tab', 'Arrow Shaft': 'arrow', 'Vane': 'vane', 'Point': 'point',
       'Nock': 'nock', 'Damper': 'damper', 'Weight': 'stabilizer_weight', 'Pin Adapter': 'bushing'}
BRAND = {'Win&Win': 'WIAWIS / Win&Win', 'Wiawis': 'WIAWIS / Win&Win', 'Epic': 'Epic Archery', 'Gas Pro': 'GAS PRO', 'Flex Fletch': 'Flex-Fletch'}
# (Category, Brand, Model) -> ('match', [(category, brand, model), ...], note) | ('hold', reason) | ('add', overrides)
D = {
    ('Limbs', 'Hoyt', 'Velos'): ('match', [('limbs', 'Hoyt', 'Carbon Velos')], 'Hoyt markets these limbs as Carbon Velos'),
    ('Limbs', 'Hoyt', 'Axia'): ('match', [('limbs', 'Hoyt', 'Axia Resin Core'), ('limbs', 'Hoyt', 'Axia Syntactic Foam Core')], 'core-specific verified records'),
    ('Riser', 'Win&Win', 'Inno CXT'): ('match', [('riser', 'WIAWIS / Win&Win', 'INNO CXT')], ''),
    ('Limbs', 'Wiawis', 'NS-G2'): ('match', [('limbs', 'WIAWIS / Win&Win', 'NS-G2')], ''),
    ('Limbs', 'WNS', 'Explore CW'): ('match', [('limbs', 'WNS', 'Explore CW1')], 'WNS model code is CW1'),
    ('Riser', 'Fivics', 'Titan NX'): ('match', [('riser', 'Fivics', 'TITAN-NXT')], 'FIVICS catalog spelling TITAN-NXT'),
    ('Riser', 'Fivics', 'Argon X'): ('match', [('riser', 'Fivics', 'ARGON-X')], ''),
    ('Limbs', 'Fivics', 'Titan EX'): ('match', [('limbs', 'Fivics', 'TITAN EX')], ''),
    ('Limbs', 'Fivics', 'Vellator'): ('match', [('limbs', 'Fivics', 'VELLATOR')], ''),
    ('Limbs', 'Fivics', 'Argon X'): ('match', [('limbs', 'Fivics', 'ARGON X')], ''),
    ('Riser', 'Fivics', 'Vellator V2'): ('hold', 'catalog has VELLATOR and Vellator 2026 risers; which generation "V2" is cannot be confirmed from the list'),
    ('Riser', 'MK Korea', 'Z-Series'): ('hold', 'catalog has MK Korea ZX; "Z-Series" may be the same riser'),
    ('Limbs', 'MK Korea', 'Mach 3'): ('hold', 'catalog has MK Korea Mach X; "Mach 3" may be a different or misnamed model'),
    ('Stabilizer', 'RamRods', 'Ultra v3'): ('match', [('long_rod', 'RamRods', 'Ultra V3'), ('side_rod', 'RamRods', 'Ultra V3')], ''),
    ('Stabilizer', 'RamRods', 'Ultra v4'): ('match', [('long_rod', 'RamRods', 'Ultra 4'), ('side_rod', 'RamRods', 'Ultra 4')], 'RamRods current name is "Ultra 4" (EL17 rule: no "Ultra V4" alias in the selector)'),
    ('Stabilizer', 'RamRods', 'K2 v2'): ('match', [('long_rod', 'RamRods', 'K2 2'), ('side_rod', 'RamRods', 'K2 2')], 'RamRods current name is "K2 2"'),
    ('Stabilizer', 'RamRods', 'Vektor 2'): ('match', [('long_rod', 'RamRods', 'Vektor 2'), ('side_rod', 'RamRods', 'Vektor 2')], ''),
    ('Stabilizer', 'RamRods', 'Vektor'): ('hold', 'catalog has Vektor V1.1 (verified); original Vektor vs V1.1 cannot be separated from the list'),
    ('Stabilizer', 'RamRods', 'Ultra v4 S'): ('hold', '"Super Stiff" may be a variant of Ultra 4 rather than a separate model; RamRods Priority 1 needs a source'),
    ('Stabilizer', 'RamRods', 'K2 v2.1'): ('hold', 'may be a revision of K2 2 (verified); needs RamRods source before it becomes a separate selector entry'),
    ('Mount', 'RamRods', 'EDGE G3 / EDGE'): ('match', [('vbar', 'RamRods', 'EDGE Fixed V-Bar')], ''),
    ('Mount', 'RamRods', 'EDGE Adjustable'): ('match', [('vbar', 'RamRods', 'EDGE Adjustable V-Bar')], ''),
    ('Mount', 'RamRods', 'EDGE Offset Mount'): ('match', [('vbar', 'RamRods', 'EDGE Adjustable Offset Mount')], ''),
    ('Mount', 'RamRods', 'EDGE Quick Disconnect'): ('match', [('quick_disconnect', 'RamRods', 'EDGE Quick Disconnect - Small'), ('quick_disconnect', 'RamRods', 'EDGE Quick Disconnect - Large')], ''),
    ('Mount', 'RamRods', 'EDGE Carbon Ext.'): ('match', [('extender', 'RamRods', 'EDGE Carbon Extension')], ''),
    ('Mount', 'RamRods', 'Aluminum Ext. v2'): ('match', [('extender', 'RamRods', 'Aluminum Extension 2')], ''),
    ('Mount', 'RamRods', 'Macrolite'): ('add', {'category': 'vbar'}),
    ('Mount', 'RamRods', 'Microlite'): ('add', {'category': 'vbar'}),
    ('Weight', 'RamRods', 'Standard Weights'): ('match', [('stabilizer_weight', 'RamRods', 'Stainless Steel Weight Collection'), ('stabilizer_weight', 'RamRods', 'Stainless Steel Large 4 oz Weight')], ''),
    ('Weight', 'RamRods', 'Tungsten Weights'): ('match', [('stabilizer_weight', 'RamRods', 'Tungsten Weight')], ''),
    ('Weight', 'RamRods', 'Tungsten Damping Weights'): ('match', [('stabilizer_weight', 'RamRods', 'Tungsten Damping Weight')], ''),
    ('Damper', 'RamRods', 'EQ Cylinder Damper'): ('match', [('damper', 'RamRods', 'EQ Cylinder Damper - 1.25 inch')], ''),
    ('Damper', 'RamRods', 'EQ Bow Damper'): ('match', [('damper', 'RamRods', 'EQ Bow Damper - 0.75 inch')], ''),
    ('Tab', 'Fivics', 'Tenfix 6D'): ('hold', 'catalog has Fivics Tenfix; "6D" may describe the same tab'),
    ('Tab', 'AAE', 'Cavalier Elite'): ('hold', 'catalog has AAE Cavalier; "Elite" may be the same tab'),
    ('Tab', 'AAE', 'KSL Gold Brass'): ('match', [('finger_tab', 'KSL', 'Gold')], 'KSL Gold tab is catalogued under brand KSL'),
    ('Tab', 'AAE', 'KSL Aluminum'): ('add', {'brand': 'KSL', 'model': 'Aluminum'}),
    ('Tab', 'Fairweather', 'Mod Tab'): ('hold', 'catalog has Fairweather MODULUS Olympic; "Mod Tab" may be the same tab'),
    ('Tab', 'Shibuya', 'Apex'): ('match', [('finger_tab', 'Shibuya', 'APEX Tab')], ''),
    ('Tab', 'Avalon', 'Tec One'): ('hold', 'catalog has Avalon Tec One Prime Tab; "Tec One" may be the same tab'),
    ('Tab', 'Bicaster', 'ASA'): ('match', [('finger_tab', 'Bicaster', 'ASA Finger Tab')], ''),
    ('Arrow Shaft', 'Pandarus', 'Elite CA320'): ('hold', 'catalog has separate Pandarus Elite and CA320 shafts; the list joins the names'),
    ('Point', 'Easton', 'X10 Stainless'): ('match', [('point', 'Easton', 'X10 Stainless Steel Break-Off Points')], ''),
    ('Nock', 'Beiter', 'Insert Nock (12/1 & 12/2)'): ('match', [('nock', 'Beiter', 'Insert-Nock')], ''),
    ('Nock', 'Beiter', 'Pin Nock'): ('match', [('nock', 'Beiter', 'Pin-Nock')], ''),
    ('Nock', 'Easton', 'G-Nock'): ('hold', 'catalog has Easton 4MM G Nock; the list says ID 4.2 G-Nock (possibly the same)'),
    ('Vane', 'XS Wings', 'Target Profile'): ('match', [('vane', 'XS Wings', '40mm Vanes'), ('vane', 'XS Wings', '50mm Vanes')], ''),
}
STAB_SPLIT = ('long_rod', 'side_rod')

def slug(s): return re.sub(r'[^a-z0-9]+', '_', str(s).lower()).strip('_')
def num(s):
    try: return float(s)
    except (TypeError, ValueError): return None
def clean_num(x): return int(x) if float(x).is_integer() else round(float(x), 4)

def parse_lengths_in(s):
    return [clean_num(float(m)) for m in re.findall(r'(\d+(?:\.\d+)?)\s*"', s or '')]

def year_fields(y):
    y = (y or '').strip()
    if re.fullmatch(r'\d{4}', y): return {'release_year_reported': int(y)}
    if re.fullmatch(r'\d{4}s', y): return {'release_period_reported': y}
    return {}

def fitting(sys):
    s = (sys or '').lower()
    if 'formula' in s and ('ilf' in s or '&' in s): return 'Grand Prix / ILF + Hoyt Formula (reported)'
    if 'formula' in s: return 'Hoyt Formula (reported)'
    if 'ilf' in s: return 'Grand Prix / ILF (reported)'
    return None

def owner_record(row, line, overrides):
    cat = overrides.get('category') or CAT.get(row['Category'])
    brand = overrides.get('brand') or BRAND.get(row['Brand'], row['Brand'])
    model = overrides.get('model') or row['Model'].strip()
    r = {'id': None, 'category': cat, 'brand': brand, 'model': model,
         'source_type': 'owner_supplied_unverified', 'source': OWNER_SOURCE, 'status': 'unverified', 'confidence': 'low',
         'owner_row': line, 'owner_values': {k: row[k] for k in row}}
    r.update(year_fields(row['Year_Released']))
    size, wt, mat, note, sysT = row['Size_Length'].strip(), row['Weight_Mass_Draw'].strip(), row['Material_Core_Damping'].strip(), row['Notes'].strip(), row['System_Type'].strip()
    if mat and mat != '-' and cat != 'limbs': r['material_reported'] = mat   # limbs: stored once as construction
    if note: r['notes_reported'] = note
    if cat == 'riser':
        L = parse_lengths_in(size)
        if L: r['length_options_in'] = L
        if len(L) == 1: r['length_in'] = L[0]
        f = fitting(sysT)
        if f: r['fitting'] = f
        m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*g', wt)
        if m:
            r['reported_mass_g'] = clean_num(float(m.group(1)))
            if len(L) > 1: r['reported_mass_note'] = 'riser length for this mass not stated'
    elif cat == 'limbs':
        L = parse_lengths_in(size)
        if L: r['bow_lengths_in'] = L
        if {66, 68, 70} <= set(L):
            r['sizes'] = ['Short', 'Medium', 'Long']
            r['size_mapping_basis'] = 'ILF convention: 66/68/70 in bow with a 25 in riser = Short/Medium/Long'
            extra = [x for x in L if x not in (66, 68, 70)]
            if extra: r['bow_lengths_unmapped_in'] = extra
        m = re.fullmatch(r'(\d+)\s*-\s*(\d+)\s*lbs?', wt)
        if m: r['marked_weight_lb_range'] = f'{m.group(1)}-{m.group(2)} lb'
        if mat: r['construction'] = mat
        f = fitting(sysT)
        if f: r['fitting'] = f
    elif cat in STAB_SPLIT:
        m = re.fullmatch(r'(\d*\.\d+|\d+)\s*"', size)
        if m: r['diameter_in'] = clean_num(float(m.group(1)))
        elif size: r['diameter_profile'] = size
        if mat: r['damping'] = mat
    elif cat == 'vbar':
        r['variant'] = size if re.search(r'\d+\s*x\s*\d+', size) else None
        if not r['variant']: r['setting_reported'] = size
        r['vbar_type_reported'] = sysT
    elif cat in ('stabilizer_weight', 'damper'):
        if size and size != '-': r['variant'] = size
    elif cat == 'finger_tab':
        sz = re.sub(r'Rings:.*', '', size).replace('Plates:', '').replace('|', ' ').strip()
        r['sizes'] = [x.strip() for x in sz.split('/') if x.strip()]
        ring = re.search(r'Rings:\s*([\d\- ]+mm)', size)
        if ring: r['ring_sizes_reported'] = ring.group(1).strip()
        r['handedness'] = [x.strip() for x in sysT.split('/') if x.strip()]
    elif cat == 'arrow':
        m = re.match(r'(ID|OD)\s*(\d+(?:\.\d+)?)\s*mm', sysT)
        if m: r['reported_inside_diameter_mm' if m.group(1) == 'ID' else 'reported_outside_diameter_mm'] = clean_num(float(m.group(2)))
        r['diameter_class_reported'] = sysT
        m = re.fullmatch(r'(\d+)\s*-\s*(\d+)\s*Spine', size)
        if m: r['reported_spine_range'] = [int(m.group(1)), int(m.group(2))]
        elif re.fullmatch(r'(\d+)\s*Spine', size): r['reported_spines'] = [int(re.match(r'\d+', size).group())]
        elif size: r['reported_sizes'] = [x.strip() for x in size.split('/')]
        m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*GPI', wt)
        if m: r['reported_gpi_range'] = [clean_num(float(m.group(1))), clean_num(float(m.group(2)))]
        elif re.fullmatch(r'\d+(?:\.\d+)?\s*GPI', wt): r['reported_gpi'] = clean_num(float(re.match(r'[\d.]+', wt).group()))
    elif cat in ('point', 'bushing', 'nock', 'vane'):
        if sysT: r['fitting' if cat != 'vane' else 'fletch_reported'] = sysT
        opts = re.findall(r'(\d+(?:\.\d+)?)', wt)
        if re.search(r'\d\s*-\s*\d', wt) and len(opts) == 2: r['reported_weight_range_gr'] = [clean_num(float(opts[0])), clean_num(float(opts[1]))]
        elif len(opts) > 1: r['reported_weight_options_gr'] = [clean_num(float(x)) for x in opts]
        elif len(opts) == 1: r['reported_weight_each_gr' if cat == 'vane' else 'reported_weight_gr'] = clean_num(float(opts[0]))
        if cat == 'nock' and size and size != '-': r['sizes'] = [x.strip() for x in size.split('/')]
        if cat == 'vane' and size: r['length_reported'] = size
    return r

def main():
    el18 = json.loads(EL18.read_text())
    recs = [dict(r) for r in el18['records']]
    by_id = {r['id']: r for r in recs}
    audit = {'renames': [], 'folds': [], 'owner_rows': [], 'conflicts': [], 'anomalies': [], 'holds': []}
    for rid, model, variant, why in RENAMES:
        r = by_id[rid]; old = (r['model'], r.get('variant'))
        r.setdefault('model_aliases', [])
        if r['model'] not in r['model_aliases'] and r['model'] != model: r['model_aliases'].append(r['model'])
        r['model'] = model
        if variant: r['variant'] = variant
        audit['renames'].append({'id': rid, 'from': {'model': old[0], 'variant': old[1]}, 'to': {'model': model, 'variant': r.get('variant')}, 'why': why})
    for dup, keep, why in FOLDS:
        d, k = by_id[dup], by_id[keep]
        k.setdefault('merged_ids', []).append(dup)
        k.setdefault('model_aliases', [])
        for a in [d['model']] + d.get('model_aliases', []):
            if a != k['model'] and a not in k['model_aliases']: k['model_aliases'].append(a)
        src = {'source_type': d.get('source_type'), 'source': d.get('source')}
        if d.get('source_url'): src['source_url'] = d['source_url']
        k.setdefault('additional_sources', []).append(src)
        audit['folds'].append({'removed_id': dup, 'kept_id': keep, 'removed_record': d, 'why': why})
    folded = {dup for dup, _, _ in FOLDS}
    recs = [r for r in recs if r['id'] not in folded]
    norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', str(s).lower()).strip()
    idx = collections.defaultdict(list)
    for r in recs: idx[(r['category'], r['brand'], norm(r['model']))].append(r)
    for r in recs:
        for a in r.get('model_aliases', []): idx[(r['category'], r['brand'], norm(a))].append(r)

    rows = list(csv.DictReader(OWNER.open(encoding='utf-8')))
    added = []; used_ids = {r['id'] for r in recs}
    brand_mass = collections.Counter((r['Brand'], r['Weight_Mass_Draw']) for r in rows if r['Category'] == 'Riser')
    for line, row in enumerate(rows, 2):
        key = (row['Category'], row['Brand'], row['Model'].strip())
        dec = D.get(key)
        cats = STAB_SPLIT if row['Category'] == 'Stabilizer' else (('vbar',) if row['Category'] == 'Mount' else (CAT[row['Category']],))
        brand = BRAND.get(row['Brand'], row['Brand'])
        if dec is None:
            hits = [h for c in cats for h in idx.get((c, brand, norm(row['Model'])), [])]
            dec = ('match', sorted({(h['category'], h['brand'], h['model']) for h in hits}), 'same model name (spelling/case)') if hits else ('add', {})
        entry = {'line': line, 'category': row['Category'], 'brand': row['Brand'], 'model': row['Model'], 'decision': dec[0]}
        if dec[0] == 'hold':
            entry['reason'] = dec[1]; audit['holds'].append(entry); audit['owner_rows'].append(entry); continue
        if dec[0] == 'match':
            targets = [r for (c, b, m) in dec[1] for r in recs if r['category'] == c and r['brand'] == b and r['model'] == m]
            assert targets, ('match target missing', key, dec)
            entry['matched_ids'] = [t['id'] for t in targets]
            if dec[2]: entry['note'] = dec[2]
            audit['owner_rows'].append(entry)
            conflicts = compare(row, targets)
            for c in conflicts: audit['conflicts'].append({'line': line, 'owner': f"{row['Brand']} {row['Model']}", **c})
            continue
        over = dec[1]
        targets_cat = [over['category']] if 'category' in over else list(cats)
        for c in targets_cat:
            r = owner_record(row, line, {**over, 'category': c})
            base = f"owner_el19_{slug(r['brand'])}_{slug(r['model'])}_{c}"
            rid = base; n = 2
            while rid in used_ids: rid = f'{base}_{n}'; n += 1
            r['id'] = rid; used_ids.add(rid)
            flags = anomalies(row, brand_mass)
            if flags: r['anomaly_flags'] = flags; audit['anomalies'].append({'line': line, 'id': rid, 'flags': flags})
            r = {k: v for k, v in r.items() if v is not None}
            added.append(r)
        entry['added_ids'] = [a['id'] for a in added if a['owner_row'] == line]
        audit['owner_rows'].append(entry)
    out = recs + added
    # semantic uniqueness (same rule as test_equipment_catalog_el17.js)
    seen = set()
    for r in out:
        k = '|'.join(str(x).lower() for x in [r['category'], r['brand'], r['model'], r.get('variant') or '', r.get('spine', ''), r.get('size', ''), r.get('length_in', '')])
        assert k not in seen, ('semantic duplicate', k); seen.add(k)
    canonical = {'schema_version': '3PM-equipment-catalog-1.2', 'catalog_version': VERSION, 'canonical': True, 'record_count': len(out),
                 'verified_record_count': sum(r['source_type'] != 'owner_supplied_unverified' for r in out),
                 'owner_unverified_record_count': len(added),
                 'reconstruction_note': 'EL18 (683) + owner-supplied list 2026-10-05: every EL18 record kept by id (13 spelling/variant normalisations with model_aliases; 9 evidence-free duplicates folded into the record they repeat, ids in merged_ids); owner rows added only when the product was absent, as owner_supplied_unverified with reported_* values; matched rows never overwrite verified data; ambiguous rows held. See 3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json.',
                 'records': out, 'previous_catalog_versions': el18['previous_catalog_versions'] + [el18['catalog_version']]}
    text = json.dumps(canonical, ensure_ascii=False, indent=1) + '\n'
    OUT_JSON.write_text(text)
    summary = collections.Counter(e['decision'] for e in audit['owner_rows'])
    audit_doc = {'schema_version': '3PM-equipment-merge-audit-1.0', 'catalog_version': VERSION, 'baseline_catalog': el18['catalog_version'],
                 'baseline_count': len(el18['records']), 'record_count': len(out), 'records_added_owner_unverified': len(added),
                 'records_folded': len(FOLDS), 'records_renamed': len(RENAMES), 'owner_rows_total': len(rows), 'owner_row_decisions': dict(summary),
                 'catalog_sha256': hashlib.sha256(text.encode()).hexdigest(), 'owner_input_sha256': hashlib.sha256(OWNER.read_bytes()).hexdigest(),
                 'policy': __doc__.strip(), **audit}
    OUT_AUDIT.write_text(json.dumps(audit_doc, ensure_ascii=False, indent=1) + '\n')
    write_js(out, el18['catalog_version'])
    print(json.dumps({'records': len(out), 'added': len(added), 'decisions': dict(summary), 'conflicts': len(audit['conflicts']), 'anomalies': len(audit['anomalies']), 'holds': len(audit['holds'])}))

def compare(row, targets):
    out = []
    cat = targets[0]['category']
    if cat == 'riser':
        m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*g', row['Weight_Mass_Draw'].strip())
        L = parse_lengths_in(row['Size_Length'])
        if m:
            want = float(m.group(1)); ref_len = 25 if 25 in L or not L else L[0]
            for t in targets:
                if num(t.get('length_in')) == ref_len and num(t.get('mass_g')) is not None and abs(num(t['mass_g']) - want) / num(t['mass_g']) > 0.01:
                    out.append({'field': f'mass_g @ {ref_len} in', 'owner': want, 'verified': t['mass_g'], 'verified_id': t['id'], 'verified_source': t.get('source'), 'kept': 'verified'})
        vl = sorted({num(t.get('length_in')) for t in targets if num(t.get('length_in')) is not None})
        if vl and L and sorted(L) != vl:
            out.append({'field': 'length options (in)', 'owner': L, 'verified': vl, 'kept': 'verified'})
    if cat == 'arrow':
        m = re.match(r'ID\s*(\d+(?:\.\d+)?)\s*mm', row['System_Type'])
        ids = sorted({num(t.get('inside_diameter_mm')) for t in targets if num(t.get('inside_diameter_mm')) is not None})
        if m and ids and float(m.group(1)) not in ids:
            out.append({'field': 'inside diameter (mm)', 'owner': float(m.group(1)), 'verified': ids, 'verified_ids': [t['id'] for t in targets if t.get('inside_diameter_mm') is not None][:3], 'kept': 'verified'})
        sp = sorted(int(num(t['spine'])) for t in targets if num(t.get('spine')) is not None)
        m = re.fullmatch(r'(\d+)\s*-\s*(\d+)\s*Spine', row['Size_Length'].strip())
        if m and sp and (int(m.group(1)) != sp[0] or int(m.group(2)) != sp[-1]):
            out.append({'field': 'spine range', 'owner': [int(m.group(1)), int(m.group(2))], 'verified': [sp[0], sp[-1]], 'verified_spines': sp, 'kept': 'verified'})
    if cat == 'limbs':
        m = re.fullmatch(r'(\d+)\s*-\s*(\d+)\s*lbs?', row['Weight_Mass_Draw'].strip())
        for t in targets:
            vr = t.get('marked_weight_lb_range'); opts = t.get('marked_weight_options_lb')
            v = None
            if opts: v = [min(opts), max(opts)]
            elif vr and re.match(r'(\d+)\s*-\s*(\d+)', str(vr)): v = [int(x) for x in re.match(r'(\d+)\s*-\s*(\d+)', str(vr)).groups()]
            if m and v and [int(m.group(1)), int(m.group(2))] != v:
                out.append({'field': 'marked draw weight range (lb)', 'owner': [int(m.group(1)), int(m.group(2))], 'verified': v, 'verified_id': t['id'], 'kept': 'verified'}); break
    if cat == 'finger_tab':
        sz = [x.strip() for x in re.sub(r'Rings:.*', '', row['Size_Length']).replace('Plates:', '').replace('|', ' ').split('/') if x.strip()]
        for t in targets:
            if t.get('sizes') and sorted(t['sizes']) != sorted(sz):
                out.append({'field': 'sizes', 'owner': sz, 'verified': t['sizes'], 'verified_id': t['id'], 'kept': 'verified'})
    return out

def anomalies(row, brand_mass):
    f = []
    y = row['Year_Released'].strip()
    if re.fullmatch(r'\d{4}s', y): f.append('release year given only as a decade')
    elif re.fullmatch(r'\d{4}', y) and int(y) > 2026: f.append('release year in the future')
    if row['Category'] == 'Riser' and brand_mass[(row['Brand'], row['Weight_Mass_Draw'])] >= 3:
        f.append(f"same mass {row['Weight_Mass_Draw']} listed for {brand_mass[(row['Brand'], row['Weight_Mass_Draw'])]} {row['Brand']} risers (possible placeholder value)")
    if row['Category'] == 'Arrow Shaft' and 'aluminum' in row['Material_Core_Damping'].lower() and row['System_Type'].startswith('ID'):
        f.append('aluminum shafts are sized by diameter/wall code, not a carbon insert-ID class; ID value doubtful')
    if ' / ' in row['Model']:
        f.append(f"several model names in one row ({row['Model']}); kept as one selector entry exactly as listed - confirm whether they are separate products")
    if row['Category'] == 'Riser' and 'magnesium' in row['Material_Core_Damping'].lower() and row['Year_Released'].strip() == '2000':
        f.append('Gold Medalist TD4 predates 2000 by most accounts; year doubtful')
    return f

def write_js(records, prev):
    src = OUT_JS.read_text()
    head, rest = src.split('const CATALOG=', 1)
    _, tail = rest.split(';\nconst BRANDS=', 1)
    brands_json, tail2 = tail.split(';\nconst MARKET_COVERAGE=', 1)
    mc_json, tail3 = tail2.split(';\nconst ALIASES=', 1)
    brands = [b for b in json.loads(brands_json) if b != 'Other / Custom']
    for r in records:
        if r['brand'] not in brands: brands.append(r['brand'])
    brands = sorted(set(brands), key=lambda s: s.lower()) + ['Other / Custom']
    mc = json.loads(mc_json)
    for r in records:
        mc.setdefault(r['category'], [])
        if r['brand'] not in mc[r['category']]: mc[r['category']].append(r['brand'])
    mc = {k: sorted(v, key=lambda s: s.lower()) for k, v in mc.items()}
    tail3 = re.sub(r'function byId\(id\)\{return CATALOG\.find\(r=>r\.id===id\)\|\|null;\}',
                   "function byId(id){return CATALOG.find(r=>r.id===id)||CATALOG.find(r=>Array.isArray(r.merged_ids)&&r.merged_ids.includes(id))||null;}\nfunction isVerified(r){return !!r&&r.source_type!=='owner_supplied_unverified';}", tail3)
    tail3 = re.sub(r'window\.EquipmentCatalog=\{[^\n]*\};',
                   'window.EquipmentCatalog=' + json.dumps({'version': VERSION, 'schemaVersion': '3PM-equipment-catalog-1.2', 'canonical': True, 'recordCount': len(records),
                                                            'verifiedRecordCount': sum(r['source_type'] != 'owner_supplied_unverified' for r in records),
                                                            'ownerUnverifiedRecordCount': sum(r['source_type'] == 'owner_supplied_unverified' for r in records),
                                                            'previousCatalogVersion': prev}, ensure_ascii=False) + ';', tail3)
    tail3 = tail3.replace("search,exact,byId,recordLabel,provenanceOrder:['measured','manufacturer','manufacturer_catalog_pdf','manufacturer_historical','manufacturer_plus_legacy_verified_matrix','verified_database','generic_estimate','unknown']",
                          "search,exact,byId,isVerified,recordLabel,provenanceOrder:['measured','manufacturer','manufacturer_catalog_pdf','manufacturer_historical','manufacturer_plus_legacy_verified_matrix','verified_database','owner_supplied_unverified','generic_estimate','unknown']")
    assert 'isVerified,recordLabel' in tail3 and 'function isVerified' in tail3 and VERSION in tail3
    OUT_JS.write_text(head + 'const CATALOG=' + json.dumps(records, ensure_ascii=False, separators=(',', ':')) + ';\nconst BRANDS=' + json.dumps(brands, ensure_ascii=False) + ';\nconst MARKET_COVERAGE=' + json.dumps(mc, ensure_ascii=False) + ';\nconst ALIASES=' + tail3)

if __name__ == '__main__':
    main()
