"""Build index.html (standalone, for GitHub Pages) from tools/app.src.html + data/catalog.json.
Run from the repo root:  python3 tools/build.py
"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "tools/app.src.html").read_text()
catalog = (root / "data/catalog.json").read_text()
json.loads(catalog)  # fail early on bad JSON
assert "</" not in catalog, "catalog must not contain '</'"
body = src.replace("__CATALOG__", catalog)
head = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#14202B">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Inventory">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""
sw = """
<script>
// Offline support when hosted on a website (GitHub Pages). Not used inside Claude.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
</script>
"""
(root / "index.html").write_text(head + body + sw + "</body>\n</html>\n")
print("wrote index.html", len(head + body + sw), "bytes")
