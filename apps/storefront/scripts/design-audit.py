"""Design audit: emojis, raw <button>s, button and chip class variety in src/.

Usage: python scripts/design-audit.py   (from apps/storefront)
Prints a summary; used to write docs/DESIGN_AUDIT.md and to track R1 progress.
"""
import collections
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

# Pictographic emoji only (typographic arrows like -> are allowed).
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U0001F000-\U0001F2FF☀-⛿✀-➿"
    "⭐⭕⬛⬜⌚⌛⏩-⏺]️?"
)
BTN = re.compile(r"\b(btn(?:-[a-z0-9]+)*|[a-z0-9-]+-btn(?:-[a-z0-9]+)*)\b")
CHIP = re.compile(r"\b([a-z0-9]+(?:-[a-z0-9]+)*-(?:chip|cat|pill|tag|chips|cats|pills)(?:-[a-z0-9]+)*)\b")

files = collections.Counter()
chars = collections.Counter()
raw_buttons = collections.Counter()
btn_classes = collections.Counter()
chip_classes = collections.Counter()

for root, _, names in os.walk("src"):
    for name in names:
        if not name.endswith((".tsx", ".ts")):
            continue
        path = os.path.join(root, name).replace(os.sep, "/")
        text = open(path, encoding="utf-8", errors="ignore").read()
        found = EMOJI.findall(text)
        if found:
            files[path] += len(found)
            chars.update(found)
        raw_buttons[path] += len(re.findall(r"<button\b", text))
        btn_classes.update(BTN.findall(text))
        chip_classes.update(CHIP.findall(text))

print("EMOJI", sum(files.values()), "in", len(files), "files")
print("CHARS", " ".join(f"{k} x{v}" for k, v in chars.most_common(40)))
print("TOP_FILES")
for f, n in files.most_common(20):
    print(f"  {n:4}  {f}")
print("RAW_BUTTON", sum(raw_buttons.values()), "in", sum(1 for v in raw_buttons.values() if v), "files")
print("BTN_CLASSES", len(btn_classes))
for c, n in btn_classes.most_common(25):
    print(f"  {n:4}  {c}")
print("CHIP_CLASSES", len(chip_classes))
for c, n in chip_classes.most_common(25):
    print(f"  {n:4}  {c}")
