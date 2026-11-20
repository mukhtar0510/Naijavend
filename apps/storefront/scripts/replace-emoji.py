"""One-off R1 sweep: replace UI emojis in .tsx files with Lucide icons.

- Emoji in JSX text            -> <IcName className="ico-inline" aria-hidden />
- A string that is ONLY emoji  -> the same JSX icon element (valid in expressions)
- Emoji inside other strings   -> removed (plain text; safe for WhatsApp messages)
Icons are imported with an `Ic` alias so names like Map/Image/Store never clash.
Run from apps/storefront:  python scripts/replace-emoji.py src
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

ICONS = {
    "📍": "MapPin", "🚚": "Truck", "🏪": "Store", "🛍": "ShoppingBag", "✓": "Check", "✔": "Check",
    "💬": "MessageCircle", "✨": "Sparkles", "✅": "CircleCheck", "📅": "Calendar", "📱": "Smartphone",
    "🧾": "Receipt", "⚡": "Zap", "🖼": "Image", "🎨": "Palette", "💳": "CreditCard", "🔔": "Bell",
    "💅": "Sparkles", "👗": "Shirt", "📣": "Megaphone", "✕": "X", "⚑": "Flag", "🤖": "Bot",
    "📦": "Package", "⭐": "Star", "★": "Star", "🍲": "Utensils", "🥇": "Medal", "🥈": "Medal",
    "🥉": "Medal", "🚀": "Rocket", "🧺": "ShoppingBasket", "👀": "Eye", "✦": "Sparkle", "👋": "Hand",
    "📢": "Megaphone", "📞": "Phone", "🎉": "PartyPopper", "🔁": "Repeat", "💼": "Briefcase",
    "⏳": "Hourglass", "🎟": "Ticket", "⚖": "Scale", "📷": "Camera", "🔍": "Search", "📡": "WifiOff",
    "🏆": "Trophy", "🏅": "Medal", "😕": "CircleAlert", "✍": "PenLine", "🖨": "Printer",
    "✏": "Pencil", "💵": "Banknote", "🏦": "Landmark", "📹": "Video", "🌍": "Globe",
    "🛒": "ShoppingCart", "⚠": "TriangleAlert", "🧭": "List", "🗺": "Map", "🚶": "Footprints",
    "🚗": "Car", "🔥": "Flame", "🌐": "Globe", "📲": "Share2", "🎁": "Gift", "♥": "Heart",
    "♡": "Heart", "☀": "Sun", "🌙": "Moon", "🔐": "Lock", "📈": "TrendingUp", "📝": "FileText",
    "🟢": "Circle", "🎂": "Cake", "📚": "BookOpen", "🛠": "Wrench", "🙂": "User",
}
# Flags and skin-tone / ZWJ sequences are just removed.
DROP = re.compile("[\U0001F1E6-\U0001F1FF\U0001F3FB-\U0001F3FF‍♀♂]")
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U0001F000-\U0001F2FF☀-⛿✀-➿"
    "⭐⭕⬛⬜⌚⌛⏩-⏺]️?"
)


def base(e: str) -> str:
    return e.replace("️", "")


def jsx(e: str, used: set) -> str:
    name = ICONS.get(base(e))
    if not name:
        return ""
    used.add(name)
    return f'<Ic{name} className="ico-inline" aria-hidden />'


def process_line(line: str, used: set) -> str:
    line = DROP.sub("", line)
    out = []
    i = 0
    quote = None  # current string delimiter
    while i < len(line):
        ch = line[i]
        if quote:
            if ch == "\\":
                out.append(line[i : i + 2]); i += 2; continue
            if ch == quote:
                quote = None
            elif quote == "`" and line.startswith("${", i):
                pass
            m = EMOJI.match(line, i)
            if m:
                # whole-string emoji: 'X' -> JSX element (replace the quotes too)
                start_q = out and out[-1] in ("'", '"') and len(out) >= 1
                end = m.end()
                if start_q and end < len(line) and line[end] == out[-1] and out[-1] != "`":
                    q = out.pop()
                    el = jsx(m.group(0), used)
                    out.append(el if el else "''")
                    i = end + 1
                    quote = None
                    continue
                # otherwise drop the emoji (and one following space)
                i = end
                if i < len(line) and line[i] == " ":
                    i += 1
                continue
            out.append(ch); i += 1; continue
        # not in a string
        if ch in ("'", '"', "`"):
            # apostrophes inside JSX text (don't, it's) are not string openers
            prev = line[i - 1] if i else " "
            if ch == "'" and prev.isalpha():
                out.append(ch); i += 1; continue
            quote = ch; out.append(ch); i += 1; continue
        m = EMOJI.match(line, i)
        if m:
            el = jsx(m.group(0), used)
            out.append(el)
            i = m.end()
            continue
        out.append(ch); i += 1
    return "".join(out)


def add_import(text: str, used: set) -> str:
    if not used:
        return text
    spec = ", ".join(f"{n} as Ic{n}" for n in sorted(used))
    imp = f"import {{ {spec} }} from 'lucide-react';"
    lines = text.split("\n")
    idx = [i for i, l in enumerate(lines) if l.startswith("import ")]
    if not idx:
        # after a 'use client' directive if present
        at = 1 if lines and lines[0].startswith(("'use client'", '"use client"')) else 0
        lines.insert(at, imp)
    else:
        i = idx[-1]
        while not lines[i].rstrip().endswith(";"):
            i += 1
        lines.insert(i + 1, imp)
    return "\n".join(lines)


def main(root: str, skip: set):
    changed = 0
    for r, _, names in os.walk(root):
        for n in names:
            if not n.endswith(".tsx"):
                continue
            p = os.path.join(r, n).replace(os.sep, "/")
            if any(p.endswith(s) for s in skip):
                continue
            text = open(p, encoding="utf-8").read()
            if not EMOJI.search(text) and not DROP.search(text):
                continue
            used: set = set()
            new = "\n".join(process_line(l, used) for l in text.split("\n"))
            new = add_import(new, used)
            if new != text:
                open(p, "w", encoding="utf-8").write(new)
                changed += 1
                print("fixed", p, sorted(used))
    print("files changed:", changed)


if __name__ == "__main__":
    # Files handled by hand (data lists rendered as strings, map HTML strings).
    SKIP = {
        "components/StoreMap.tsx",
        "components/MapEmbed.tsx",
        "components/Stars.tsx",
        "components/SavedHeart.tsx",
        "components/CategoryPicker.tsx",
        "components/ProductCard.tsx",
        "account/profile/ProfileEditor.tsx",
        "rankings/page.tsx",
        "components/NearbyStores.tsx",
    }
    main(sys.argv[1] if len(sys.argv) > 1 else "src", SKIP)
