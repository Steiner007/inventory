# ASR Plumbing Inventory

Phone-first inventory for a work van and the ASR Plumbing shop. Two separate inventories, quick size-aware search, one-tap stock levels, a refill list per location, and offline saving.

There are two ways to run it, and they don't do the same things:

| | Inside Claude (`claude-artifact/`) | GitHub Pages (`index.html`) |
|---|---|---|
| Van + Shop inventories, search, stock levels, refill + "To check" lists, setup hiding, add/hide | Yes | Yes |
| Packout bin blueprints (Bins tab): top-down Packout Organizer drawn at real size (19.7 × 15.2 in outside, 18 × 12 in inside, 8 small + 2 large bins, center slot), split bins horizontally or vertically into 2–6 sections, combine or break bins, see which bins are low | Yes | Yes |
| Works with no signal | Yes, once the page is open | Yes, after the first visit (service worker), and can be added to the home screen |
| Sync between your phones | Yes | No, each phone keeps its own copy |
| Crew can view the shop and send requests | Yes | No |
| Van private, shop locked to the owner | Yes (Claude storage access rules) | Not applicable (nothing leaves the phone) |

The sync, sharing and request features use Claude's built-in artifact storage (`window.claude`). That only exists when the page is opened from Claude. On any other website the app runs in **"this phone only"** mode automatically.

### Carrying changes over from the Claude copy

`data/claude-snapshot.json` holds the van and shop categories that changed in the Claude copy (renames, levels, hidden items, added items and categories). `tools/build.py` puts it into `index.html`. When a phone opens the GitHub version, the snapshot is merged into that phone's data once. For each item, whichever side changed it most recently wins, with stock level and details tracked separately, so nothing newer on the phone is overwritten. To carry over again later, refresh the snapshot, rebuild and push. A new snapshot `id` makes phones merge again.

The repo is public, so the snapshot (including van items and counts) is public too.

## Put it on GitHub Pages

1. Create a new repository on GitHub (for example `asr-plumbing-inventory`).
2. Upload everything in this folder: **Add file → Upload files**, drag in the files and folders, then **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then **Save**.
4. After a minute or two the site is at `https://<your-username>.github.io/<repo-name>/`.
5. On iPhone: open that link in Safari, tap **Share → Add to Home Screen**. It then opens like an app and works with no signal.

Notes:
- GitHub Pages on the free plan needs a **public** repository. That makes the code public; your counts are not, because they're only stored on your phone. Private repos need a paid GitHub plan for Pages.
- Storage is per browser. If you clear Safari's website data, or switch phones, the counts on that phone are gone. There's no export in this version (you asked to leave that out).

## Use the Claude-hosted version

`claude-artifact/plumbing-inventory.html` is the exact file published as the Claude artifact. It's live in Claude with its storage already loaded. Keep this copy for reference or for republishing. The storage access rules it was published with:

```json
{ "db": { "rules": [
  { "path": "",         "read": "owner",    "write": "owner" },
  { "path": "shop",     "read": "view",     "write": "owner" },
  { "path": "requests", "read": "interact", "write": "interact" }
] }, "user": { "scopes": ["profile"] } }
```

- The van (and anything else) can only be read or written by the owner.
- The shop can be read by anyone the page is shared with, and written only by the owner.
- Requests can be read and written by anyone at Contributor or Editor level. In practice crew members invited from outside your account need **Editor**.

`data/seed/*.json` holds the starting documents the Claude storage was loaded with: one per category per location, plus a `meta` doc each.

## Files

```
index.html                 Standalone app for GitHub Pages (built, don't edit by hand)
sw.js                      Service worker: offline support on a website
manifest.webmanifest       Home-screen app info
icon.png, icon-192.png, apple-touch-icon.png   Home-screen icons (copper pipe + valve, drawn by tools/make_icon.py)
claude-artifact/           Exact copy published in Claude
tools/app.src.html         App source (HTML, CSS, JS in one file)
tools/build.py             Builds index.html from the source + catalog
tools/make_icon.py         Redraws the home-screen icons
tools/build_catalog.py     Rebuilds data/catalog.json from the workbook
data/catalog.json          543 starter items from the workbook
data/seed/                 Starting documents for the Claude storage
data/Plumbing_Inventory_and_App_Brief.xlsx   Original workbook and brief
tests/                     Automated tests (Playwright)
```

## Change the app

Edit `tools/app.src.html`, then rebuild:

```bash
python3 tools/build.py
```

To change the starter catalog, edit the **Inventory** sheet in `data/Plumbing_Inventory_and_App_Brief.xlsx`, then:

```bash
pip install openpyxl
python3 tools/build_catalog.py
python3 tools/build.py
```

The catalog only affects new installs. A phone that already has data keeps its own items. Add new items in the app with the **+** button.

After changing anything, bump `CACHE` in `sw.js` (for example `asr-inventory-v2`) so phones pick up the new version.

## Run the tests

```bash
npm install
npx playwright install chromium
npm test
```

- `tests/claude-sync.test.js` simulates the Claude storage with three phones (two of yours and one crew member's). It checks:
  - van and shop stay separate
  - finishing setup hides blank items, and hidden items can be restored
  - Out items stay visible and on the refill list
  - search wording (½, half inch, .5, 1 1/2 …) and category chips
  - the **+** add button, adding several at once, and duplicate blocking
  - hiding several at once
  - the crew can only read the shop and send requests
  - changes made offline survive a reload
  - two phones changing the same item produce a visible conflict, not a silent overwrite
- `tests/bins.test.js` checks the Bins tab: the Packout Organizer layout and real proportions, labels and linked items, horizontal/vertical dividers with even empty sections, combining and breaking bins, refill integration, and saving after reload.
- `tests/standalone-offline.test.js` serves `index.html` like GitHub Pages, cuts the network, and checks the app still loads and saves changes.

## How the data is stored

Each location (`van`, `shop`) is a set of documents, one per category: `{ cat, ord, items: { <id>: item } }`. An item looks like this:

```js
{ name, size, nick, mat, sch, cnote, ord,
  hidden,            // left blank at setup, or hidden later; never deleted
  lvl,               // "Extra" | "Stocked" | "Half" | "Low" | "Out" | "Check" (need to look) | null
  flag,              // manual refill flag
  sAt, sDev,         // when / which phone last changed lvl or flag
  dAt, dDev }        // when / which phone last changed the details
```

- Changes go into a queue on the phone (`localStorage`) first, then sync.
- Before each sync the phone reads the latest server copy. If another phone changed the same item since this phone last saw it, the newer change wins, and the other value is kept under **More → Conflicts** with a one-tap switch.
- Requests are separate documents: `requests/<id>` = `{ kind, item, text, from, by, at, status }`. A request never changes stock levels.

## Not built yet

- Order quantities (left out on purpose for now).
- Sync and crew requests outside Claude. That would need a real backend such as Firebase or Supabase, with sign-in for you and the crew. Both have free tiers. Pricing and limits would need checking before choosing one.
