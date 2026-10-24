#!/usr/bin/env python3
"""Generate docs/architecture.svg — the one-page platform map.

Why a generator instead of a hand-edited SVG:
  * every label is measured, so nothing overflows a box or a column
  * boxes, chips and cards share the same primitives, so the diagram stays
    consistent when the content changes
  * regenerating after a feature change is one command:
        python3 docs/tools/architecture-map.py

Constraints
  * no external fonts or images: the file renders identically in a README,
    in a browser, and in an offline viewer
  * ASCII-only labels (no glyphs that can degrade into tofu boxes)
  * light-on-dark palette matching the dashboard theme
"""

from __future__ import annotations

import html
from pathlib import Path

# ------------------------------------------------------------------ canvas --
W = 1700
M = 28
GAP = 18
RADIUS = 16
TOP = 118

# ----------------------------------------------------------------- palette --
BG_TOP = "#080d18"
BG_BOTTOM = "#0b1626"
PANEL = "#0f1b2d"
PANEL_EDGE = "#22314a"
CARD = "#0b1524"
CARD_EDGE = "#1d2b42"
TEXT = "#e8eef9"
MUTED = "#93a4c0"
DIM = "#6d7f9c"

ACCENT = {
    "client": "#3ddc97",
    "edge": "#f5b13d",
    "api": "#5aa9ff",
    "data": "#b98cff",
    "flow": "#7dd3fc",
    "ok": "#38d39f",
}

FONT = "Inter, 'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif"

# Generous per-glyph width factors for the fallback sans face.
W_REG = 0.578
W_BOLD = 0.615


def text_w(text: str, size: float, bold: bool = False) -> float:
    return len(text) * size * (W_BOLD if bold else W_REG)


def esc(text: str) -> str:
    return html.escape(text, quote=True)


class SVG:
    def __init__(self) -> None:
        self.parts: list[str] = []

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    # ---------------------------------------------------------- primitives --
    def rect(self, x, y, w, h, *, fill, stroke="none", rx=RADIUS, opacity=1.0, sw=1):
        self.add(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
            f'opacity="{opacity}"/>'
        )

    def text(self, x, y, content, *, size=12, fill=TEXT, weight="normal",
             anchor="start", opacity=1.0, spacing=0.0):
        ls = f' letter-spacing="{spacing}"' if spacing else ""
        self.add(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" '
            f'fill="{fill}" font-weight="{weight}" text-anchor="{anchor}" '
            f'opacity="{opacity}"{ls}>{esc(content)}</text>'
        )

    def wrapped(self, x, y, content, *, width, size=11, fill=MUTED, leading=1.5,
                max_lines=3):
        for index, line in enumerate(wrap(content, width, size)[:max_lines]):
            self.text(x, y + index * size * leading, line, size=size, fill=fill)
        return y + min(len(wrap(content, width, size)), max_lines) * size * leading

    def chip(self, x, y, label, *, color, size=10.5, height=23, pad=10):
        w = text_w(label, size) + pad * 2
        self.rect(x, y, w, height, fill=color + "1f", stroke=color + "66", rx=7)
        self.text(x + pad, y + height / 2 + size * 0.36, label, size=size, fill=color)
        return w

    def arrow(self, x1, y1, x2, y2, *, color, dash=None, width=1.8, marker="arrow"):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{color}" stroke-width="{width}" marker-end="url(#{marker})" '
            f'stroke-linecap="round"{d}/>'
        )


# ------------------------------------------------------------------- text --
def wrap(content: str, width: float, size: float) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in content.split():
        candidate = f"{current} {word}".strip()
        if not current or text_w(candidate, size) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


# ------------------------------------------------------------------- cards --
CHIP_H = 23
CHIP_PAD = 10
CHIP_GAP = 7
CHIP_SIZE = 10.5
ROW_GAP = 6


def chip_rows(labels, width, size=CHIP_SIZE, pad=CHIP_PAD, gap=CHIP_GAP):
    """Greedy packing. Returns rows of (label, width)."""
    rows, current, used = [], [], 0.0
    for label in labels:
        w = text_w(label, size) + pad * 2
        if w > width:  # a single label wider than the box: shrink it
            w = width
        if current and used + gap + w > width:
            rows.append(current)
            current, used = [], 0.0
        used += (gap if current else 0) + w
        current.append((label, w))
    if current:
        rows.append(current)
    return rows


def card_height(spec, width) -> float:
    h = 34                                     # title row
    h += len(spec.get("lines", [])) * 16
    rows = chip_rows(spec.get("chips", []), width - 28)
    if rows:
        h += len(rows) * (CHIP_H + ROW_GAP)
    if spec.get("note"):
        h += 20
    return h + 12


def draw_card(s: SVG, x, y, w, spec, color):
    h = card_height(spec, w)
    s.rect(x, y, w, h, fill=CARD, stroke=CARD_EDGE, rx=12)
    s.rect(x, y, 3, h, fill=color + "88", rx=2)
    s.text(x + 14, y + 23, spec["title"], size=12, fill=TEXT, weight="bold")
    cy = y + 42
    for line in spec.get("lines", []):
        s.text(x + 14, cy, line, size=10, fill=MUTED)
        cy += 16
    for row in chip_rows(spec.get("chips", []), w - 28):
        cx = x + 14
        for label, width in row:
            if width >= w - 28:                # single long label
                size = max(8.5, CHIP_SIZE * (width - CHIP_PAD * 2) / max(1, text_w(label, CHIP_SIZE)))
                s.rect(cx, cy, width, CHIP_H, fill=color + "1f", stroke=color + "66", rx=7)
                s.text(cx + CHIP_PAD, cy + CHIP_H / 2 + size * 0.36, label, size=size, fill=color)
            else:
                s.chip(cx, cy, label, color=color, size=CHIP_SIZE, height=CHIP_H, pad=CHIP_PAD)
            cx += width + CHIP_GAP
        cy += CHIP_H + ROW_GAP
    if spec.get("note"):
        s.text(x + 14, y + h - 12, spec["note"], size=9.5, fill=DIM)
    return y + h


# ------------------------------------------------------------------ column --
def column_height(cards, width) -> float:
    return 76 + sum(card_height(c, width - 36) for c in cards) + 14 * (len(cards) - 1) + 18


def draw_column(s: SVG, x, w, h, number, title, subtitle, color, cards):
    s.rect(x, TOP, w, h, fill=PANEL, stroke=PANEL_EDGE)
    s.rect(x, TOP + 14, 4, h - 28, fill=color, rx=2)
    s.text(x + 20, TOP + 32, number, size=12, fill=color, weight="bold", spacing=1.2)
    s.text(x + 34, TOP + 32, title, size=15, fill=TEXT, weight="bold")
    s.text(x + 20, TOP + 52, subtitle, size=10.5, fill=DIM)
    cy = TOP + 76
    for spec in cards:
        cy = draw_card(s, x + 18, cy, w - 36, spec, color) + 14


# -------------------------------------------------------------- flow strip --
ARROW_GAP = 24            # room reserved for the connector between steps


def flow_rows(steps, width, size=10.5, pad=12):
    """Pack flow chips so every chip except the last in a row leaves room for
    an arrow. Without this the connectors overlap the following chip."""
    rows, current, used = [], [], 0.0
    for label in steps:
        w = text_w(label, size) + pad * 2
        need = w if not current else w + ARROW_GAP
        if current and used + need > width:
            rows.append(current)
            current, used = [], 0.0
            need = w
        used += need
        current.append((label, w))
    if current:
        rows.append(current)
    return rows


def flow_height(steps, width, note) -> float:
    rows = flow_rows(steps, width)
    return 40 + len(rows) * 34 + 40


def draw_flow(s: SVG, x, y, w, letter, title, color, steps, note, step_color=None):
    rows = flow_rows(steps, w - 40)
    h = 40 + len(rows) * 34 + 40
    s.rect(x, y, w, h, fill=PANEL, stroke=PANEL_EDGE)
    s.text(x + 20, y + 27, letter, size=12, fill=color, weight="bold", spacing=1.2)
    s.text(x + 36, y + 27, title, size=13, fill=TEXT, weight="bold")

    cy = y + 44
    for row in rows:
        cx = x + 20
        for index, (label, width) in enumerate(row):
            tone = (step_color or color) if index else color
            s.chip(cx, cy, label, color=tone, size=10.5, height=26, pad=12)
            cx += width
            if index < len(row) - 1:
                s.arrow(cx + 5, cy + 13, cx + ARROW_GAP - 6, cy + 13, color=ACCENT["flow"])
                cx += ARROW_GAP
        cy += 34
    s.wrapped(x + 20, cy + 24, note, width=w - 40, size=10.5, fill=DIM, max_lines=2)
    return h


# -------------------------------------------------------------------- page --
def build() -> str:
    s = SVG()

    cards = {
        "client": [
            dict(title="Expo mobile app",
                 lines=["Android - iOS - Web"],
                 chips=["Naam Jap counter", "Leaderboards", "Rewards + wallet",
                        "Games + steps", "Handwritten Naam", "Membership"],
                 note="offline-safe / adaptive sync / AppState aware"),
            dict(title="Admin dashboard",
                 lines=["React 18 - TypeScript - Vite"],
                 chips=["Analytics", "Users", "Content", "Membership", "Payouts",
                        "Settings", "System"],
                 note="SWR cache / SSE live badges / lazy routes"),
            dict(title="Public web pages",
                 lines=["SPA routes, same Vercel build"],
                 chips=["Privacy policy", "Terms", "Delete account"],
                 note="no auth, no database access"),
            dict(title="Realtime-aware UI",
                 chips=["live badge", "polling fallback", "focus revalidation",
                        "skeletons"],
                 note="no page needs a manual refresh"),
        ],
        "edge": [
            dict(title="HTTPS + HTTP/2",
                 lines=["Vercel CDN for the SPA"],
                 chips=["/assets/* immutable", "index.html revalidate",
                        "security headers"],
                 note="gzip / brotli via compression()"),
            dict(title="Dev proxy (Vite)",
                 lines=["/api -> 127.0.0.1:5000"],
                 chips=["changeOrigin", "SSE passthrough", "allowedHosts"],
                 note="same origin in previews and LAN"),
            dict(title="Two read paths",
                 lines=["JSON: ETag + versioned cache",
                        "Stream: ?token= for EventSource"],
                 chips=["GET /api/...", "GET /realtime/stream"],
                 note="both cacheable, one is live"),
            dict(title="Caching headers",
                 lines=["assets: immutable, one year",
                        "/api: private, max-age=0",
                        "data routes: ETag + X-Cache"],
                 note="no stale admin payload in a shared cache"),
        ],
        "core": [
            dict(title="Middleware chain",
                 chips=["trust proxy", "cors allowlist", "compression",
                        "requestPerf", "JWT + admin cache"],
                 note="one pipeline for every /api route"),
            dict(title="Route groups",
                 chips=["/naam-jap", "/admin", "/daily-quotes", "/home-content",
                        "/notifications", "/preset-images", "/app-version",
                        "/donation", "/membership", "/rewards", "/referrals",
                        "/step-tracker", "/handwritten-naam", "/games",
                        "/realtime", "/system"],
                 note="unknown /api/* -> fast JSON 404"),
            dict(title="Observability",
                 chips=["X-Request-Id", "Server-Timing", "X-Response-Time",
                        "p50 / p95 metrics", "slow-request log"],
                 note="/api/system/metrics, admin only"),
            dict(title="Lifecycle contract",
                 lines=["/api/health answers before the DB gate",
                        "deep probe at /api/system/health",
                        "JSON errors carry the request id",
                        "graceful shutdown closes SSE + Mongo"],
                 note="SSE, metrics and health never wait on Mongo"),
        ],
        "services": [
            dict(title="analyticsService",
                 lines=["- index-backed parallel counts",
                        "- filter before $unwind",
                        "- 15 s TTL + X-Cache + Server-Timing",
                        "- counters and money cached apart"],
                 note="backwards-compatible payload"),
            dict(title="dailyLogRetention",
                 lines=["- archive copy first",
                        "- trim the hot document second",
                        "- 400-day hot window",
                        "- idempotent upserts"],
                 note="no silent data loss"),
            dict(title="Realtime hub",
                 chips=["invalidate first", "throttle 1.5 s", "public + admin topics",
                        "replay 250 events"],
                 note="25 s heartbeat / Last-Event-ID replay"),
            dict(title="Cache",
                 chips=["LRU 1000 entries", "Redis optional",
                        "single-flight loads", "fail-open"],
                 note="namespace versions -> O(1) invalidation"),
            dict(title="Tuning knobs",
                 lines=["ANALYTICS_TTL_SECONDS = 15",
                        "REALTIME_THROTTLE_MS = 1500",
                        "DAILY_LOG_RETAIN_DAYS = 400"],
                 note="all optional, sane defaults"),
        ],
        "data": [
            dict(title="MongoDB (Atlas)",
                 lines=["users - daily logs (+ archives)",
                        "subscriptions - plans - rewards",
                        "wallets - withdrawals - referrals",
                        "content - quotes - versions - games"],
                 chips=["multikey dailyLogs.date", "isActive + totalMalas",
                        "createdAt", "(deviceId, date) unique"],
                 note="autoIndex: create only / never drops"),
            dict(title="Upstash Redis (optional)",
                 lines=["shared cache + namespace versions",
                        "multi-instance invalidation <= 2 s",
                        "never a hard dependency"],
                 note="fails open -> memory-only"),
            dict(title="External services",
                 chips=["Cloudinary media", "Razorpay payments", "Expo push",
                        "Vercel hosting"]),
            dict(title="Safety net",
                 lines=["JSONL + gzip backups, checksum manifest",
                        "merge restore with --dry-run preview"],
                 note="backup / restore / verifyData scripts"),
            dict(title="Backup cadence",
                 lines=["nightly + before risky deploys",
                        "restore is an upsert merge"],
                 note="verifyData is read-only"),
        ],
    }

    GAP_COL = 30
    widths = [300, 286, 360, 300, 330]
    xs, cursor = [], M
    for w in widths:
        xs.append(cursor)
        cursor += w + GAP_COL

    col_h = max(
        column_height(cards["client"], widths[0]),
        column_height(cards["edge"], widths[1]),
        column_height(cards["core"], widths[2]),
        column_height(cards["services"], widths[3]),
        column_height(cards["data"], widths[4]),
    )
    col_h = round(col_h) + 10

    flows_a = (["Tap / mala", "Debounce 350 ms", "Atomic POST /sync",
                "Invalidate + event", "SSE push", "UI refresh"],
               "Each write is one findOneAndUpdate with a $max merge, so concurrent "
               "devices cannot overwrite each other.")
    flows_b = (["Lazy chunk", "SWR cache hit", "GET /admin/analytics",
                "Versioned cache", "Render + revalidate"],
               "Cached data paints instantly while a background refresh runs; a "
               "memory hit is typically under 5 ms.")

    strip_w = (W - 2 * M - GAP) / 2
    strip_a_h = flow_height(flows_a[0], strip_w, flows_a[1])
    strip_b_h = flow_height(flows_b[0], strip_w, flows_b[1])
    strip_h = max(strip_a_h, strip_b_h)

    bottom = [
        ("C", "Realtime transport resilience", ACCENT["client"],
         ["SSE connect", "Heartbeat 25 s", "Drop detected", "Backoff retry",
          "Version polling"],
         "Three failed reconnects switch to 15 s version polling, so the UI keeps "
         "updating on any network."),
        ("D", "Data safety pipeline", ACCENT["ok"],
         ["Archive logs", "Trim hot doc", "Backup JSONL", "SHA-256 verify",
          "Idempotent restore"],
         "Trim only after a durable copy; restore upserts by _id and previews every "
         "change with --dry-run."),
        ("E", "Sync accuracy guarantees", ACCENT["data"],
         ["IST day keys", "Monotonic $max", "Idempotent logs", "Rank via index",
          "Retention 400 d"],
         "One timezone for every counter, one atomic write per tap, an index for "
         "every hot query."),
    ]
    bottom_w = (W - 2 * M - 2 * GAP) / 3
    bottom_h = max(flow_height(b[3], bottom_w, b[4]) for b in bottom)

    height = (TOP + col_h + GAP + strip_h + GAP + bottom_h + 78)
    s.add(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{height:.0f}" '
        f'viewBox="0 0 {W} {height:.0f}" role="img" '
        f'aria-label="Shree Jii platform architecture">'
    )
    s.add(
        "<defs>"
        '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{BG_TOP}"/><stop offset="1" stop-color="{BG_BOTTOM}"/>'
        "</linearGradient>"
        '<radialGradient id="glow" cx="0.5" cy="0" r="0.7">'
        '<stop offset="0" stop-color="#17375f" stop-opacity="0.6"/>'
        '<stop offset="1" stop-color="#0b1626" stop-opacity="0"/>'
        "</radialGradient>"
        '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" '
        'markerHeight="6.5" orient="auto-start-reverse">'
        f'<path d="M0,0 L10,5 L0,10 z" fill="{ACCENT["flow"]}"/></marker>'
        '<marker id="arrowSse" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" '
        'markerHeight="6.5" orient="auto-start-reverse">'
        f'<path d="M0,0 L10,5 L0,10 z" fill="{ACCENT["client"]}"/></marker>'
        "</defs>"
    )
    s.add(f'<rect width="{W}" height="{height:.0f}" fill="url(#bg)"/>')
    s.add(f'<rect width="{W}" height="440" fill="url(#glow)"/>')

    # header
    s.text(M, 62, "Shree Jii Platform", size=30, weight="bold", spacing=0.2)
    s.text(M, 86, "One API, three surfaces. Realtime by default, cache-first by "
                  "design, zero-loss data handling.", size=12.5, fill=MUTED)

    badge_x = W - M
    for label, tone in [("SSE + SWR cache", "#8dc2ff"), ("v2 contract", "#7ff0bf")]:
        bw = text_w(label, 11) + 26
        badge_x -= bw
        s.rect(badge_x, 40, bw, 26, fill=tone + "1a", stroke=tone + "55", rx=13)
        s.text(badge_x + 13, 57.5, label, size=11, fill=tone)
        badge_x -= 10

    # columns
    columns = [
        (0, "1", "Clients", "three surfaces, one API contract", "client", "client"),
        (1, "2", "Edge & transport", "one origin, no CORS in dev", "edge", "edge"),
        (2, "3", "Express API (server/)", "stateless / cache-first / event-driven",
         "api", "core"),
        (3, "4", "Services", "every number cached and observable", "api", "services"),
        (4, "5", "Data & integrations", "MongoDB is the source of truth", "data", "data"),
    ]
    for index, number, title, subtitle, tone, key in columns:
        draw_column(s, xs[index], widths[index], col_h, number, title, subtitle,
                    ACCENT[tone], cards[key])

    # gutter arrows
    y_mid = TOP + 220
    for i in range(4):
        s.arrow(xs[i] + widths[i] + 6, y_mid, xs[i + 1] - 6, y_mid, color=ACCENT["flow"])
    s.arrow(xs[1] - 6, y_mid + 132, xs[0] + widths[0] + 6, y_mid + 132,
            color=ACCENT["client"], dash="5 5", marker="arrowSse")

    # flow strips
    strip_y = TOP + col_h + GAP
    draw_flow(s, M, strip_y, strip_w, "A", "Count tap -> live dashboard (no polling)",
              ACCENT["client"], flows_a[0], flows_a[1], step_color=ACCENT["client"])
    draw_flow(s, M + strip_w + GAP, strip_y, strip_w, "B", "Dashboard read path",
              ACCENT["edge"], flows_b[0], flows_b[1], step_color=ACCENT["flow"])

    # bottom row
    row_y = strip_y + strip_h + GAP
    for index, (letter, title, color, chips, note) in enumerate(bottom):
        x = M + index * (bottom_w + GAP)
        s.rect(x, row_y, bottom_w, bottom_h, fill=PANEL, stroke=PANEL_EDGE)
        s.text(x + 20, row_y + 27, letter, size=12, fill=color, weight="bold", spacing=1.2)
        s.text(x + 36, row_y + 27, title, size=13, fill=TEXT, weight="bold")
        cy = row_y + 44
        for row in chip_rows(chips, bottom_w - 40, size=10.5, pad=11):
            cx = x + 20
            for label, width in row:
                s.chip(cx, cy, label, color=color, size=10.5, height=25, pad=11)
                cx += width + 8
            cy += 31
        s.wrapped(x + 20, cy + 22, note, width=bottom_w - 40, size=10.5, fill=DIM,
                  max_lines=2)

    # footer
    foot = row_y + bottom_h + 34
    s.text(M, foot, "Legend", size=11, fill=MUTED, weight="bold")
    s.arrow(M + 74, foot - 4, M + 118, foot - 4, color=ACCENT["flow"])
    s.text(M + 126, foot, "request / response", size=10.5, fill=MUTED)
    s.arrow(M + 268, foot - 4, M + 312, foot - 4, color=ACCENT["client"], dash="6 5",
            marker="arrowSse")
    s.text(M + 320, foot, "realtime push (SSE)", size=10.5, fill=MUTED)
    s.text(M + 486, foot,
           "MongoDB is the only system of record. Every cache, index and event is "
           "derived and rebuildable.", size=10.5, fill=DIM)
    s.text(W - M, foot, "docs/ARCHITECTURE.md", size=10.5, fill=DIM, anchor="end")

    s.add("</svg>")
    return "".join(s.parts)


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[2] / "docs" / "architecture.svg"
    out.write_text(build(), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} kB)")
