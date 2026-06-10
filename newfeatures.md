# Feature Ideas — Lab R&D OS

Here's a prioritised list of features and improvements worth adding, with a concrete implementation approach for each.

---

## 🔬 Research & Experiment Tracking

---------------### 1. Experiment Status Transitions (Update Outcome)
**What**: Allow changing an experiment's outcome (PENDING → PASS/FAIL) directly from the experiment card — a quick dropdown or button group, not just at creation time.  
**How**: Add `PUT /api/logs/{log_id}` in `api_server.py` backed by `db.update_rd_log()`. In `app.js`, render inline buttons on each `experiment-card` that call the new endpoint and refresh the card.

-----------### 2. Experiment ↔ Notebook Cross-Linking
**What**: When creating a notebook entry, allow attaching it to an existing experiment. The experiment card then shows a "📓 Notes" count badge.  
**How**: The `notebook` table already has an `experiment_id` column. Add a dropdown field in the "Add Notebook Entry" modal to pick an experiment. Show linked entries when the experiment card is expanded.

===-------### 3. Experiment Search & Filter Bar
**What**: A live search + filter bar on the Experiments page (filter by outcome, project, date range).  
**How**: Client-side JS filtering on the already-loaded `data.logs` array. Add `?outcome=PASS` query param support to `GET /api/logs` for server-side filtering.

---

## 📒 Lab Notebook

### 4. Markdown Preview Toggle
**What**: A "Preview" button in the notebook editor that renders the markdown content as formatted HTML beside the raw text.  
**How**: Include [marked.js](https://marked.js.org/) via CDN. Add a split-pane layout toggled by a toolbar button — one side raw textarea, the other a `<div>` updated on every keystroke with `marked.parse(content)`.

-----------------### 5. Auto-Save Drafts
**What**: Auto-save notebook entries every 30 seconds while editing, with a subtle "Saved" indicator in the toolbar.  
**How**: `setInterval` on the editor's `input` event to call `PUT /api/notebook/{id}` silently. Store unsaved entries in `localStorage` as a fallback.

---

## 📦 Inventory & Components

### 6. Low Stock Alerts
**What**: A dashboard warning banner when any component's quantity falls below a configurable threshold.  
**How**: `GET /api/components?low_stock=true` — add a query param that filters `WHERE quantity <= threshold`. Show a dismissible banner in the dashboard header. Store the threshold per-component in the DB.

### 7. Component Barcode / QR Scan Import
**What**: Scan a component's QR/barcode to auto-fill the "Add Component" form.  
**How**: Use the [ZXing-js](https://github.com/zxing-js/library) library to access the device camera. On scan, map the barcode to a parts lookup (e.g. Octopart API or a local CSV import).

---

## 📊 Dashboard & Analytics

### 8. Experiment Success Rate Chart
**What**: A doughnut chart on the dashboard showing the ratio of PASS / FAIL / PENDING experiments.  
**How**: Use [Chart.js](https://www.chartjs.org/) (CDN). Fetch aggregated data from a new `GET /api/stats/experiments` endpoint that returns counts grouped by outcome. Render in a small card on the dashboard.

------------### 9. Activity Timeline (Audit Log)
**What**: A real-time activity feed on the dashboard ("Added component X", "Experiment Y marked PASS", "Note Z created").  
**How**: Add a `lab_activity_log` table to `cache_db.py`. Write a small `log_activity(action, entity_type, entity_id)` helper called inside existing create/update routes. Display the latest 20 events in a timeline widget.

---

## ⚙️ Infrastructure & DX

### 10. Unified API Response Envelope
**What**: Standardise all endpoints to `{ "success": true, "data": <payload>, "count": <int> }`. Currently some return `{ "logs": [...] }`, others `{ "data": {...} }`.  
**How**: Add a helper `def ok(data, count=None)` in `api_server.py`. Migrate routes one section at a time, updating the matching JS callers in `app.js` simultaneously.

### 11. Server-Side Pagination ("Load More")
**What**: Add `?limit=50&offset=0` to all list endpoints, plus a "Load More" button in the UI that appends results without a full page reload.  
**How**: `/api/logs` already supports it. Extend to `/api/components`, `/api/equipment`, `/api/documents`, `/api/findings`. In JS, track `currentOffset` per page and increment on "Load More" click.

-------------### 12. Dark/Light Theme Toggle
**What**: A sun/moon toggle button in the top nav that switches between the existing dark theme and a light variant.  
**How**: CSS custom property overrides via a `.light-theme` class on `<body>`. Store preference in `localStorage`. A single 10-line JS toggle and a small `@media (prefers-color-scheme: light)` section in `style.css`.

---

## Priority Recommendation

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| 🔴 High | Experiment outcome update (in-place) | Small | High |
| 🔴 High | Markdown preview in notebook | Small | High |
| 🟡 Medium | Experiment search/filter | Small | Medium |
| 🟡 Medium | Experiment success rate chart | Medium | High |
| 🟡 Medium | Low stock alerts | Medium | High |
| 🟢 Long-term | Auto-save drafts | Medium | Medium |
| 🟢 Long-term | Pagination | Medium | Medium |
| 🟢 Long-term | API envelope consistency | Large | Low (DX) |
