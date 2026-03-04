# Kiosk Frequency Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split each kiosk task card into auto-rotating Daily/Weekly/Monthly frequency tabs with a CSS vertical scroll ticker for overflow lists.

**Architecture:** Modify the server-rendered kiosk endpoint to group chores by frequency within each card. CSS `@keyframes` handle both tab rotation (10s per tab) and vertical ticker scrolling. No JavaScript.

**Tech Stack:** Python (FastAPI, SQLAlchemy), inline CSS animations, server-rendered HTML.

---

### Task 1: Restructure data layer to group chores by frequency

**Files:**
- Modify: `family-org/backend/app/routers/dashboard.py:168-220` (child data building)
- Modify: `family-org/backend/app/routers/dashboard.py:222-235` (family tasks data building)

**Step 1: Write the failing test**

Add to `family-org/tests/test_e2e.py` after the existing `test_kiosk_dashboard_returns_html` test:

```python
def test_kiosk_dashboard_has_frequency_tabs(self):
    response = requests.get(f"{self.BACKEND_URL}/dashboard/kiosk")
    self.assertEqual(response.status_code, 200)
    # Check that frequency tab structure exists
    self.assertIn('class="freq-tab-bar"', response.text)
    self.assertIn('class="freq-panel', response.text)
```

**Step 2: Run test to verify it fails**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py::TestFamilyOrgEndToEnd::test_kiosk_dashboard_has_frequency_tabs -v`
Expected: FAIL — the CSS classes don't exist yet.

**Step 3: Modify the child data building to group by frequency**

In `dashboard.py`, replace the child data loop (lines 168-220) with a version that groups chores by frequency within each roster. The data structure changes from:

```python
# OLD: child_rosters = [{"name": "Morning", "chores": [...]}]
# NEW: child_rosters = [{"name": "Morning", "chores": [...]}]  (unchanged shape)
# NEW: child_freq = {"daily": [roster_groups...], "weekly": [...], "monthly": [...]}
```

Replace the child loop body (lines 168-220) with:

```python
    for child in children:
        assignments = db.query(RosterAssignment).filter(RosterAssignment.user_id == child.id).all()
        child_done = 0
        child_total = 0
        # Group roster chores by frequency
        freq_rosters = {"daily": {}, "weekly": {}, "monthly": {}}
        for a in assignments:
            roster = db.query(Roster).filter(Roster.id == a.roster_id).first()
            if not roster:
                continue
            chores = db.query(Chore).filter(Chore.roster_id == roster.id).all()
            for c in chores:
                comp = db.query(ChoreCompletion).filter(
                    ChoreCompletion.chore_id == c.id,
                    ChoreCompletion.user_id == child.id,
                    ChoreCompletion.completed_at >= today_start
                ).first()
                is_done = comp is not None
                if is_done:
                    child_done += 1
                child_total += 1
                freq = c.frequency if c.frequency in freq_rosters else "daily"
                if roster.name not in freq_rosters[freq]:
                    freq_rosters[freq][roster.name] = []
                freq_rosters[freq][roster.name].append({"title": c.title, "done": is_done})
        # Non-roster chores assigned directly to this child
        direct_chores = db.query(Chore).filter(
            Chore.assignee_id == child.id,
            Chore.roster_id == None,
            Chore.is_completed == False,
        ).all()
        for c in direct_chores:
            comp = db.query(ChoreCompletion).filter(
                ChoreCompletion.chore_id == c.id,
                ChoreCompletion.user_id == child.id,
                ChoreCompletion.completed_at >= today_start
            ).first()
            is_done = comp is not None
            if is_done:
                child_done += 1
            child_total += 1
            freq = c.frequency if c.frequency in freq_rosters else "daily"
            if "Tasks" not in freq_rosters[freq]:
                freq_rosters[freq]["Tasks"] = []
            freq_rosters[freq]["Tasks"].append({"title": c.title, "done": is_done})
        # Convert to list format: {freq: [{"name": roster_name, "chores": [...]}]}
        freq_data = {}
        for freq, roster_dict in freq_rosters.items():
            if roster_dict:
                freq_data[freq] = [{"name": rn, "chores": rc} for rn, rc in roster_dict.items()]
        total_chores += child_total
        total_done += child_done
        color = (child.preferences or {}).get("color", "#6366f1")
        children_data.append({
            "name": child.name,
            "color": color,
            "done": child_done,
            "total": child_total,
            "freq_data": freq_data,
        })
```

**Step 4: Modify family tasks data building to group by frequency**

Replace lines 222-235 with:

```python
    # --- Unassigned family tasks (non-roster, no assignee) ---
    family_tasks = db.query(Chore).filter(
        Chore.assignee_id == None,
        Chore.roster_id == None,
        Chore.is_completed == False,
    ).all()
    family_freq_data = {"daily": [], "weekly": [], "monthly": []}
    family_done_count = 0
    family_total_count = 0
    for c in family_tasks:
        comp = db.query(ChoreCompletion).filter(
            ChoreCompletion.chore_id == c.id,
            ChoreCompletion.completed_at >= today_start
        ).first()
        is_done = comp is not None
        if is_done:
            family_done_count += 1
        family_total_count += 1
        freq = c.frequency if c.frequency in family_freq_data else "daily"
        family_freq_data[freq].append({"title": c.title, "done": is_done})
    # Remove empty frequencies
    family_freq_data = {k: v for k, v in family_freq_data.items() if v}
```

**Step 5: Commit data restructuring**

```bash
git add family-org/backend/app/routers/dashboard.py family-org/tests/test_e2e.py
git commit -m "refactor(kiosk): restructure chore data to group by frequency"
```

---

### Task 2: Add helper function to build frequency-tabbed card HTML

**Files:**
- Modify: `family-org/backend/app/routers/dashboard.py` (add helper before `kiosk_dashboard`)

**Step 1: Add `_build_freq_card` helper function**

Add this helper function before the `kiosk_dashboard` function (after `_safe_color`, around line 25):

```python
FREQ_LABELS = {"daily": "Daily", "weekly": "Weekly", "monthly": "Monthly"}
FREQ_ORDER = ["daily", "weekly", "monthly"]
TICKER_THRESHOLD = 6  # items before ticker activates


def _build_freq_card(card_id: str, name: str, color: str, done: int, total: int, freq_data: dict) -> str:
    """Build a child/family card with frequency tabs and optional ticker."""
    safe_color = _safe_color(color)
    pct = int(done / total * 100) if total > 0 else 0

    # Determine which frequencies have data
    active_freqs = [f for f in FREQ_ORDER if f in freq_data]
    if not active_freqs:
        return ""

    num_tabs = len(active_freqs)
    tab_duration = 10  # seconds per tab
    cycle = num_tabs * tab_duration

    # Tab bar pills
    tab_pills = ""
    for i, freq in enumerate(active_freqs):
        tab_pills += (
            f'<span class="freq-pill freq-pill-{card_id}-{i}">'
            f'{FREQ_LABELS[freq]}'
            f'</span>'
        )

    # Tab panels
    panels_html = ""
    for i, freq in enumerate(active_freqs):
        rosters = freq_data[freq]
        # Build roster groups or flat list
        panel_content = ""
        item_count = 0
        if isinstance(rosters, list) and rosters and isinstance(rosters[0], dict) and "name" in rosters[0]:
            # Roster-grouped format
            for r in rosters:
                chore_rows = ""
                for cr in r["chores"]:
                    icon = "&#10003;" if cr["done"] else "&#9675;"
                    done_class = " chore-done" if cr["done"] else ""
                    chore_rows += (
                        f'<div class="chore-row{done_class}">'
                        f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                        f'<span class="chore-title">{_esc(cr["title"])}</span>'
                        f'</div>'
                    )
                    item_count += 1
                panel_content += (
                    f'<div class="roster-group">'
                    f'<div class="roster-label">{_esc(r["name"])}</div>'
                    f'{chore_rows}'
                    f'</div>'
                )
        else:
            # Flat list format (family tasks)
            for cr in rosters:
                icon = "&#10003;" if cr["done"] else "&#9675;"
                done_class = " chore-done" if cr["done"] else ""
                panel_content += (
                    f'<div class="chore-row{done_class}">'
                    f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                    f'<span class="chore-title">{_esc(cr["title"])}</span>'
                    f'</div>'
                )
                item_count += 1

        # Wrap in ticker if overflow expected
        if item_count > TICKER_THRESHOLD:
            panel_content = (
                f'<div class="ticker-wrap">'
                f'<div class="ticker-content ticker-content-{card_id}-{i}">'
                f'{panel_content}'
                f'{panel_content}'  # duplicate for seamless loop
                f'</div>'
                f'</div>'
            )

        panels_html += (
            f'<div class="freq-panel freq-panel-{card_id}-{i}">'
            f'{panel_content}'
            f'</div>'
        )

    # Per-card keyframes for tab rotation
    card_keyframes = ""
    for i in range(num_tabs):
        # Each tab is visible for tab_duration/cycle of the cycle
        show_start = (i * tab_duration / cycle) * 100
        show_end = ((i + 1) * tab_duration / cycle) * 100
        # Panel visibility
        card_keyframes += (
            f'@keyframes show-{card_id}-{i}{{'
            f'0%{{opacity:0;height:0;overflow:hidden;}}'
            f'{show_start:.1f}%{{opacity:0;height:0;overflow:hidden;}}'
            f'{show_start + 0.5:.1f}%{{opacity:1;height:auto;overflow:visible;}}'
            f'{show_end - 0.5:.1f}%{{opacity:1;height:auto;overflow:visible;}}'
            f'{show_end:.1f}%{{opacity:0;height:0;overflow:hidden;}}'
            f'100%{{opacity:0;height:0;overflow:hidden;}}'
            f'}}'
        )
        # Pill highlight
        card_keyframes += (
            f'@keyframes pill-{card_id}-{i}{{'
            f'0%{{background:#334155;color:#94a3b8;}}'
            f'{show_start:.1f}%{{background:#334155;color:#94a3b8;}}'
            f'{show_start + 0.5:.1f}%{{background:#475569;color:#f8fafc;}}'
            f'{show_end - 0.5:.1f}%{{background:#475569;color:#f8fafc;}}'
            f'{show_end:.1f}%{{background:#334155;color:#94a3b8;}}'
            f'100%{{background:#334155;color:#94a3b8;}}'
            f'}}'
        )

    # Per-card style block
    style_rules = f'<style>{card_keyframes}'
    for i in range(num_tabs):
        style_rules += f'.freq-panel-{card_id}-{i}{{animation:show-{card_id}-{i} {cycle}s infinite;}}'
        style_rules += f'.freq-pill-{card_id}-{i}{{animation:pill-{card_id}-{i} {cycle}s infinite;}}'
    style_rules += '</style>'

    return (
        f'{style_rules}'
        f'<div class="card child-card">'
        f'<div class="child-header" style="border-top-color:{safe_color};">'
        f'<span class="child-name">{_esc(name)}</span>'
        f'<span class="child-count">{done}/{total}</span>'
        f'</div>'
        f'<div class="child-body">'
        f'<div class="progress-track">'
        f'<div class="progress-fill" style="background:{safe_color};width:{pct}%;"></div>'
        f'</div>'
        f'<div class="freq-tab-bar">{tab_pills}</div>'
        f'{panels_html}'
        f'</div>'
        f'</div>'
    )
```

**Step 2: Commit helper function**

```bash
git add family-org/backend/app/routers/dashboard.py
git commit -m "feat(kiosk): add frequency tab card builder helper"
```

---

### Task 3: Replace card HTML generation with frequency-tabbed cards

**Files:**
- Modify: `family-org/backend/app/routers/dashboard.py:264-328` (HTML building for children + family cards)

**Step 1: Replace children card HTML generation**

Replace the children card HTML block (lines 264-303) with:

```python
    # --- Build HTML ---
    # Children cards
    children_html = ""
    if not children_data:
        children_html = '<p class="empty-state">No children found.</p>'
    for idx, ch in enumerate(children_data):
        children_html += _build_freq_card(
            card_id=f"child{idx}",
            name=ch["name"],
            color=ch["color"],
            done=ch["done"],
            total=ch["total"],
            freq_data=ch["freq_data"],
        )
```

**Step 2: Replace family tasks card HTML generation**

Replace the family tasks HTML block (lines 305-328) with:

```python
    # Family tasks card
    family_tasks_html = ""
    if family_freq_data:
        family_tasks_html = _build_freq_card(
            card_id="family",
            name="Family Tasks",
            color="#f59e0b",
            done=family_done_count,
            total=family_total_count,
            freq_data=family_freq_data,
        )
```

**Step 3: Run test to verify frequency tabs now appear**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py::TestFamilyOrgEndToEnd::test_kiosk_dashboard_has_frequency_tabs -v`
Expected: PASS

**Step 4: Run all kiosk tests**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py -v -k kiosk`
Expected: All PASS

**Step 5: Commit**

```bash
git add family-org/backend/app/routers/dashboard.py
git commit -m "feat(kiosk): use frequency-tabbed cards for children and family tasks"
```

---

### Task 4: Add CSS for frequency tabs and vertical ticker

**Files:**
- Modify: `family-org/backend/app/routers/dashboard.py:427-489` (inline CSS in HTML template)

**Step 1: Add frequency tab and ticker CSS rules**

Add the following CSS rules inside the existing `<style>` block, after the `.empty-state` rule (around line 484):

```css
.freq-tab-bar{display:flex;gap:6px;margin-bottom:8px;}
.freq-pill{font-size:11px;padding:3px 10px;border-radius:9999px;background:#334155;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;}
.freq-panel{overflow:hidden;}
.ticker-wrap{max-height:160px;overflow:hidden;position:relative;}
.ticker-content{display:flex;flex-direction:column;}
@keyframes ticker-scroll{0%{transform:translateY(0);}100%{transform:translateY(-50%);}}
```

**Step 2: Add ticker animation activation in the helper**

In the `_build_freq_card` helper, after the ticker content wrapper, add a per-card ticker keyframe. Update the ticker section to include the animation style:

The ticker wrapper already duplicates content. Add to the style_rules in the helper for any panel with a ticker:

Track which panels need a ticker in the helper. After building `panels_html`, for each panel that has a ticker, add:

```python
        if item_count > TICKER_THRESHOLD:
            # Calculate scroll duration: ~2 seconds per item
            scroll_duration = item_count * 2
            panel_content = (
                f'<div class="ticker-wrap">'
                f'<div class="ticker-content" style="animation:ticker-scroll {scroll_duration}s linear infinite;">'
                f'{panel_content}'
                f'{panel_content}'
                f'</div>'
                f'</div>'
            )
```

**Step 3: Add animation-delay offsets to cards**

Each card should start at a different point in its animation cycle so they don't all switch tabs simultaneously. This is already handled by the per-card unique keyframe names (`show-child0-0`, `show-child1-0`, etc.), but add stagger to the panels:

In the helper, when writing style rules for each panel, add an animation-delay:

```python
    for i in range(num_tabs):
        delay = int(card_id.replace("child", "").replace("family", "99") or "0") * 3
        style_rules += f'.freq-panel-{card_id}-{i}{{animation:show-{card_id}-{i} {cycle}s {delay}s infinite;}}'
        style_rules += f'.freq-pill-{card_id}-{i}{{animation:pill-{card_id}-{i} {cycle}s {delay}s infinite;}}'
```

**Step 4: Write a test for the ticker CSS class**

Add to `test_e2e.py`:

```python
def test_kiosk_dashboard_has_ticker_css(self):
    response = requests.get(f"{self.BACKEND_URL}/dashboard/kiosk")
    self.assertEqual(response.status_code, 200)
    self.assertIn("ticker-scroll", response.text)
    self.assertIn("ticker-wrap", response.text)
```

**Step 5: Run all kiosk tests**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py -v -k kiosk`
Expected: All PASS

**Step 6: Commit**

```bash
git add family-org/backend/app/routers/dashboard.py family-org/tests/test_e2e.py
git commit -m "feat(kiosk): add CSS for frequency tab rotation and vertical scroll ticker"
```

---

### Task 5: Add card max-height and handle single-tab edge case

**Files:**
- Modify: `family-org/backend/app/routers/dashboard.py`

**Step 1: Add max-height to child-card CSS**

In the inline CSS, update the `.child-card` rule (add it if not present, or update `.card` for child cards):

```css
.child-card{max-height:400px;overflow:hidden;}
.child-body{max-height:320px;overflow:hidden;}
```

**Step 2: Handle single-tab edge case in helper**

If only one frequency has data, skip the tab bar and animation entirely — just show the content statically. In `_build_freq_card`, after computing `active_freqs`:

```python
    if num_tabs == 1:
        # Single frequency — no tabs, no animation
        freq = active_freqs[0]
        rosters = freq_data[freq]
        panel_content = ""
        item_count = 0
        if isinstance(rosters, list) and rosters and isinstance(rosters[0], dict) and "name" in rosters[0]:
            for r in rosters:
                chore_rows = ""
                for cr in r["chores"]:
                    icon = "&#10003;" if cr["done"] else "&#9675;"
                    done_class = " chore-done" if cr["done"] else ""
                    chore_rows += (
                        f'<div class="chore-row{done_class}">'
                        f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                        f'<span class="chore-title">{_esc(cr["title"])}</span>'
                        f'</div>'
                    )
                    item_count += 1
                panel_content += (
                    f'<div class="roster-group">'
                    f'<div class="roster-label">{_esc(r["name"])}</div>'
                    f'{chore_rows}'
                    f'</div>'
                )
        else:
            for cr in rosters:
                icon = "&#10003;" if cr["done"] else "&#9675;"
                done_class = " chore-done" if cr["done"] else ""
                panel_content += (
                    f'<div class="chore-row{done_class}">'
                    f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                    f'<span class="chore-title">{_esc(cr["title"])}</span>'
                    f'</div>'
                )
                item_count += 1

        # Ticker if needed
        ticker_style = ""
        if item_count > TICKER_THRESHOLD:
            scroll_duration = item_count * 2
            panel_content = (
                f'<div class="ticker-wrap">'
                f'<div class="ticker-content" style="animation:ticker-scroll {scroll_duration}s linear infinite;">'
                f'{panel_content}'
                f'{panel_content}'
                f'</div>'
                f'</div>'
            )

        label = FREQ_LABELS[freq]
        return (
            f'<div class="card child-card">'
            f'<div class="child-header" style="border-top-color:{safe_color};">'
            f'<span class="child-name">{_esc(name)}</span>'
            f'<span class="child-count">{done}/{total}</span>'
            f'</div>'
            f'<div class="child-body">'
            f'<div class="progress-track">'
            f'<div class="progress-fill" style="background:{safe_color};width:{pct}%;"></div>'
            f'</div>'
            f'<div class="freq-tab-bar"><span class="freq-pill" style="background:#475569;color:#f8fafc;">{label}</span></div>'
            f'{panel_content}'
            f'</div>'
            f'</div>'
        )
```

**Step 3: Run all tests**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py -v -k kiosk`
Expected: All PASS

**Step 4: Commit**

```bash
git add family-org/backend/app/routers/dashboard.py
git commit -m "feat(kiosk): add card max-height and single-tab edge case handling"
```

---

### Task 6: Visual verification and final test

**Step 1: Run full test suite**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py -v`
Expected: All PASS

**Step 2: Manual verification**

Open `http://localhost:8090/dashboard/kiosk` in a browser and verify:
- Each child card shows frequency tab pills (Daily, Weekly, Monthly)
- Tabs auto-rotate every ~10 seconds
- Active tab pill is highlighted
- Within each tab, chores are grouped by roster name
- If a tab has many items, they scroll smoothly upward in a loop
- Cards don't overflow — max-height is enforced
- Cards with only one frequency show that tab statically (no rotation)
- Family Tasks card also has frequency tabs
- Overall layout (sidebar, summary strip, alerts) is unaffected

**Step 3: Final commit**

```bash
git add family-org/backend/app/routers/dashboard.py family-org/tests/test_e2e.py
git commit -m "feat(kiosk): frequency tab rotation and scroll ticker for task cards"
```
