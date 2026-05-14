import { useState, useRef } from 'react'
import { useAuth } from '../components/Auth/AuthContext'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL COBie PARSER
// Handles: COBie 2.26, 2.4, 3.0 | US, UK, AU variants | Revit, ArchiCAD,
//          Bentley, Tekla, IFC exporters | Stage 1–4 files | Custom columns
// ─────────────────────────────────────────────────────────────────────────────

// ── Placeholder values used across all COBie versions ────────────────────────
const COBIEPLACEHOLDERS = new Set([
  'n/a','na','n.a.','n.a','not applicable','not available','unknown',
  'none','nil','null','-','--','---','b/a','tbc','tbd','tbf','to be confirmed',
  'to be determined','not provided','not defined','undefined','unspecified',
  'default','default value','see specification','refer to spec','0',
])

function clean(val) {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  return COBIEPLACEHOLDERS.has(s.toLowerCase()) ? '' : s
}

// ── Safe date: handles ISO strings, Excel serials, dd/mm/yyyy, mm/dd/yyyy ────
function safeDate(val) {
  if (!val) return null
  try {
    // Excel stores dates as numbers (days since 1899-12-30)
    if (typeof val === 'number' && val > 1000) {
      const d = new Date((val - 25569) * 86400 * 1000)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    const s = String(val).trim()
    if (!s || COBIEPLACEHOLDERS.has(s.toLowerCase())) return null
    // Try native parse (handles ISO 8601, most formats)
    let d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    // Try dd/mm/yyyy (common in UK COBie)
    const ukMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ukMatch) {
      d = new Date(`${ukMatch[3]}-${ukMatch[2].padStart(2,'0')}-${ukMatch[1].padStart(2,'0')}`)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    return null
  } catch { return null }
}

// ── Flexible column finder: tries multiple known aliases case-insensitively ──
function col(row, ...aliases) {
  // Try exact match first, then case-insensitive
  for (const a of aliases) {
    if (row[a] !== undefined) return clean(row[a])
  }
  const lower = Object.fromEntries(Object.entries(row).map(([k,v]) => [k.toLowerCase().trim(), v]))
  for (const a of aliases) {
    const v = lower[a.toLowerCase().trim()]
    if (v !== undefined) return clean(v)
  }
  return ''
}

// ── Find a sheet by any of several possible names ────────────────────────────
function findSheet(workbook, ...names) {
  for (const n of names) {
    const found = workbook.SheetNames.find(s => s.toLowerCase().trim() === n.toLowerCase())
    if (found) return found
  }
  // Fallback: partial match
  for (const n of names) {
    const found = workbook.SheetNames.find(s => s.toLowerCase().includes(n.toLowerCase()))
    if (found) return found
  }
  return null
}

// ── COBie category → TwinBIM category ────────────────────────────────────────
// Strategy: first try OmniClass number prefix, then keyword match on full text
// OmniClass Table 23 codes used in COBie:
//   23-75 = HVAC, 23-80 = Electrical, 23-65/23-45 = Plumbing,
//   23-50 = Vertical Transport, 23-65 70 17 = Fire, 23-85 = ICT,
//   23-25 = Structural, 23-30 = Facade/Openings, 23-40 = Fitout/Furnishings

const OMNICLASS_MAP = [
  // HVAC controls: 21-81 (instrumentation & control)
  { prefix: ['21-81', '21.81'], cat: 'HVAC' },
  // HVAC: 23-75 (mechanical/HVAC services)
  { prefix: ['23-75', '23.75'], cat: 'HVAC' },
  // Process/Facility equipment: 23-15 (tanks, valves, chemical, process)
  { prefix: ['23-15', '23.15'], cat: 'Plumbing' },
  // Electrical: 23-80 (electrical services)
  { prefix: ['23-80', '23.80'], cat: 'Electrical' },
  // Plumbing: 23-65 (plumbing/fluid), 23-45 (plumbing fixtures), 23-60 (pumps)
  { prefix: ['23-65', '23.65', '23-45', '23.45', '23-60', '23.60', '23-55', '23.55'], cat: 'Plumbing' },
  // Lift/Elevator: 23-50
  { prefix: ['23-50', '23.50'], cat: 'Lift / Elevator' },
  // Structural: 23-25 (structural products), 23-20 (structural general)
  { prefix: ['23-25', '23.25', '23-20', '23.20'], cat: 'Structural' },
  // Facade / Openings: 23-30 (doors, windows, facades)
  { prefix: ['23-30', '23.30'], cat: 'Facade' },
  // Fitout / Furnishings: 23-35 (finishes), 23-40 (furnishings/equipment)
  { prefix: ['23-35', '23.35', '23-40', '23.40'], cat: 'Fitout' },
  // ICT: 23-85 (communications/AV)
  { prefix: ['23-85', '23.85'], cat: 'ICT' },
  // Uniclass 2015 (UK) table Pr prefixes
  { prefix: ['Pr-40-50', 'Pr_40_50'], cat: 'HVAC' },
  { prefix: ['Pr-40-30', 'Pr_40_30'], cat: 'Electrical' },
  { prefix: ['Pr-40-10', 'Pr_40_10'], cat: 'Plumbing' },
  { prefix: ['Pr-30-14', 'Pr_30_14'], cat: 'Fire Safety' },
]

// Fire safety needs special handling — it's spread across codes with keyword check
const FIRE_PATTERNS = /sprinkler|fire.?fight|fire.?suppress|fire.?alarm|smoke.?detect|heat.?detect|fire.?extinguish|hose.?reel|fire.?hydrant|evacuation|fire.?pump/i

const KEYWORD_RULES = [
  { pattern: /hvac|air.?condition|air.?handl|ahu|cooling|chiller|boiler|fan.?coil|vrf|vav|heat.?pump|condenser|unitary|ventilat|refriger|diffuser|grille|register|ductwork|air.?terminal/i, cat: 'HVAC' },
  { pattern: /electr|lighting|luminaire|light.?fitting|switchboard|panel.?board|distribution.?board|transformer|generator|ups|uninterrupt|solar|power.?supply|socket|outlet|cable.?tray|earthing|lamp|downlight/i, cat: 'Electrical' },
  { pattern: /plumb|sanitar|drain|pump|valve|toilet|water.?closet|basin|sink|shower|cistern|sewage|waste.?water|hot.?water|cold.?water|drinking.?fountain|water.?heater|water.?treatment|eye.?wash|lavatory|urinal/i, cat: 'Plumbing' },
  { pattern: /structur|concrete|steel.?frame|reinforc|beam|column|slab|foundation|pile|footing|retaining|masonry|panel.*structur/i, cat: 'Structural' },
  { pattern: FIRE_PATTERNS, cat: 'Fire Safety' },
  { pattern: /lift|elevator|escalator|moving.?walk|passenger.?convey/i, cat: 'Lift / Elevator' },
  { pattern: /facade|cladding|curtain.?wall|glazing|external.?wall|rain.?screen|louvre|skylight|rooflight|window|external.?door/i, cat: 'Facade' },
  { pattern: /ict|network|data.?point|comms|communication|telecom|cctv|access.?control|audio|visual|television|broadcasting|recorder|nurse.?call|structured.?cabling/i, cat: 'ICT' },
  { pattern: /fitout|partition|raised.?floor|suspended.?ceil|internal.?door|ironmongery|joinery|furniture|blind|cabinet|worktop|locker|mirror|sign|toilet.?compartment|cubicle|coat.?rack|whiteboard|pin.?board|display/i, cat: 'Fitout' },
]

function guessCategory(text = '') {
  if (!text) return 'Other'
  const t = text.trim()

  // Step 1: Check OmniClass / Uniclass numeric prefix — most reliable
  for (const { prefix, cat } of OMNICLASS_MAP) {
    if (prefix.some(p => t.startsWith(p))) return cat
  }

  // Step 2: Fire safety keyword check (spans multiple OmniClass codes)
  if (FIRE_PATTERNS.test(t)) return 'Fire Safety'

  // Step 3: Keyword match on full text (for free-text categories)
  for (const { pattern, cat } of KEYWORD_RULES) {
    if (pattern.test(t)) return cat
  }

  return 'Other'
}

// ── Build Space → Floor lookup (so location shows "Floor / Space") ────────────
function buildSpaceMap(workbook) {
  const map = {}
  const sheetName = findSheet(workbook, 'Space', 'Spaces', 'Room', 'Rooms')
  if (!sheetName) return map
  try {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    rows.forEach(r => {
      const name  = col(r, 'Name')
      const floor = col(r, 'FloorName', 'Floor', 'Level', 'Storey', 'StoreyName')
      const desc  = col(r, 'Description', 'Desc', 'LongName')
      if (name) map[name] = { floor, desc }
    })
  } catch { /* non-critical */ }
  return map
}

// ── Build Type lookup ─────────────────────────────────────────────────────────
function buildTypeMap(workbook) {
  const map = {}
  const sheetName = findSheet(workbook, 'Type', 'Types', 'AssetType', 'ProductType')
  if (!sheetName) return map
  try {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    rows.forEach(r => {
      const name = col(r, 'Name')
      if (!name) return
      // Warranty: COBie stores duration (years/months) not a date — convert if possible
      const warrantyDuration = col(r, 'WarrantyDurationParts', 'WarrantyDurationLabor', 'WarrantyDuration', 'Warranty')
      const warrantyUnit     = col(r, 'WarrantyDurationUnit', 'DurationUnit', 'WarrantyUnit')
      const warrantyEnd      = col(r, 'WarrantyEndDate', 'WarrantyExpiry', 'WarrantyEnd')
      const installDate      = col(r, 'InstallationDate', 'InstallDate')

      let warrantyExpiry = safeDate(warrantyEnd)
      // If no end date but we have duration + install date, calculate it
      if (!warrantyExpiry && warrantyDuration && installDate) {
        const years = warrantyUnit?.toLowerCase().includes('year') ? Number(warrantyDuration) : Number(warrantyDuration) / 12
        const base  = new Date(installDate)
        if (!isNaN(base.getTime()) && !isNaN(years)) {
          base.setFullYear(base.getFullYear() + Math.round(years))
          warrantyExpiry = base.toISOString().split('T')[0]
        }
      }

      map[name] = {
        category:        col(r, 'Category', 'OmniClassNumber', 'UniclassCode', 'NRMCode', 'Classification', 'AssetCategory'),
        manufacturer:    col(r, 'Manufacturer', 'ManufacturerName', 'Vendor', 'Supplier', 'Brand'),
        model_number:    col(r, 'ModelNumber', 'ModelRef', 'ModelReference', 'Model', 'ProductCode', 'PartNumber'),
        expected_life:   col(r, 'ExpectedLife', 'ServiceLife', 'UsefulLife'),
        replacement_cost:col(r, 'ReplacementCost', 'Cost', 'UnitCost'),
        warranty_expiry: warrantyExpiry,
        description:     col(r, 'Description', 'Desc'),
      }
    })
  } catch { /* non-critical */ }
  return map
}

// ── Detect if file is generic (non-COBie) asset list ─────────────────────────
function detectGenericAssetList(workbook) {
  // Try common non-COBie asset register column patterns
  const ASSET_SHEET_NAMES = ['assets','asset register','asset list','equipment','equipment list','inventory']
  const sheetName = workbook.SheetNames.find(s => ASSET_SHEET_NAMES.includes(s.toLowerCase().trim()))
  if (!sheetName) return null

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
  if (!rows.length) return null

  // Check if first row has recognisable asset columns
  const firstRowKeys = Object.keys(rows[0]).map(k => k.toLowerCase())
  const hasName = firstRowKeys.some(k => k.includes('name') || k.includes('asset') || k.includes('item'))
  return hasName ? { sheetName, rows } : null
}

// ── MAIN PARSER ───────────────────────────────────────────────────────────────
function parseCobie(workbook) {
  // ── Step 1: Find Component sheet (with fallbacks) ────────────────────────
  const compSheetName = findSheet(workbook,
    'Component', 'Components', 'Asset', 'Assets',
    'Equipment', 'Equipments', 'Element', 'Elements'
  )

  // ── Step 2: If no Component sheet, try generic asset list ────────────────
  if (!compSheetName) {
    const generic = detectGenericAssetList(workbook)
    if (generic) {
      const rows = generic.rows.map(row => {
        const name = col(row, 'Name','AssetName','ItemName','Equipment','Description','Asset')
        if (!name) return null
        const category = guessCategory(
          col(row,'Category','Type','AssetType','Class','Classification') || name
        )
        return {
          name,
          category,
          location:        col(row,'Location','Space','Room','Floor','Area','Zone'),
          status:          'operational',
          manufacturer:    col(row,'Manufacturer','Make','Brand','Vendor','Supplier'),
          model_number:    col(row,'Model','ModelNumber','ModelNo','PartNumber','ProductCode'),
          install_date:    safeDate(col(row,'InstallDate','InstallationDate','DateInstalled','CommissionDate')),
          warranty_expiry: safeDate(col(row,'WarrantyExpiry','WarrantyEnd','WarrantyEndDate','Warranty')),
          notes:           col(row,'Notes','Comments','Remarks','Description') || 'Imported from asset register',
        }
      }).filter(Boolean)
      if (rows.length) return { rows, source: 'generic-asset-list' }
    }

    const sheetList = workbook.SheetNames.join(', ')
    return { rows: [], error: `No recognisable asset sheet found. Sheets in this file: ${sheetList}. Expected a "Component", "Asset", or "Equipment" sheet.` }
  }

  // ── Step 3: Parse Component sheet ────────────────────────────────────────
  let compRows = []
  try {
    compRows = XLSX.utils.sheet_to_json(workbook.Sheets[compSheetName], { defval: '' })
  } catch (e) {
    return { rows: [], error: `Could not read the ${compSheetName} sheet: ${e.message}` }
  }

  // Filter out rows that are completely empty or only placeholders
  const validCompRows = compRows.filter(r => {
    const name = col(r, 'Name')
    return name && name.length > 0
  })

  if (!validCompRows.length) {
    return {
      rows: [],
      error: `The "${compSheetName}" sheet has no asset data yet. This looks like a Stage 1 (design intent) COBie file — component data is added at later project stages.`,
      isEmpty: true,  // special flag so UI can show a friendlier message
    }
  }

  // ── Step 4: Build lookup tables ───────────────────────────────────────────
  const typeMap  = buildTypeMap(workbook)
  const spaceMap = buildSpaceMap(workbook)

  // ── Step 5: Map every Component row → TwinBIM asset ──────────────────────
  const rows = validCompRows.map(row => {
    const name     = col(row, 'Name')
    const typeRef  = col(row, 'TypeName', 'Type', 'TypeRef', 'AssetType', 'ProductType', 'Category')
    const typeInfo = typeMap[typeRef] || {}
    const spaceRef = col(row, 'Space', 'SpaceName', 'Room', 'Location', 'Zone', 'Area')
    const spaceInfo= spaceMap[spaceRef] || {}

    // Build a rich location string: "Floor / Space (description)"
    let location = spaceRef
    if (spaceInfo.floor && spaceInfo.floor !== spaceRef) {
      location = `${spaceInfo.floor} / ${spaceRef}`
    }

    // Category: prefer Type sheet classification, fall back to TypeRef text, then name
    const rawCat = typeInfo.category || typeRef || col(row, 'Category', 'Classification') || name
    const category = guessCategory(rawCat)

    // Install date: Component sheet first, then Type sheet
    const install_date = safeDate(
      col(row, 'InstallationDate', 'InstallDate', 'DateInstalled', 'CommissionDate', 'ConstructionDate')
    )

    // Serial / tag / barcode stored in notes
    const serial  = col(row, 'SerialNumber', 'Serial', 'SerialNo')
    const tag     = col(row, 'TagNumber', 'Tag', 'TagNo', 'AssetTag')
    const barcode = col(row, 'BarCode', 'Barcode', 'AssetIdentifier', 'AssetId', 'UniqueId')
    const desc    = col(row, 'Description', 'Desc', 'LongName') || typeInfo.description || ''

    const noteParts = [
      typeRef                  ? `Type: ${typeRef}` : '',
      typeInfo.category        ? `COBie Category: ${typeInfo.category}` : '',
      desc                     ? `Description: ${desc}` : '',
      serial                   ? `Serial: ${serial}` : '',
      tag                      ? `Tag: ${tag}` : '',
      barcode                  ? `Asset ID: ${barcode}` : '',
      typeInfo.expected_life   ? `Expected Life: ${typeInfo.expected_life} yrs` : '',
      typeInfo.replacement_cost? `Replacement Cost: ${typeInfo.replacement_cost}` : '',
    ].filter(Boolean)

    return {
      name,
      category,
      location,
      status:          'operational',
      manufacturer:    typeInfo.manufacturer || col(row, 'Manufacturer', 'Make', 'Brand') || '',
      model_number:    typeInfo.model_number || col(row, 'ModelNumber', 'Model', 'ModelRef') || '',
      install_date,
      warranty_expiry: typeInfo.warranty_expiry || safeDate(col(row, 'WarrantyEndDate', 'WarrantyExpiry')) || null,
      notes:           noteParts.join(' | ') || 'Imported from COBie',
    }
  })

  return { rows, source: 'cobie' }
}

export default function UploadPage() {
  const { user } = useAuth()
  const fileRef  = useRef()
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(null)
  const [error,     setError]     = useState('')
  const [warning,   setWarning]   = useState('')
  const [drag,      setDrag]      = useState(false)
  const [parseInfo, setParseInfo] = useState(null)

  const reset = () => { setFile(null); setPreview(null); setError(''); setWarning(''); setParseInfo(null) }

  const handleFile = f => {
    reset(); setDone(null)
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Please upload an Excel (.xlsx / .xls) or CSV file.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb     = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const result = parseCobie(wb)
        if (result.isEmpty) { setWarning(result.error); return }
        if (result.error)   { setError(result.error);   return }
        if (!result.rows.length) { setError('No valid assets found in this file.'); return }
        setParseInfo({ source: result.source })
        setPreview(result.rows.slice(0, 5))
        setFile({ raw: f, workbook: wb, rows: result.rows })
      } catch (err) {
        setError('Could not read file. Please check it is a valid Excel/CSV. Error: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(f)
  }

  const onDrop = e => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  const importNow = async () => {
    if (!file?.rows) return
    setImporting(true); setError('')
    try {
      const payload = file.rows.map(r => ({ ...r, user_id: user.id, last_updated: new Date().toISOString() }))
      const chunkSize = 50
      let inserted = 0
      for (let i = 0; i < payload.length; i += chunkSize) {
        const { error: err } = await supabase.from('assets').insert(payload.slice(i, i + chunkSize))
        if (err) throw err
        inserted += Math.min(chunkSize, payload.length - i)
      }
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action:  `COBie import: ${inserted} assets imported from ${file.raw.name}`,
        entity:  'import'
      })
      setDone(inserted)
    } catch (err) {
      setError('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 mb-6">
        <CheckCircle2 size={36} className="text-green-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Import Complete!</h2>
      <p className="text-slate-400 mb-8">
        <span className="text-white font-semibold">{done} assets</span> have been added to your digital twin.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => { reset(); setDone(null) }} className="btn-secondary">
          Import Another
        </button>
        <Link to="/assets" className="btn-primary flex items-center gap-2">
          View Assets <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import BIM Data</h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload a COBie spreadsheet to populate your digital twin automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors duration-150
          ${drag ? 'border-blue-400 bg-blue-500/5' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
        <FileSpreadsheet size={40} className={`mx-auto mb-4 ${drag ? 'text-blue-400' : 'text-slate-600'}`} />
        <p className="text-slate-300 font-medium">Drop your COBie file here</p>
        <p className="text-slate-500 text-sm mt-1">or click to browse — .xlsx, .xls, .csv supported</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Warning — Stage 1 / empty file */}
      {warning && (
        <div className="card bg-amber-500/5 border-amber-500/20 text-sm text-amber-300">
          <p className="font-medium mb-1">⚠ No component data found</p>
          <p className="text-amber-400/80">{warning}</p>
          <button onClick={() => setWarning('')} className="mt-3 text-xs text-amber-400 underline">Dismiss</button>
        </div>
      )}

      {/* Preview */}
      {preview && file && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">
                Preview — {file.rows.length.toLocaleString()} assets detected
              </h3>
              {parseInfo?.source === 'generic-asset-list' && (
                <span className="text-xs text-amber-400 mt-0.5 block">
                  ⚠ Detected as a generic asset register (not standard COBie) — some fields may be mapped differently.
                </span>
              )}
            </div>
            <button onClick={reset} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Name', 'Category', 'Location', 'Manufacturer', 'Install Date'].map(h => (
                    <th key={h} className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    <td className="py-2 pr-4 text-slate-200 font-medium">{row.name}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${row.category === 'Other'
                          ? 'bg-slate-700 text-slate-400'
                          : 'bg-blue-500/10 text-blue-400'}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{row.location || '—'}</td>
                    <td className="py-2 pr-4 text-slate-400">{row.manufacturer || '—'}</td>
                    <td className="py-2 pr-4 text-slate-500">{row.install_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {file.rows.length > 5 && (
            <p className="text-slate-500 text-xs">…and {(file.rows.length - 5).toLocaleString()} more assets not shown</p>
          )}
          <button onClick={importNow} disabled={importing} className="btn-primary w-full flex items-center justify-center gap-2">
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? `Importing ${file.rows.length.toLocaleString()} assets…` : `Import All ${file.rows.length.toLocaleString()} Assets`}
          </button>
        </div>
      )}

      {/* Manual tip */}
      <div className="card bg-blue-500/5 border-blue-500/20">
        <p className="text-sm text-slate-400">
          <span className="text-blue-400 font-medium">No COBie file?</span>{' '}
          You can add assets manually from the{' '}
          <Link to="/assets" className="text-blue-400 underline">Asset Registry</Link> page,
          or download our{' '}
          <a href="/sample-cobie.xlsx" className="text-blue-400 underline">sample COBie template</a> to get started.
        </p>
      </div>
    </div>
  )
}
