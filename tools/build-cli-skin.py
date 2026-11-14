#!/usr/bin/env python3
"""Build skins/borealis.yaml, the Borealis skin for the Hermes CLI and TUI.

The terminal can't run the Desktop shader, so this script draws one still frame
of the same landscape (aurora curtains, three ridges, a lake, stars and a
crescent moon) and ordered-dithers it into braille dots: each terminal cell is
a 2x4 grid of dots, and each dot is on when the scene's tone beats a Bayer 8x8
threshold. The result becomes the skin's banner art.

Standard library only. Run from the repo root:

    python3 tools/build-cli-skin.py            # writes skins/borealis.yaml
    python3 tools/build-cli-skin.py --preview  # also writes a dark/light HTML preview
"""

import html
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = 'borealis-cli'

# ── The still frame ─────────────────────────────────────────────────────────

COLS, ROWS = 30, 12  # terminal cells; the built-in skins' hero art is about this size
W, H = COLS * 2, ROWS * 4  # braille dots
ASPECT = W / H
HORIZON = 0.2
T = 38.0  # the same moment the Desktop scene holds under reduced motion

# Mid-tone inks, so the art reads on dark and light terminals alike: banner art is
# one block of markup with no light/dark variant.
INK = {
    'tip': '#8b6cf0',  # violet tips of the rays
    'mid': '#6f8ff0',  # blue, where violet turns into mint
    'edge': '#3fcfa2',  # mint lower edge
    'mist': '#5b4fa8',  # mist pooling at the foot of a ridge
    'crest': '#7466c4',  # the ridge line
    'star': '#9a93e0',
    'moon': '#5fd0b4',
}


def fract(x):
    return x - math.floor(x)


def hash2(x, y):
    return fract(math.sin(x * 127.1 + y * 311.7) * 43758.5453123)


def noise(x, y):
    """Gradient noise in about [-1, 1], quintic fade (the shader's)."""
    ix, iy = math.floor(x), math.floor(y)
    gx, gy = x - ix, y - iy
    ux = gx * gx * gx * (gx * (gx * 6 - 15) + 10)
    uy = gy * gy * gy * (gy * (gy * 6 - 15) + 10)

    def corner(cx, cy):
        a = 2 * math.pi * hash2(ix + cx, iy + cy)
        return math.cos(a) * (gx - cx) + math.sin(a) * (gy - cy)

    top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * ux
    bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * ux
    return 1.4142 * (top + (bottom - top) * uy)


def fbm(x, y):
    total, amp = 0.0, 0.5
    for _ in range(4):
        total += amp * noise(x, y)
        x, y = 1.6 * x - 1.2 * y + 3.1, 1.2 * x + 1.6 * y + 1.7
        amp *= 0.5
    return min(max(0.5 + 0.5 * total / 0.9375, 0.0), 1.0)


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def aurora(px, py):
    """(tone, ink) of two tall curtains hanging from wandering lower edges.

    The ink follows height above the lowest edge, as on Desktop: mint at the
    edge, blue a little higher, violet at the tips.
    """
    x = px + T * 0.3 * 0.03
    light, lowest = 0.0, 1.0
    for k in range(2):
        edge = 0.4 + k * 0.12 + 1.2 * 0.06 * noise(x * 0.7 + k * 3.7, T * 0.04 + k * 1.3)
        d = py - edge
        lowest = min(lowest, edge)
        w = x + 0.24 * noise(x * 1.4 + k * 5.0, T * 0.05 + k * 2.0)
        reach = 0.3 + 1.4 * fbm(w * 2.2 + k * 9.0, T * 0.03 + k)
        rays = smoothstep(0.45, 0.6, fbm(w * 5.5 + k * 7.0, T * 0.05 + k))
        body = math.exp(-d * 2.6 / reach) if d > 0 else math.exp(d * 40.0)
        rim = math.exp(-abs(d) * 30.0) * 1.2
        light += (body * rays + rim * (0.25 + 0.75 * rays)) * (1.0 - k * 0.3)
    tone = (1.0 - math.exp(-light * 1.7)) * smoothstep(1.02, 0.7, py)
    h = py - lowest
    return tone, 'edge' if h < 0.15 else 'mid' if h < 0.28 else 'tip'


def ridge(x, seed):
    a = 1.0 - abs(noise(x, seed))
    b = 1.0 - abs(noise(x * 2.3 + 7.0, seed + 3.0))
    return a * a * 0.64 + b * b * 0.3 + 0.05 * noise(x * 7.0, seed + 9.0)


# far to near: (amplitude, frequency, seed, base tone, mist at the foot)
RIDGES = [(0.34, 1.7, 11.0, 0.1, 0.16), (0.22, 2.6, 23.0, 0.03, 0.12), (0.12, 3.9, 37.0, 0.0, 0.06)]


def scene(u, v):
    """(tone, kind) above the water; v runs 0 at the bottom to 1 at the top."""
    px, py = (u - 0.5) * ASPECT, v
    tone, kind = aurora(px, py)

    mx, my = px - 0.36 * ASPECT, py - 0.84
    if math.hypot(mx, my) < 0.1 and math.hypot(mx - 0.045, my - 0.035) > 0.085:
        tone, kind = 1.0, 'moon'

    for amp, freq, seed, base, mist in RIDGES:
        top = HORIZON + amp * ridge(px * freq + seed, seed)
        if py < top:
            # a crest of denser dots, then mist pooling at the foot
            crest = top - py < 1.5 / H
            tone, kind = (0.9, 'crest') if crest else (base + mist * smoothstep(top, HORIZON, py), 'mist')
    return tone, kind


def bayer8(x, y):
    """Ordered-dither threshold in [0, 1), 64 levels."""
    def b2(ax, ay):
        ax, ay = math.floor(ax), math.floor(ay)
        return fract(ax * 0.5 + ay * ay * 0.75)
    return b2(x * 0.25, y * 0.25) * 0.0625 + b2(x * 0.5, y * 0.5) * 0.25 + b2(x, y)


def dot(ix, iy):
    """(on, tone, kind) for one braille dot; iy counts down from the top."""
    u = (ix + 0.5) / W
    v = 1.0 - (iy + 0.5) / H

    if v < HORIZON:
        # The lake: the scene upside down and squashed, every other row dimmed.
        depth = (HORIZON - v) / HORIZON
        ripple = math.sin(iy * 0.9 + T * 1.3) * 0.004 + noise(v * 70.0, T * 0.35) * 0.01
        tone, kind = scene(u + ripple * (0.3 + depth), HORIZON + (HORIZON - v) * 1.7)
        tone *= (0.85 - 0.45 * depth) * (1.0 if iy % 2 == 0 else 0.45)
        if kind == 'moon':
            kind = 'edge'
    else:
        tone, kind = scene(u, v)
        if kind == 'tip' and tone < 0.06:
            bx, by = ix // 7, iy // 7
            if hash2(bx + 17.0, by + 31.0) < 0.3:
                sx = math.floor(hash2(bx + 1.3, by + 5.7) * 7)
                sy = math.floor(hash2(bx + 9.1, by + 2.9) * 7)
                if (ix - bx * 7, iy - by * 7) == (sx, sy):
                    return True, 1.0, 'star'

    return tone > bayer8(ix, iy) + 0.5 / 64, tone, kind


BITS = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]]  # [row][column]


def ink_for(tone, kind):
    return INK[kind]


def hero_cells():
    """Rows of (char, colour or None) cells."""
    rows = []
    for cy in range(ROWS):
        row = []
        for cx in range(COLS):
            mask, lit = 0, []
            for dy in range(4):
                for dx in range(2):
                    on, tone, kind = dot(cx * 2 + dx, cy * 4 + dy)
                    if on:
                        mask |= BITS[dy][dx]
                        lit.append((tone, kind))
            if not lit:
                row.append(('\u2800', None, 0))
                continue
            # The cell takes the colour of its brightest dot: stars and the moon win.
            tone, kind = max(lit, key=lambda tk: (tk[1] in ('star', 'moon'), tk[0]))
            row.append((chr(0x2800 + mask), ink_for(tone, kind), len(lit)))
        rows.append(one_ink_per_row(row))
    return rows


def one_ink_per_row(row):
    """Give the whole row the ink most of its dots want.

    The TUI's banner parser starts a new line at every colour tag, so a row
    with two colours breaks in half there. One tag per row keeps the art
    intact in both the TUI and the classic CLI.
    """
    weight = {}
    for _, ink, dots in row:
        if ink:
            weight[ink] = weight.get(ink, 0) + dots
    ink = max(weight, key=weight.get) if weight else None
    return [(char, ink) for char, _, _ in row]


def to_markup(rows):
    lines = []
    for row in rows:
        ink, text = row[0][1], ''.join(char for char, _ in row)
        lines.append(f'[{ink}]{text}[/]' if ink else text)
    return '\n'.join(lines)


# ── The wordmark: the stock HERMES-AGENT letters in the aurora's ramp ──────

LOGO = """██╗  ██╗███████╗██████╗ ███╗   ███╗███████╗███████╗       █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██║  ██║██╔════╝██╔══██╗████╗ ████║██╔════╝██╔════╝      ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
███████║█████╗  ██████╔╝██╔████╔██║█████╗  ███████╗█████╗███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║
██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══╝  ╚════██║╚════╝██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║
██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗███████║      ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝"""

# Violet tips at the top down to the mint lower edge, like a curtain.
LOGO_RAMP = ['#8b6cf0', '#7c80ee', '#6d95e6', '#5aaed6', '#48c3bb', '#3fcfa2']


def logo_markup():
    return '\n'.join(f'[bold {ink}]{line}[/]' if i < 2 else f'[{ink}]{line}[/]'
                     for i, (ink, line) in enumerate(zip(LOGO_RAMP, LOGO.splitlines())))


# ── Palettes ────────────────────────────────────────────────────────────────

# Night, for dark terminals: near-black indigo surfaces, mint accent, violet labels.
NIGHT = {
    'banner_border': '#5b4fa8', 'banner_title': '#6ff0c4', 'banner_accent': '#9a7bff',
    'banner_dim': '#6c6888', 'banner_text': '#ecebf5',
    'ui_accent': '#6ff0c4', 'ui_label': '#9a7bff',
    'ui_ok': '#6ff0c4', 'ui_error': '#ff6b7a', 'ui_warn': '#fea247',
    'prompt': '#ecebf5', 'input_rule': '#3a3654', 'response_border': '#6ff0c4',
    'status_bar_bg': '#111019', 'status_bar_text': '#c9c7da', 'status_bar_strong': '#6ff0c4',
    'status_bar_dim': '#5f5c78', 'status_bar_good': '#6ff0c4', 'status_bar_warn': '#fea247',
    'status_bar_bad': '#ff8a5c', 'status_bar_critical': '#ff6b7a',
    'session_label': '#9a7bff', 'session_border': '#3f3b58',
    'completion_menu_bg': '#111019', 'completion_menu_current_bg': '#2a2542',
    'completion_menu_meta_bg': '#111019', 'completion_menu_meta_current_bg': '#2a2542',
    'selection_bg': '#2f2a4c', 'shell_dollar': '#6ff0c4', 'voice_status_bg': '#111019',
}

# Day, for light terminals: the two-ink riso print, teal and pink on cream.
DAY = {
    'banner_border': '#e8509a', 'banner_title': '#0a7b6c', 'banner_accent': '#c23b7d',
    'banner_dim': '#8a8378', 'banner_text': '#17151f',
    'ui_accent': '#0a7b6c', 'ui_label': '#c23b7d',
    'ui_ok': '#0a7b6c', 'ui_error': '#c8323e', 'ui_warn': '#b85c00',
    'prompt': '#17151f', 'input_rule': '#d8d0bf', 'response_border': '#0a7b6c',
    'status_bar_bg': '#f2eee4', 'status_bar_text': '#645f58', 'status_bar_strong': '#0a7b6c',
    'status_bar_dim': '#9a948a', 'status_bar_good': '#0a7b6c', 'status_bar_warn': '#b85c00',
    'status_bar_bad': '#c2410c', 'status_bar_critical': '#c8323e',
    'session_label': '#c23b7d', 'session_border': '#d8d0bf',
    'completion_menu_bg': '#faf7f0', 'completion_menu_current_bg': '#e3dccc',
    'completion_menu_meta_bg': '#f2eee4', 'completion_menu_meta_current_bg': '#e3dccc',
    'selection_bg': '#f3d3e2', 'shell_dollar': '#0a7b6c', 'voice_status_bg': '#f2eee4',
}

SPINNER = {
    'waiting_faces': ['(✦)', '(⋆)', '(✧)', '(·)', '(⋆)'],
    'thinking_faces': ['(∿)', '(≋)', '(⌇)', '(∿)', '(✦)'],
    'thinking_verbs': [
        'reading the sky', 'waiting for the curtain', 'tracing the ridgeline',
        'watching the lake', 'following the drift', 'letting the rays settle',
        'counting stars', 'catching a shooting star',
    ],
    'wings': [['⟪✦', '✦⟫'], ['⟪⋆', '⋆⟫'], ['⟪∿', '∿⟫'], ['⟪·', '·⟫']],
}

BRANDING = {
    'welcome': 'Welcome to Hermes Agent, under the Borealis sky. Type your message or /help for commands.',
    'goodbye': 'Clear skies! ✦',
    'response_label': ' ✦ Hermes ',
    'help_header': '(✦) Available Commands',
}

# ── YAML ────────────────────────────────────────────────────────────────────


def q(s):
    """A double-quoted YAML scalar (JSON strings are valid YAML)."""
    return json.dumps(s, ensure_ascii=False)


def block(text, indent='  '):
    return '|-\n' + '\n'.join(indent + line for line in text.splitlines())


def mapping(d, indent='  '):
    return '\n'.join(f'{indent}{k}: {q(v)}' for k, v in d.items())


def build_yaml(hero):
    spinner = '\n'.join(
        [f'  {k}: [{", ".join(q(x) for x in SPINNER[k])}]' for k in ('waiting_faces', 'thinking_faces', 'thinking_verbs')]
        + ['  wings:'] + [f'    - [{q(a)}, {q(b)}]' for a, b in SPINNER['wings']])
    return f"""# Borealis for the Hermes CLI and TUI.
# https://github.com/Adolanium/hermes-borealis
#
# Generated by tools/build-cli-skin.py; edit that script, not this file.
# Install: copy this file to ~/.hermes/skins/{NAME}.yaml, then run /skin {NAME}.
#
# The night palette is the base; light terminals get the day palette on top
# (the TUI picks it by your terminal's background). The banner art is one still
# frame of the Desktop scene, ordered-dithered into braille dots.

name: {NAME}
description: {q('Night aurora over mountains and a lake, in dithered dots; a riso-print dawn on light terminals')}

colors:
{mapping(NIGHT)}

light_colors:
{mapping(DAY)}

spinner:
{spinner}

branding:
{mapping(BRANDING)}

tool_prefix: {q('╎')}

banner_logo: {block(logo_markup())}

banner_hero: {block(hero)}
"""


# ── Preview ─────────────────────────────────────────────────────────────────


def markup_to_html(markup):
    """Just enough of Rich's markup for what this script emits: [#hex], [bold #hex], [/]."""
    out, i = [], 0
    while i < len(markup):
        if markup[i] == '[':
            end = markup.index(']', i)
            tag = markup[i + 1:end]
            if tag == '/':
                out.append('</span>')
            else:
                bold = 'font-weight:700;' if 'bold' in tag.split() else ''
                out.append(f'<span style="{bold}color:{tag.split()[-1]}">')
            i = end + 1
        else:
            out.append(html.escape(markup[i]))
            i += 1
    return ''.join(out)


def hero_svg(rows, cell_w=9, cell_h=18):
    """The braille art as dots, laid out the way a terminal draws braille."""
    dots = []
    for cy, row in enumerate(rows):
        for cx, (char, ink) in enumerate(row):
            mask = ord(char) - 0x2800
            for dy in range(4):
                for dx in range(2):
                    if mask & BITS[dy][dx]:
                        x = cx * cell_w + (dx + 0.5) * cell_w / 2
                        y = cy * cell_h + (dy + 0.5) * cell_h / 4
                        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6" fill="{ink}"/>')
    return (f'<svg width="{len(rows[0]) * cell_w}" height="{len(rows) * cell_h}" '
            f'xmlns="http://www.w3.org/2000/svg">{"".join(dots)}</svg>')


def preview(rows):
    logo, art = markup_to_html(logo_markup()), hero_svg(rows)
    panes = ''.join(
        f'<div style="background:{bg};padding:16px;margin:0 0 12px"><pre class="logo">{logo}</pre>{art}</div>'
        for bg in ('#0b0b10', '#fbfaf6'))
    return f"""<!doctype html><meta charset="utf-8"><title>Borealis CLI skin preview</title>
<style>body{{margin:8px;background:#777}} pre{{margin:0 0 12px;font:3px/1.0 Menlo,monospace}}</style>
{panes}"""


def main():
    rows = hero_cells()
    hero = to_markup(rows)
    target = ROOT / 'skins' / f'{NAME}.yaml'
    target.parent.mkdir(exist_ok=True)
    target.write_text(build_yaml(hero), encoding='utf-8')
    print(f'wrote {target.relative_to(ROOT)}')

    if '--preview' in sys.argv:
        out = Path(sys.argv[sys.argv.index('--preview') + 1]) if len(sys.argv) > sys.argv.index('--preview') + 1 else ROOT / 'skin-preview.html'
        out.write_text(preview(rows), encoding='utf-8')
        print(f'wrote {out}')


if __name__ == '__main__':
    main()
