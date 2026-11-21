"""Bug scan: every literal internal link (href="/...", href={`/...`}, router.push('/...'))
must match an App Router route. Prints broken ones. Run from apps/storefront."""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
APP = "src/app"

# Collect routes as regex patterns.
routes = []
for root, dirs, files in os.walk(APP):
    if "page.tsx" in files or "route.ts" in files or "page.ts" in files:
        rel = os.path.relpath(root, APP).replace(os.sep, "/")
        parts = [p for p in rel.split("/") if p != "." and not (p.startswith("(") and p.endswith(")"))]
        pat = "/" + "/".join(parts)
        pat = re.sub(r"\[\.\.\.[^\]]+\]", ".+", pat)
        pat = re.sub(r"\[[^\]]+\]", "[^/]+", pat)
        routes.append(re.compile("^" + (pat if pat != "/" else "/") + "/?$"))
# static files in public/
public = set()
for root, _, files in os.walk("public"):
    for f in files:
        public.add("/" + os.path.relpath(os.path.join(root, f), "public").replace(os.sep, "/"))

LINK = re.compile(r"""(?:href=|href:\s*|push\(|replace\(|redirect\()\s*\{?\s*[`'"](/[^`'"\s?#]*)""")
broken = {}
for root, _, files in os.walk("src"):
    for f in files:
        if not f.endswith((".tsx", ".ts")):
            continue
        p = os.path.join(root, f).replace(os.sep, "/")
        for i, line in enumerate(open(p, encoding="utf-8", errors="ignore"), 1):
            for m in LINK.finditer(line):
                path = m.group(1)
                path = re.sub(r"\$\{[^}]+\}", "x", path)  # template params
                if path.startswith("/_next") or path.startswith("/api/") and any(r.match(path) for r in routes):
                    continue
                if path in public or any(r.match(path) for r in routes):
                    continue
                broken.setdefault(path, []).append(f"{p}:{i}")
for path, where in sorted(broken.items()):
    print(path, "<-", ", ".join(where[:4]))
print("broken links:", len(broken), "| routes:", len(routes))
