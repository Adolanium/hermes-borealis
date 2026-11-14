/**
 * Borealis: a live dithered landscape behind the Hermes desktop app, an aurora over mountains and a lake by night and a two-ink dawn by day.
 * https://github.com/Adolanium/hermes-borealis
 *
 * One theme, light and dark, registered through the Desktop plugin SDK. Behind
 * the window runs a live landscape: an aurora over mountain ridges and a lake,
 * drawn in a WebGL shader at one pixel per 3px dither cell and ordered-dithered
 * (Bayer 8x8) into a five-step palette taken from the theme's own colours. Type stays the app's own, and the
 * plugin makes no network requests.
 *
 * Every selector below is app DOM (data-slot / data-* names), not SDK API. If a
 * Desktop update renames one, that piece of the look falls back to the plain
 * palette rather than breaking anything.
 */

import { THEMES_AREA } from '@hermes/plugin-sdk'

const PLUGIN = {"id": "borealis", "name": "Borealis"}

const NAME = 'borealis'

// The theme itself, or an accent retint of it: picking an accent colour renames the
// active theme to `borealis-accent-<hex>`. Not a bare prefix, so other themes whose
// names start with "borealis" (the `borealis-cli` terminal skin, which Desktop also
// lists) don't get the scene.
const T = `:root:is([data-hermes-theme="${NAME}"], [data-hermes-theme^="${NAME}-accent-"])`
const isBorealis = name => name === NAME || name.startsWith(`${NAME}-accent-`)

/* ── Scene settings ──────────────────────────────────────────────────────── */

// A small landscape, drawn back to front: sky (stars, a crescent moon and the odd
// shooting star by night; a low sun by day), tall aurora curtains, three mountain
// ridges, and a lake that mirrors all of it. Heights run 0 (bottom) to 1 (top).
const SCENE = {
  cell: 3, // CSS px per dither cell
  fps: 24, // the motion is slow; more frames only cost power
  speed: 1,
  horizon: 0.12, // the lake's far shore
  parallax: 0.014, // how far the ridges slide with the pointer
  curtains: 2,
  height: 0.2, // lower edge of the first curtain; the ridges hide parts of it
  spread: 0.1, // vertical gap between curtains
  sway: 1.2, // how far the lower edges wander
  rays: 13, // ray striations across the width
  decay: 6.4, // how fast the rays fade upwards; lower is taller
  glow: 0.8, // brightness of the lower edge
  intensity: 0.86,
  drift: 0.3, // sideways travel
  fade: 0.66, // nothing above this height
  starGrid: 20, // one possible star per block of this many cells square
  stars: 0.24, // share of blocks that hold one
  meteorEvery: 13 // seconds between shooting stars
}

const f = n => Number(n).toFixed(5)

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uPointer; // pointer x, -0.5 (left) to 0.5 (right), eased
uniform float uNight; // 1 in dark mode, 0 in light
uniform vec3 uPaper;
uniform vec3 uTint1;
uniform vec3 uTint2;
uniform vec3 uInk;
uniform vec3 uHot;

const float HORIZON = ${f(SCENE.horizon)};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Gradient noise in about [-1, 1], quintic fade.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 g = fract(p);
  vec2 u = g * g * g * (g * (g * 6.0 - 15.0) + 10.0);
  float a0 = 6.2831853 * hash(i);
  float a1 = 6.2831853 * hash(i + vec2(1.0, 0.0));
  float a2 = 6.2831853 * hash(i + vec2(0.0, 1.0));
  float a3 = 6.2831853 * hash(i + vec2(1.0, 1.0));
  float n0 = dot(vec2(cos(a0), sin(a0)), g);
  float n1 = dot(vec2(cos(a1), sin(a1)), g - vec2(1.0, 0.0));
  float n2 = dot(vec2(cos(a2), sin(a2)), g - vec2(0.0, 1.0));
  float n3 = dot(vec2(cos(a3), sin(a3)), g - vec2(1.0, 1.0));
  return 1.4142 * mix(mix(n0, n1, u.x), mix(n2, n3, u.x), u.y);
}

// Four octaves, remapped to [0, 1].
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7);
    amp *= 0.5;
  }
  return clamp(0.5 + 0.5 * sum / 0.9375, 0.0, 1.0);
}

// Ordered-dither threshold in [0, 1), 64 levels, from the recursive 2x2 Bayer step.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}

float bayer8(vec2 a) {
  return bayer2(a * 0.25) * 0.0625 + bayer2(a * 0.5) * 0.25 + bayer2(a);
}

// Tall curtains: each hangs from a wandering lower edge, and its rays follow a
// folded coordinate, so they bunch up and brighten where the curtain turns.
float aurora(vec2 p, float t) {
  float x = p.x + t * ${f(SCENE.drift)} * 0.03;
  float light = 0.0;
  for (int i = 0; i < ${SCENE.curtains}; i++) {
    float k = float(i);
    float edge = ${f(SCENE.height)} + k * ${f(SCENE.spread)}
      + ${f(SCENE.sway)} * 0.06 * noise(vec2(x * 0.7 + k * 3.7, t * 0.04 + k * 1.3));
    float d = p.y - edge;
    float w = x + 0.24 * noise(vec2(x * 1.4 + k * 5.0, t * 0.05 + k * 2.0));
    float w2 = x + 0.01 + 0.24 * noise(vec2((x + 0.01) * 1.4 + k * 5.0, t * 0.05 + k * 2.0));
    float fold = clamp(0.01 / max(abs(w2 - w), 0.0025), 0.0, 4.0);
    float reach = mix(0.3, 1.7, fbm(vec2(w * 2.2 + k * 9.0, t * 0.03 + k)));
    float rays = mix(0.06, 1.0, smoothstep(0.36, 0.68, fbm(vec2(w * ${f(SCENE.rays)} + k * 7.0, t * 0.05 + k))));
    float body = d > 0.0 ? exp(-d * ${f(SCENE.decay)} / reach) : exp(d * 45.0);
    float rim = exp(-abs(d) * 38.0) * ${f(SCENE.glow)};
    light += (body * rays * (0.65 + 0.35 * fold) + rim * (0.35 + 0.65 * rays)) * (1.0 - k * 0.3);
  }
  float tone = (1.0 - exp(-light * 1.15)) * ${f(SCENE.intensity)};
  // by day the curtains thin out to bands of dawn colour
  return tone * mix(0.5, 1.0, uNight) * smoothstep(${f(SCENE.fade)}, ${f(SCENE.fade * 0.45)}, p.y);
}

// A ridge line in [0, 1]: two octaves of sharp crests and a little grit.
float ridge(float x, float seed) {
  float a = 1.0 - abs(noise(vec2(x, seed)));
  float b = 1.0 - abs(noise(vec2(x * 2.3 + 7.0, seed + 3.0)));
  return a * a * 0.64 + b * b * 0.3 + 0.05 * noise(vec2(x * 7.0, seed + 9.0));
}

// One mountain layer over what is behind it. By night a ridge is a silhouette
// with mist pooling at its foot; by day a flat ink that pales towards the shore.
void mountain(inout float tone, inout float ground, vec2 p, float depth, float amp, float freq, float seed, vec2 day, vec2 night) {
  float x = p.x + uPointer * ${f(SCENE.parallax)} * (0.4 + 2.0 * depth);
  float top = HORIZON + amp * ridge(x * freq + seed, seed);
  if (p.y < top) {
    vec2 ink = mix(day, night, uNight);
    tone = ink.x + ink.y * smoothstep(top, HORIZON, p.y);
    ground = 1.0;
  }
}

// A shooting star now and then: a one-cell line whose tail thins into dots.
float meteor(vec2 p, float t, float aspect) {
  float cycle = floor(t / ${f(SCENE.meteorEvery)});
  float age = t - cycle * ${f(SCENE.meteorEvery)};
  if (age > 1.1) {
    return 0.0;
  }
  vec2 dir = normalize(vec2(-1.0, -0.42));
  vec2 head = vec2((hash(vec2(cycle, 3.7)) * 0.55 - 0.1) * aspect, 0.72 + 0.22 * hash(vec2(cycle, 9.2))) + dir * age * 0.55;
  vec2 rel = p - head;
  float along = dot(rel, -dir);
  float across = abs(dot(rel, vec2(-dir.y, dir.x)));
  float tail = 0.16 * min(age * 3.0, 1.0);
  if (along < 0.0 || along > tail || across > 0.75 / uRes.y) {
    return 0.0;
  }
  return (1.0 - along / tail) * smoothstep(1.1, 0.7, age);
}

// Everything above the water. ground is 1 on a mountain, 0 in the sky.
float scene(vec2 uv, float t, out float ground) {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  ground = 0.0;
  float tone = aurora(p, t);

  // day: a low sun with a soft halo
  float sun = length(p - vec2(0.2 * aspect, HORIZON + 0.16));
  tone = max(tone, (1.0 - uNight) * (sun < 0.09 ? 0.38 : 0.24 * exp(-(sun - 0.09) * 9.0)));

  // night: a thin crescent, high on the right, and shooting stars
  vec2 moon = p - vec2(0.36 * aspect, 0.8);
  if (length(moon) < 0.032 && length(moon - vec2(0.014, 0.007)) > 0.03) {
    tone = max(tone, uNight);
  }
  tone = max(tone, uNight * meteor(p, t, aspect));

  mountain(tone, ground, p, 0.0, 0.19, 1.7, 11.0, vec2(0.25, -0.1), vec2(0.13, 0.15));
  mountain(tone, ground, p, 0.5, 0.125, 2.6, 23.0, vec2(0.5, -0.1), vec2(0.05, 0.14));
  mountain(tone, ground, p, 1.0, 0.07, 3.9, 37.0, vec2(0.75, 0.0), vec2(0.0, 0.07));
  return tone;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = (cell + 0.5) / uRes;
  float ground;
  float tone;

  if (uv.y < HORIZON) {
    // The lake: the scene upside down and squashed, pushed sideways by ripples
    // that grow towards the near shore, on every other row so it reads as water.
    float depth = (HORIZON - uv.y) / HORIZON;
    float ripple = sin(cell.y * 0.9 + uTime * 1.3) * 0.0016 + noise(vec2(uv.y * 70.0, uTime * 0.35)) * 0.006;
    tone = scene(vec2(uv.x + ripple * (0.3 + depth), HORIZON + (HORIZON - uv.y) * 1.7), uTime, ground);
    tone *= mix(0.95, 0.5, depth) * (mod(cell.y, 2.0) < 1.0 ? 1.0 : 0.5);
    ground = 1.0;
  } else {
    tone = scene(uv, uTime, ground);
  }

  tone = clamp(tone, 0.0, 1.0);
  tone = floor(tone * 64.0 + 0.5) / 64.0;
  float threshold = bayer8(cell) + 0.5 / 64.0;
  float scaled = tone * 4.0;
  float index = floor(scaled);
  index = min(index + step(threshold, scaled - index), 4.0);

  // A sparse sky of single-cell stars that twinkle in the empty paper: each block
  // of cells may hold one, at a spot of its own. The hash is too coarse (sin of a
  // large argument keeps few bits) to pick single cells, but fine per block.
  vec2 block = floor(cell / ${f(SCENE.starGrid)});
  float h = hash(block + vec2(17.0, 31.0));
  vec2 spot = floor(vec2(hash(block + vec2(1.3, 5.7)), hash(block + vec2(9.1, 2.9))) * ${f(SCENE.starGrid)});
  if (uNight > 0.5 && ground < 0.5 && index < 0.5 && h < ${f(SCENE.stars)} && all(equal(cell - block * ${f(SCENE.starGrid)}, spot))) {
    float s = hash(block + vec2(4.2, 8.4));
    if (sin(uTime * (0.4 + s * 1.4) + s * 40.0) > -0.35) {
      index = 3.0;
    }
  }

  vec3 color = index < 0.5 ? uPaper : index < 1.5 ? uTint1 : index < 2.5 ? uTint2 : index < 3.5 ? uInk : uHot;
  gl_FragColor = vec4(color, 1.0);
}
`

const VERTEX = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

/* ── Theme colours to shader colours ─────────────────────────────────────── */

// Two-tone like a real aurora: faint tips in a second ink (violet by night,
// fluorescent pink on paper), a bright lower edge in the theme's accent. Paper,
// accent and foreground come from the live CSS variables, so the sky follows
// light and dark and an accent retint without a second copy of the colours.
const TIPS = { dark: '#9a7bff', light: '#e8509a' }
const UNIFORMS = ['uPaper', 'uTint1', 'uTint2', 'uInk', 'uHot']

const paletteFor = dark => {
  const tip = TIPS[dark ? 'dark' : 'light']
  return {
    uPaper: 'var(--ui-bg-chrome)',
    uTint1: `color-mix(in oklch, ${tip} ${dark ? 38 : 32}%, var(--ui-bg-chrome))`,
    // By night the tips sweep through blue into the mint edge; on paper the two
    // inks stay apart, like a two-colour riso print.
    uTint2: dark
      ? `color-mix(in oklch, color-mix(in oklch, ${tip} 55%, var(--theme-midground)) 70%, var(--ui-bg-chrome))`
      : `color-mix(in oklch, ${tip} 72%, var(--ui-bg-chrome))`,
    uInk: 'var(--theme-midground)',
    uHot: `color-mix(in oklch, var(--theme-midground) ${dark ? 55 : 70}%, var(--theme-foreground))`
  }
}

function readPalette() {
  const probe = document.createElement('i')
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none'
  document.body.append(probe)
  const pixel = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  pixel.canvas.width = pixel.canvas.height = 1
  const out = {}

  for (const [key, css] of Object.entries(paletteFor(document.documentElement.classList.contains('dark')))) {
    probe.style.color = ''
    probe.style.color = css
    // The computed colour may be color(srgb …) or oklch(…); the 2D canvas turns any of them into bytes.
    pixel.fillStyle = '#000'
    pixel.fillStyle = getComputedStyle(probe).color
    pixel.clearRect(0, 0, 1, 1)
    pixel.fillRect(0, 0, 1, 1)
    const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data
    out[key] = [r / 255, g / 255, b / 255]
  }

  probe.remove()
  return out
}

/* ── The aurora stage: one fixed canvas behind the whole window ──────────── */

function createStage() {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.borealisScene = ''
  // Fixed under everything: z-index -1 in the root stacking context paints above
  // <html>'s background and below all app content, whose field surfaces the CSS
  // below turns transparent.
  canvas.style.cssText =
    'position:fixed;left:0;top:0;z-index:-1;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges;'

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false
  })

  if (!gl) {
    // No WebGL: the flat paper from the CSS stays, which is still the theme.
    return { refresh() {}, destroy() {} }
  }

  document.body.prepend(canvas)

  let program = null
  let locations = {}
  let palette = readPalette()
  let raf = 0
  let last = 0
  let start = performance.now()
  let lost = false
  let pointer = 0
  let pointerTarget = 0
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(`[${PLUGIN.id}] aurora shader:`, gl.getShaderInfoLog(shader))
      return null
    }

    return shader
  }

  const build = () => {
    const vs = compile(gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)

    if (!vs || !fs) {
      program = null
      return
    }

    program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'aPos')
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(`[${PLUGIN.id}] aurora program:`, gl.getProgramInfoLog(program))
      program = null
      return
    }

    gl.useProgram(program)
    // One triangle that covers the viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    locations = Object.fromEntries(
      ['uRes', 'uTime', 'uPointer', 'uNight', ...UNIFORMS].map(name => [name, gl.getUniformLocation(program, name)])
    )
  }

  const draw = now => {
    if (!program || lost) {
      return
    }

    // reduced motion holds one moment, picked so no shooting star is in flight
    const t = motion.matches ? 38 : ((now - start) / 1000) * SCENE.speed
    pointer += (pointerTarget - pointer) * 0.08
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(locations.uRes, canvas.width, canvas.height)
    gl.uniform1f(locations.uTime, t)
    gl.uniform1f(locations.uPointer, pointer)
    gl.uniform1f(locations.uNight, document.documentElement.classList.contains('dark') ? 1 : 0)

    for (const key of UNIFORMS) {
      gl.uniform3fv(locations[key], palette[key])
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const resize = () => {
    // Whole device pixels per cell, so every cell is the same size.
    const dpr = window.devicePixelRatio || 1
    const snapped = Math.max(1, Math.round(SCENE.cell * dpr)) / dpr
    const columns = Math.max(1, Math.ceil(window.innerWidth / snapped))
    const rows = Math.max(1, Math.ceil(window.innerHeight / snapped))
    canvas.width = columns
    canvas.height = rows
    canvas.style.width = `${columns * snapped}px`
    canvas.style.height = `${rows * snapped}px`
    draw(performance.now())
  }

  const tick = now => {
    raf = requestAnimationFrame(tick)

    if (now - last >= 1000 / SCENE.fps - 2) {
      last = now
      draw(now)
    }
  }

  const play = () => {
    cancelAnimationFrame(raf)
    raf = 0

    if (!motion.matches && !document.hidden) {
      raf = requestAnimationFrame(tick)
    } else {
      draw(performance.now())
    }
  }

  const onPointer = event => {
    pointerTarget = event.clientX / window.innerWidth - 0.5
  }

  const onLost = event => {
    event.preventDefault()
    lost = true
    cancelAnimationFrame(raf)
  }

  const onRestored = () => {
    lost = false
    build()
    resize()
    play()
  }

  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('visibilitychange', play)
  motion.addEventListener('change', play)

  build()
  resize()
  play()

  return {
    // Mode or accent changed: read the colours again.
    refresh() {
      palette = readPalette()
      draw(performance.now())
    },
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', play)
      motion.removeEventListener('change', play)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }
  }
}

// Mount the aurora while this theme is active, and only then.
function auroraBackdrop() {
  const root = document.documentElement
  let stage = null
  let pending = 0

  const sync = () => {
    pending = 0
    const active = isBorealis(root.dataset.hermesTheme ?? '')

    if (active && !stage) {
      stage = createStage()
    } else if (!active && stage) {
      stage.destroy()
      stage = null
    } else if (stage) {
      stage.refresh()
    }
  }

  // Theme, mode (the `dark` class) and accent (inline seed vars) all land on <html>.
  // Coalesce bursts of attribute writes into one read per frame.
  const observer = new MutationObserver(() => {
    pending ||= requestAnimationFrame(sync)
  })
  observer.observe(root, { attributes: true, attributeFilter: ['data-hermes-theme', 'class', 'style'] })
  sync()

  return () => {
    observer.disconnect()
    cancelAnimationFrame(pending)
    stage?.destroy()
    stage = null
  }
}

/* ── CSS ─────────────────────────────────────────────────────────────────── */

// A dither-fade rule: a solid hairline, then rows of thinning dots, so an edge
// dissolves the way the sky does. `down` fades below a horizontal edge, `left`
// fades leftwards from a vertical one.
const fadeRule = (color, dir) => {
  const across = dir === 'down' ? '90deg' : '180deg'
  const rows = [
    [`linear-gradient(${color}, ${color})`, 0],
    [`repeating-linear-gradient(${across}, ${color} 0 1px, transparent 1px 2px)`, 1],
    [`repeating-linear-gradient(${across}, transparent 0 1px, ${color} 1px 2px, transparent 2px 4px)`, 2],
    [`repeating-linear-gradient(${across}, ${color} 0 1px, transparent 1px 8px)`, 3]
  ]
  const at = dir === 'down' ? n => `0 ${n}px` : n => `calc(100% - ${n}px) 0`
  const size = dir === 'down' ? '100% 1px' : '1px 100%'

  return {
    image: rows.map(([g]) => g).join(', '),
    position: rows.map(([, n]) => at(n)).join(', '),
    size: rows.map(() => size).join(', ')
  }
}

const DOWN = fadeRule('var(--borealis-rule)', 'down')
const LEFT = fadeRule('var(--borealis-rule)', 'left')

// A 2px checkerboard: the 50% dither step, used as a fill.
const checker = color => `repeating-conic-gradient(${color} 0 25%, transparent 0 50%) 0 0 / 2px 2px`

const CSS = `
${T} {
  --borealis-rule: color-mix(in srgb, var(--theme-foreground) 16%, transparent);
  --borealis-dim: color-mix(in srgb, var(--theme-foreground) 58%, transparent);

  /* One painter for the field: <html> holds the paper, the aurora canvas sits on
     it, and the field surfaces go clear so both show through. Same shape as
     Hermes's own window-glass mode. */
  background-color: var(--ui-bg-chrome) !important;
  --ui-chat-surface-background: transparent;
  --ui-sidebar-surface-background: transparent;
  --ui-editor-surface-background: transparent;
  --ui-terminal-surface-background: var(--ui-bg-chrome);
}

${T} body {
  background: transparent !important;
}

${T} [data-contrib-shell],
${T} [data-slot='sidebar-wrapper'] {
  background-color: transparent !important;
}

/* Surfaces that cover their own siblings stay filled, or text shows through text. */
${T} [data-glass-opaque] {
  --ui-chat-surface-background: var(--ui-bg-chrome);
  --ui-editor-surface-background: var(--ui-bg-chrome);
  --ui-sidebar-surface-background: var(--ui-bg-sidebar);
}

${T} [data-glass-raised] {
  --ui-chat-surface-background: var(--ui-bg-chrome);
  --ui-sidebar-surface-background: var(--ui-bg-sidebar);
  --ui-editor-surface-background: var(--ui-bg-chrome);
}

/* The scene is at full strength only on an empty chat. Once there is text to
   read (a conversation, or any other page), it fades back so it never competes
   with the words. The canvas sits on <html>'s paper, so opacity fades to paper. */
${T} canvas[data-borealis-scene] {
  opacity: 0.26;
  transition: opacity 700ms ease;
}

${T}:has([data-slot="aui_intro"]) canvas[data-borealis-scene] {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  ${T} canvas[data-borealis-scene] {
    transition: none;
  }
}

/* The sessions sidebar is clear like every other side panel, so the sky runs
   under it too; only its dithered edge (below) marks where it ends. */
${T} [data-slot="sidebar"] {
  position: relative;
  border-right: 0 !important;
  background-color: transparent !important;
}

/* ── Edges dissolve: dither-fade rules instead of hairlines ──────────────── */

${T} [data-slot="sidebar"]::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 4px;
  background-image: ${LEFT.image};
  background-position: ${LEFT.position};
  background-size: ${LEFT.size};
  background-repeat: no-repeat;
  pointer-events: none;
}

${T} [data-tree-group][data-window-top] > [data-panel-header] {
  position: relative;
  border-bottom: 0 !important;
}

${T} [data-tree-group][data-window-top] > [data-panel-header]::after {
  content: '';
  position: absolute;
  inset: 100% 0 auto 0;
  height: 4px;
  background-image: ${DOWN.image};
  background-position: ${DOWN.position};
  background-size: ${DOWN.size};
  background-repeat: no-repeat;
  pointer-events: none;
  z-index: 1;
}

${T} [data-sash-overlap] {
  opacity: 0;
}

/* ── Tabs: small mono caps; the active one carries a dithered block ──────── */

${T} [data-slot="pane-tab"],
${T} [data-tree-tab] {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: 2px !important;
}

${T} [data-slot="pane-tab"][data-active="true"],
${T} [data-tree-tab][data-active="true"] {
  color: var(--theme-foreground);
  background-color: color-mix(in srgb, var(--theme-foreground) 7%, transparent) !important;
}

${T} [data-slot="pane-tab"][data-active="true"]::before,
${T} [data-tree-tab][data-active="true"]::before {
  content: '';
  flex: none;
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-inline-end: 7px;
  background: ${checker('var(--theme-midground)')};
}

${T} [data-slot="pane-tab"][data-active="true"]::after,
${T} [data-tree-tab][data-active="true"]::after {
  display: none !important;
}

${T} [data-slot="pane-tab"][data-active="false"] {
  color: var(--borealis-dim);
}

/* ── Composer: a squared, solid card over the sky ────────────────────────── */

${T} [data-slot="composer-surface"] {
  background: var(--ui-bg-editor) !important;
  border: 1px solid var(--borealis-rule) !important;
  border-radius: 6px !important;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ui-bg-chrome) 65%, transparent) !important;
}

${T} [data-slot="composer-surface"]:focus-within {
  border-color: color-mix(in srgb, var(--theme-midground) 60%, transparent) !important;
}

${T} [data-slot="composer-surface"] button[data-variant="default"] {
  background: var(--theme-midground) !important;
  color: var(--dt-midground-foreground) !important;
  border-radius: 4px !important;
}

${T} [data-slot="kbd"] {
  font-family: var(--font-mono);
  background: transparent !important;
  border: 1px solid var(--borealis-rule) !important;
  border-radius: 2px !important;
  color: var(--borealis-dim) !important;
}

${T} [data-slot="sidebar-input"],
${T} [data-slot="sidebar"] input[type="search"] {
  border: 0 !important;
  border-radius: 0 !important;
  background: linear-gradient(var(--borealis-rule), var(--borealis-rule)) 0 100% / 100% 1px no-repeat !important;
}

/* ── Empty chat: a solid title ───────────────────────────────────────────── */

${T} .wordmark {
  /* .fit-text sizes the letters to fill this width; cap it so the title stays a
     title on wide windows. (--fit-max doesn't work here: the app's formula
     offsets it by a support sentinel.) */
  width: min(calc(100% - 1rem), 46rem) !important;
  mix-blend-mode: normal !important;
}

/* Solid letters, no background-clip: the fitted text overflows its parent box
   (the hidden width twin still takes flex space), and a clipped fill only
   paints inside a box, so the last letters went missing. */
${T} .wordmark > span:not([aria-hidden]) > span {
  color: var(--theme-foreground);
}

${T} [data-slot="aui_intro"] p:not(.wordmark) {
  color: var(--borealis-dim);
  font-size: 1.0625rem;
  line-height: 1.6;
  max-width: 46ch;
  margin-inline: auto;
}
`

/* ── The theme ───────────────────────────────────────────────────────────── */

const THEME = {
  name: NAME,
  label: 'Borealis',
  description: 'A live dithered landscape: aurora over mountains and a lake by night, a riso-print dawn by day',
  colors: {
    background: '#f2eee4',
    foreground: '#17151f',
    card: '#faf7f0',
    cardForeground: '#17151f',
    muted: '#e7e1d3',
    mutedForeground: '#645f58',
    popover: '#fbf9f3',
    popoverForeground: '#17151f',
    primary: '#0a7b6c',
    primaryForeground: '#f7f4ec',
    secondary: '#e7e1d3',
    secondaryForeground: '#17151f',
    accent: '#e3dccc',
    accentForeground: '#17151f',
    border: '#d8d0bf',
    input: '#d0c7b4',
    ring: '#0a7b6c',
    midground: '#0a7b6c',
    midgroundForeground: '#f7f4ec',
    composerRing: '#0a7b6c',
    destructive: '#c8323e',
    destructiveForeground: '#f7f4ec',
    sidebarBackground: '#f2eee4',
    sidebarBorder: '#ddd5c4',
    userBubble: '#e9e3d5',
    userBubbleBorder: '#d8d0bf'
  },
  darkColors: {
    background: '#08080d',
    foreground: '#ecebf5',
    card: '#111019',
    cardForeground: '#ecebf5',
    muted: '#17161f',
    mutedForeground: '#8f8ca5',
    popover: '#14131d',
    popoverForeground: '#ecebf5',
    primary: '#6ff0c4',
    primaryForeground: '#04140e',
    secondary: '#17161f',
    secondaryForeground: '#ecebf5',
    accent: '#1d1b28',
    accentForeground: '#ecebf5',
    border: '#24222f',
    input: '#2b2938',
    ring: '#6ff0c4',
    midground: '#6ff0c4',
    midgroundForeground: '#04140e',
    composerRing: '#6ff0c4',
    destructive: '#ff6b7a',
    destructiveForeground: '#14060a',
    sidebarBackground: '#08080d',
    sidebarBorder: '#1c1a26',
    userBubble: '#15141e',
    userBubbleBorder: '#272533'
  },
  terminal: {
    foreground: '#17151f',
    cursor: '#0a7b6c',
    selectionBackground: '#0a7b6c33',
    black: '#0b0b0b',
    red: '#d0312d',
    green: '#0a924b',
    yellow: '#d76900',
    blue: '#0078cb',
    magenta: '#d12c80',
    cyan: '#007f8f',
    white: '#717171',
    brightBlack: '#555555',
    brightRed: '#e0473f',
    brightGreen: '#0fa859',
    brightYellow: '#e57c10',
    brightBlue: '#3b4fd1',
    brightMagenta: '#8a3fd1',
    brightCyan: '#0596a8',
    brightWhite: '#0b0b0b'
  },
  darkTerminal: {
    foreground: '#ecebf5',
    cursor: '#6ff0c4',
    selectionBackground: '#9a7bff40',
    black: '#08080d',
    red: '#f75d5c',
    green: '#4fd57f',
    yellow: '#fea247',
    blue: '#3faff3',
    magenta: '#fa78b2',
    cyan: '#5fd3e0',
    white: '#cfcfcf',
    brightBlack: '#5c5c5c',
    brightRed: '#ff8382',
    brightGreen: '#7fe6a3',
    brightYellow: '#ffc07f',
    brightBlue: '#a99bff',
    brightMagenta: '#c48cf5',
    brightCyan: '#8fe6ef',
    brightWhite: '#ffffff'
  },
  customCSS: CSS
}

export default {
  id: PLUGIN.id,
  name: PLUGIN.name,
  register(ctx) {
    ctx.register({ id: NAME, area: THEMES_AREA, data: THEME })
    ctx.onDispose(auroraBackdrop())
  }
}
