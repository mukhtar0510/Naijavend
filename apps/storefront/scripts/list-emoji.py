"""List every pictographic emoji in src/ with file:line and the trimmed line."""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U0001F000-\U0001F2FF☀-⛿✀-➿"
    "⭐⭕⬛⬜⌚⌛⏩-⏺]️?"
)
for root, _, names in os.walk(sys.argv[1] if len(sys.argv) > 1 else "src"):
    for name in sorted(names):
        if not name.endswith((".tsx", ".ts")):
            continue
        path = os.path.join(root, name).replace(os.sep, "/")
        for i, line in enumerate(open(path, encoding="utf-8", errors="ignore"), 1):
            if EMOJI.search(line):
                print(f"{path}:{i}: {line.strip()[:150]}")
