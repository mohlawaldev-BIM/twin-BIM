# TwinBIM 🏢
### *From Model to Living Asset*

> A lightweight Building Information Management Digital Twin platform for post-handover asset intelligence. Built as a Masters research prototype exploring BIM-to-Digital Twin data continuity — without requiring physical sensors, IoT hardware, or enterprise-scale infrastructure.

---

## 🧠 Research Context

TwinBIM addresses a critical gap in current BIM industry practice: **BIM handover data is produced to satisfy compliance, but is rarely usable in operation.** This platform demonstrates how COBie handover data can be transformed into a living Digital Twin — a continuously updated, AI-queryable representation of a building's asset state.

### Key Research Contributions

| Contribution | Detail |
|---|---|
| BIM-to-Digital Twin data continuity | COBie handover data becomes a live operational asset registry |
| Code-based DT prototype methodology | Valid Digital Twin without IoT/sensors — data fed via file import and manual inspection updates |
| Post-construction asset intelligence | Facilities managers get a plain-language AI-queryable interface to their building |
| ISO 19650 information management | Audit trail records every state change with timestamp and reason |
| Accessible Digital Twins for SMEs | Free stack, no enterprise licence — designed for emerging markets and smaller firms |

### Why COBie Files Often Have Empty Date Fields

A key research finding: most real-world COBie files (especially design-stage exports) have InstallationDate, WarrantyStartDate, and ExpectedLife populated as n/a. This is because:

- COBie is often exported at **design stage** before construction is complete
- These fields are only populated during **construction and commissioning**
- Many project teams treat COBie as a compliance checkbox rather than a usable data asset

TwinBIM accounts for this with a two-tier status strategy: smart auto-calculation when dates exist, manual update workflow when they do not.

---

## Features

### Universal COBie Import
- Parses COBie 2.26, 2.4, 3.0 and all variant formats
- Handles exports from Revit, ArchiCAD, Bentley, Tekla, IFC exporters
- Joins Component + Type sheets automatically — extracts real asset names, categories, manufacturers, model numbers, and locations
- Maps OmniClass (US) and Uniclass 2015 (UK) numeric category codes to human-readable categories
- Handles all date formats: ISO 8601, Excel numeric serials, UK dd/mm/yyyy, US mm/dd/yyyy
- Cleans all COBie placeholder values: n/a, TBC, TBD, unknown, none, etc.
- Builds rich location strings by joining Space + Floor sheets
- Falls back to generic asset register detection for non-standard files
- Stage 1 empty component files show a clear warning instead of an error
- Imports in chunks — handles 5,000+ asset files

### Asset Registry
- Full CRUD — add, edit, delete assets
- Clickable status stat cards — click to instantly filter by status
- Dual filter — by both category and status simultaneously
- Search across name, category, location, and manufacturer
- Row selection with checkboxes
- Select all visible rows in one click
- Loads all assets beyond Supabase 1000-row default via pagination

### Bulk Status Management
The core Digital Twin synchronisation mechanism. After importing a COBie file:

1. Filter assets by category (e.g. all HVAC)
2. Select all filtered assets in one click
3. Set new status with visual picker (Operational / Maintenance / Critical / Decommissioned)
4. Add an inspection reason — e.g. "Physical inspection 13 May 2026 — all units confirmed operational"
5. Reason saved to each asset's notes and logged in the Audit Trail with timestamp

### Smart Status Engine
Runs automatically when COBie date fields are populated:

| Condition | Status |
|---|---|
| Warranty expired more than 1 year ago | Critical |
| Warranty expired or expiring within 6 months | Maintenance |
| Warranty still active | Operational |
| No date data (most design-stage files) | Operational (user updates manually) |

Live hint shown when editing a single asset if smart engine suggests a different status.

### Twin Dashboard
- Live stat cards: total, operational, maintenance, critical
- 7-day activity chart from audit log
- Asset status pie chart
- Recent assets list

### AI Assistant
- Natural language queries powered by Claude AI
- Reads your full live asset registry
- Example queries: "Which assets are critical?", "List HVAC assets on Floor 3", "Which warranties expire this year?"
- Every query logged in the Audit Trail

### Audit Trail
- Every action logged with timestamp: imports, edits, status changes, AI queries
- Bulk updates log count, new status, and reason in a single entry
- ISO 19650-aligned evidence trail
- Paginated for large logs

### Authentication
- Email + password via Supabase Auth
- No email confirmation required — register and login immediately
- Row Level Security — users see only their own data

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Free |
| Backend | Node.js + Express | Free |
| Database | Supabase (PostgreSQL + Auth + RLS) | Free forever |
| AI | Anthropic Claude API | Pay-per-use |
| COBie parsing | SheetJS | Free |
| Charts | Recharts | Free |
| Hosting (frontend) | Vercel | Free forever |
| Hosting (backend) | Render | Free forever |

**Total infrastructure cost: $0**

---

## Getting Started

### Prerequisites
- Node.js 18+
- Free Supabase account

### 1. Install dependencies
```bash
cd client && npm install
cd ../server && npm install
```

### 2. Set up the database
1. Go to Supabase Dashboard → SQL Editor → New Query
2. Paste and run the contents of supabase_schema.sql
3. Creates assets and audit_log tables with Row Level Security

### 3. Disable email confirmation (recommended for development)
Supabase Dashboard → Authentication → Providers → Email → toggle off Confirm email

### 4. Run the app
```bash
# Terminal 1
cd client && npm run dev

# Terminal 2
cd server && npm run dev
```

Open http://localhost:5173

---

## Project Structure

```
twinbim/
├── client/src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── AuthContext.jsx      Supabase auth provider
│   │   │   └── AuthPage.jsx         Login + register UI
│   │   └── Layout/
│   │       └── Layout.jsx           Sidebar navigation
│   ├── pages/
│   │   ├── DashboardPage.jsx        Overview + charts
│   │   ├── AssetRegistryPage.jsx    CRUD + bulk status management
│   │   ├── UploadPage.jsx           Universal COBie parser
│   │   ├── AIAssistantPage.jsx      Claude AI chat
│   │   └── AuditTrailPage.jsx       ISO 19650 audit log
│   ├── lib/supabase.js              Supabase client
│   └── App.jsx                      Router + auth guard
├── server/index.js                  Express API
├── supabase_schema.sql              Run once in Supabase SQL editor
└── README.md
```

---

## Digital Twin Methodology

TwinBIM implements the four core Digital Twin principles without physical sensors:

| DT Principle | TwinBIM Implementation |
|---|---|
| Physical entity | The real building with its installed assets |
| Digital representation | Asset registry populated from COBie handover data |
| Data connection | COBie import replaces IoT; manual inspection updates replace sensor feeds |
| Decision support | AI assistant + compliance flags + status dashboard |

This is consistent with Grieves (2014): a Digital Twin is "a digital representation of a physical asset, process or system" — the method of data synchronisation is an implementation detail, not a definitional requirement.

### Status as the Synchronisation Mechanism

In a hardware Digital Twin, sensors continuously push state. In TwinBIM, the bulk status update with reason is the equivalent — the BIM Manager or Facilities Manager synchronises site reality into the digital model after a physical inspection. The audit trail records this event, making it traceable and ISO 19650-compliant.

---

## Academic References

- Grieves, M. (2014). Digital Twin: Manufacturing Excellence through Virtual Factory Replication. White Paper.
- Lu, Q. et al. (2020). Developing a Digital Twin at Building and City Levels. Journal of Management in Engineering, 36(3).
- ISO 19650-1:2018 — Organization and digitization of information about buildings and civil engineering works
- ISO 19650-2:2018 — Delivery phase of the assets
- buildingSMART International (2013). COBie: Construction Operations Building information exchange.
- Eastman, C. et al. (2011). BIM Handbook: A Guide to Building Information Modeling. Wiley.
- Boje, C. et al. (2020). Towards a semantic Construction Digital Twin. Automation in Construction, 114.

---

## Roadmap

- Phase 2 — IFC 3D viewer with asset overlays
- Phase 3 — Predictive maintenance scoring
- Phase 4 — Multi-building portfolio view
- Phase 5 — Maintenance schedule PDF/Excel export
- Phase 6 — Mobile PWA for on-site inspection
- Phase 7 — Real-time IoT webhook integration

---

## Target Users

| User | How They Use TwinBIM |
|---|---|
| BIM Manager | Imports COBie file, verifies data quality, sets up initial twin state |
| Information Manager | Monitors audit trail, maintains ISO 19650 compliance evidence |
| Facilities Manager | Updates asset statuses after inspections, queries AI for maintenance priorities |
| BIM Coordinator | Reviews asset categories and locations, identifies data gaps |
| Researcher / Student | Uses as a code-based Digital Twin prototype for academic study |

---

*TwinBIM — Masters Research Prototype | BIM and Digital Twin | React + Supabase + Claude AI*
