// =============================================================
// sketch.js — Spellbound Portal Tunnel
// Built on the reference sketch (p5 WEBGL + LightingGradientShader +
// Element/Motif). PARAMS is the whole "rule set": copy it as JSON to
// save a look, paste it back into a preset to reuse it.
// =============================================================
p5.disableFriendlyErrors = true;

// ---- Spellbound palettes (first colour = background), added in front of color.js schemes
colorScheme.unshift(
  { name: 'SB Void',       colors: ['#020926', '#7a00a6', '#a490ff', '#2a0a6b', '#5b1fe0'] },
  { name: 'SB Lilac',      colors: ['#a490ff', '#b4a4fc', '#cbbfff', '#7a00a6', '#ece6ff'] },
  { name: 'SB Arcana',     colors: ['#020926', '#a490ff', '#7a00a6', '#f4b232', '#ece6ff'] },
  { name: 'SB Nightglass', colors: ['#0b0630', '#3b1fa8', '#a490ff', '#ff7ad9', '#f2dbbd'] },
  { name: 'SB Ember',      colors: ['#1c0710', '#7a00a6', '#ff5a36', '#ffb347', '#f2dbbd'] },
  { name: 'SB Void mono',  colors: ['#020926', '#6f16a0'] },
  { name: 'SB Lilac mono', colors: ['#a490ff', '#b4a4fc'] },
  // edition palettes
  { name: 'SB Sci-fi',     colors: ['#04060d', '#00e5ff', '#ff2bd6', '#3a5cff', '#d9fbff'] },
  { name: 'SB Wind',       colors: ['#dcebe5', '#ffffff', '#9fd8c8', '#5fb3a1', '#c4e3d8'] },
  { name: 'SB Water',      colors: ['#03162b', '#1e6fd9', '#38b6ff', '#9be7ff', '#0b3d7a'] },
  { name: 'SB Ice',        colors: ['#0a1a2b', '#e8fbff', '#9fe3ff', '#5fb8e6', '#ffffff'] },
  { name: 'SB Halloween',  colors: ['#0e0710', '#ff7a00', '#7a00a6', '#ffd23f', '#2a0d36'] },
  { name: 'SB Thunder',    colors: ['#0c0a1e', '#ffe14d', '#a490ff', '#fff7c2', '#5b1fe0'] },
);

const FORMATS = { '4:5': [800, 1000], 'card': [720, 1006], '1:1': [900, 900], '9:16': [720, 1280] };

const BASE = {
  // skeleton (khung xương): the spine every stroke follows
  skeleton: 'ring', shape: 'squircle', sides: 6, soften: .4, roundness: 2, archH: 1.2, petals: 5, petalAmp: .16, aspect: .9, shapeRot: 0,
  spiralTurns: 1.4, spiralTighten: .55,
  strokes: 2, gap: .1, coverage: .9, covJitter: .1, startDrift: .17, startJitter: .15, wobble: .012,
  // link: 'separate' rings, or 'chain' — each stroke's tail meets the next deeper stroke's head (one vortex)
  link: 'separate', tailGap: 0, chainDir: 1,
  // rect skeleton: each side is a stroke from a thick corner to a sharp point
  rectMode: 'L', rectTaper: 1.1, rectTip: .03, rectOver: .45, rectHook: .35, rectGap: 0, rectJitter: .02,
  // brush: how paint is laid along the spine (defaults = "Tapered ink")
  brush: 'taper', width: .15, taperIn: .35, taperOut: .45, swell: .15, flareIn: 0, flareOut: 0,
  stepAmp: 0, stepPos: .3, stepLen: .25, stepJitter: .5, stepSide: 1, pressure: .1, nibAmt: 0, nibAngle: 35, bias: 0,
  tipMode: 'stamp', stampPlace: 'centre', stampPivot: 'auto', stampSize: 1,   // tip brush (uploaded SVG or built-in)
  tipSource: 'upload', widthProfile: 'custom', theme: 'none',
  scatterSpacing: .12, scatterSize: .12, scatterSizeJit: .4, scatterRotJit: .2, scatterOffset: .03, scatterAlign: true, scatterByWidth: true,
  // brush texture (shader)
  bristles: 0, dry: 0, rough: .15, streak: 0, paintOn: 0, wallShade: .6,
  // layout
  layout: 'tunnel', axisYaw: 0, axisPitch: 0, rowAngle: 0, rowDepth: -900, pathAmp: 220, pathFreq: .5, pathSpeed: .2, pathRound: 0,
  // tunnel
  count: 16, spacing: 280, length: 120, radius: 240, curveX: 0, curveY: 0, depthMode: 'even', geoRatio: .65, geoNear: 320,
  camZ: 866, fov: 45, lookX: 0, lookY: 0, vpX: 0, vpY: 0, nearClip: 280, farFade: .18, nearFade: .08,
  // motion
  fly: 1.2, breathe: 0, breatheLength: 0, twist: 8, spin: 0, breakDrift: 0,
  // shader
  gradType: 0, animType: 5, gradSpeed: 1.2, angle: 90, gScale: 1, stripes: 8, stripeTwist: 2, steps: 3,
  ambient: 1, diffuse: 0, fog: .6, fogNear: 600, fogFar: 5000,
  // portal opening (plays on preset / summon / click on the frame)
  introOn: true, introDur: 1.1, introFade: .16, introSpin: .7, introStagger: .6, introScale: 1, introDepth: 5, introBounce: 1, introAlternate: false,
  // colour
  palette: 'SB Void', skipBg: true, seed: 7,
};

// Illustrator-style width profiles (one click sets the taper / swell sliders)
const WIDTH_PROFILES = {
  uniform: { name: 'Uniform', p: { taperIn: 0, taperOut: 0, swell: 0 } },
  wp1: { name: 'Width Profile 1 · lens', p: { taperIn: .5, taperOut: .5, swell: 0 } },
  wp2: { name: 'Width Profile 2 · taper end', p: { taperIn: 0, taperOut: 1, swell: 0 } },
  wp3: { name: 'Width Profile 3 · taper start', p: { taperIn: 1, taperOut: 0, swell: 0 } },
  wp4: { name: 'Width Profile 4 · bulge', p: { taperIn: .15, taperOut: .15, swell: .8 } },
  wp5: { name: 'Width Profile 5 · pinch', p: { taperIn: 0, taperOut: 0, swell: -1 } },
  wp6: { name: 'Width Profile 6 · comet', p: { taperIn: .06, taperOut: .9, swell: .3 } },
};

// Edition themes: one click re-skins the current preset (palette, brush texture, hand feel, shader).
// Skeleton, layout and camera stay as they are.
const THEMES = [
  { id: 'arcana',    name: 'Arcana',    sw: ['#020926', '#7a00a6', '#a490ff'], p: { palette: 'SB Void', skipBg: true, bristles: 0, dry: 0, rough: 0, streak: 0, wobble: 0, pressure: 0, steps: 0, gradType: 0, animType: 5, gradSpeed: 1.2, angle: 90, fog: .3, spin: 0 } },
  { id: 'scifi',     name: 'Sci-fi',    sw: ['#04060d', '#00e5ff', '#ff2bd6'], p: { palette: 'SB Sci-fi', skipBg: true, bristles: 0, dry: 0, rough: 0, streak: 0, wobble: 0, pressure: 0, steps: 4, gradType: 9, stripes: 6, stripeTwist: 0, animType: 1, gradSpeed: .8, fog: .5, spin: 0 } },
  { id: 'wind',      name: 'Gió · Wind', sw: ['#dcebe5', '#ffffff', '#5fb3a1'], p: { palette: 'SB Wind', skipBg: true, bristles: 14, dry: .35, rough: .3, streak: .3, wobble: .03, pressure: .3, steps: 0, gradType: 0, angle: 0, animType: 3, gradSpeed: .6, fog: .45, spin: .03 } },
  { id: 'water',     name: 'Nước · Water', sw: ['#03162b', '#1e6fd9', '#9be7ff'], p: { palette: 'SB Water', skipBg: true, bristles: 0, dry: 0, rough: .1, streak: 0, wobble: .025, pressure: .2, steps: 3, gradType: 9, stripes: 3, stripeTwist: 3, animType: 1, gradSpeed: .6, fog: .6, spin: .01 } },
  { id: 'ice',       name: 'Băng · Ice', sw: ['#0a1a2b', '#e8fbff', '#5fb8e6'], p: { palette: 'SB Ice', skipBg: true, bristles: 0, dry: 0, rough: .35, streak: 0, wobble: 0, pressure: 0, steps: 4, gradType: 5, animType: 0, gradSpeed: 0, fog: .55, spin: 0 } },
  { id: 'fire',      name: 'Lửa · Fire', sw: ['#1c0710', '#ff5a36', '#ffb347'], p: { palette: 'SB Ember', skipBg: true, bristles: 18, dry: .45, rough: .35, streak: .35, wobble: .02, pressure: .3, steps: 3, gradType: 1, animType: 4, gradSpeed: 1, fog: .5, spin: .02 } },
  { id: 'halloween', name: 'Halloween', sw: ['#0e0710', '#ff7a00', '#7a00a6'], p: { palette: 'SB Halloween', skipBg: true, bristles: 24, dry: .6, rough: .5, streak: .4, wobble: .02, pressure: .3, steps: 3, gradType: 6, animType: 1, gradSpeed: .5, fog: .7, spin: 0 } },
  { id: 'thunder',   name: 'Sấm · Thunder', sw: ['#0c0a1e', '#ffe14d', '#a490ff'], p: { palette: 'SB Thunder', skipBg: true, bristles: 0, dry: 0, rough: .2, streak: 0, wobble: .045, pressure: .4, steps: 2, gradType: 0, angle: 0, animType: 6, gradSpeed: 1.5, fog: .5, spin: 0 } },
];

// A brush from the library, as preset fields
const brushOf = id => { const o = Object.assign({ brush: id }, BR.LIBRARY[id]); delete o.name; return o; };

// Applied when the Layout menu changes, so each layout starts from a working view.
const LAYOUT_DEFAULTS = {
  tunnel:   { axisYaw: 0, axisPitch: 0, camZ: 866, lookX: 0, lookY: 0, curveX: 0, curveY: 0 },
  corridor: { axisYaw: 28, axisPitch: -10, camZ: 1800, lookX: 0, lookY: 0, curveX: 0, curveY: 0 },
  row:      { axisYaw: 0, axisPitch: 0, rowAngle: -18, rowDepth: -1500, camZ: 1300, lookX: 0, lookY: 0, curveX: 0, curveY: 0 },
  helix:    { axisYaw: 0, axisPitch: 0, pathAmp: 100, pathFreq: .35, pathSpeed: .2, camZ: 1100, curveX: 0, curveY: 0 },
  wave:     { axisYaw: 30, axisPitch: -8, pathAmp: 280, pathFreq: .35, pathSpeed: .25, pathRound: 0, camZ: 2200, curveX: 0, curveY: 0 },
};

// Layouts hidden from the UI for now (code kept). Remove a name from this list to bring it back.
const HIDDEN_LAYOUTS = ['corridor', 'row'];

const PRESETS_ALL = [
  { name: 'Chained vortex', p: Object.assign(brushOf('chisel'), { link: 'chain', tailGap: 0, skeleton: 'ring', shape: 'squircle', roundness: 2, aspect: .92, coverage: .75, width: .085, stepAmp: 1.4, stepPos: .78, stepLen: .2, stepJitter: 0, bias: .4, taperIn: .03, taperOut: .03, count: 16, spacing: 330, length: 0, radius: 250, twist: 6, camZ: 700, steps: 0, fog: .25, fogFar: 6000, fly: .9, palette: 'SB Void mono', skipBg: true, seed: 81 }) },
  { name: 'Open rings', p: Object.assign(brushOf('chisel'), { link: 'separate', skeleton: 'ring', shape: 'squircle', roundness: 2, aspect: .94, coverage: .93, covJitter: .04, startDrift: .37, startJitter: .04, wobble: 0, strokes: 1, width: .1, stepAmp: 1.3, stepPos: .1, stepLen: .22, stepJitter: .4, bias: .4, count: 14, spacing: 260, length: 0, radius: 250, twist: 0, steps: 0, fog: .25, fogFar: 6000, fly: .9, palette: 'SB Void mono', skipBg: true, seed: 82 }) },
  // Chevron rise — linear, rising from below (rules approved by the CD, 2026-10-23)
  { name: 'Chevron rise', p: { skeleton: 'ring', shape: 'polygon', sides: 4, soften: 0, roundness: 2, archH: 1.2, petals: 5, petalAmp: 0.16, aspect: 1, shapeRot: 0, spiralTurns: 1.4, spiralTighten: 0.55, strokes: 1, gap: 0.1, coverage: 0.5, covJitter: 0, startDrift: 0, startJitter: 0, wobble: 0, link: 'separate', tailGap: 0, chainDir: 1, brush: 'chisel', width: 0.036, taperIn: 0.3, taperOut: 0.02, swell: 0, flareIn: 0, flareOut: 0, stepAmp: 3.2, stepPos: 0.03, stepLen: 0.79, stepJitter: 0, stepSide: -1, pressure: 0, nibAmt: 0, nibAngle: 35, bias: 0, tipMode: 'stamp', stampPlace: 'centre', stampPivot: 'centre', stampSize: 1, bristles: 0, dry: 0, rough: 0, streak: 0, paintOn: 0, wallShade: 0.6, layout: 'tunnel', axisYaw: 0, axisPitch: 0, rowAngle: 0, rowDepth: -900, pathAmp: 220, pathFreq: 0.5, pathSpeed: 0.2, pathRound: 0, count: 11, spacing: 430, length: 0, radius: 300, curveX: 0, curveY: 0, depthMode: 'geometric', geoRatio: 0.65, geoNear: 60, camZ: 700, fov: 50, lookX: 0, lookY: 0, vpX: -0.29, vpY: 0.62, nearClip: 200, fly: 0.9, breathe: 0, breatheLength: 0, twist: 0, spin: 0, breakDrift: 0, gradType: 0, animType: 5, gradSpeed: 1.2, angle: 90, gScale: 1, stripes: 8, stripeTwist: 2, steps: 0, ambient: 0.94, diffuse: 0, fog: 0.2, fogNear: 600, fogFar: 6000, introOn: true, introDur: 1.1, introFade: 0.16, introSpin: 0.15, introStagger: 0.5, introScale: 1, introBounce: 1, introAlternate: false, palette: 'SB Void mono', skipBg: true, seed: 91 } },
  // Rect frames — each frame is two L brushes (thick at top-left and bottom-right, sharp at the other corners)
  { name: 'Rect corridor', p: Object.assign(brushOf('marker'), { skeleton: 'rect', aspect: .78, shapeRot: 0, rectMode: 'L', rectTaper: 1.1, rectTip: .03, rectOver: .3, rectHook: .5, rectGap: 0, rectJitter: .02, width: .15, bias: -.5, pressure: 0, rough: 0, wobble: 0, ambient: 1,
      count: 10, depthMode: 'geometric', geoRatio: .72, geoNear: 150, spacing: 400, length: 0, radius: 300, twist: 0, camZ: 700, fov: 50, vpX: 0, vpY: -.04, nearClip: 60,
      steps: 0, fog: .15, fogFar: 6000, fly: .7, palette: 'SB Lilac mono', skipBg: true, introSpin: .1, introStagger: .5, seed: 101 }) },
  { name: 'Rect twist', p: Object.assign(brushOf('marker'), { skeleton: 'rect', aspect: .85, shapeRot: 0, rectMode: 'L', rectTaper: 1.1, rectTip: .03, rectOver: .3, rectHook: .5, rectGap: 0, rectJitter: .015, width: .15, bias: -.5, pressure: 0, rough: 0, wobble: 0, ambient: 1,
      count: 10, depthMode: 'geometric', geoRatio: .72, geoNear: 150, spacing: 400, length: 0, radius: 320, twist: -9, camZ: 700, fov: 50, vpX: -.02, vpY: -.04, nearClip: 60,
      steps: 0, fog: .15, fogFar: 6000, fly: .7, palette: 'SB Lilac mono', skipBg: true, introSpin: .3, introStagger: .5, seed: 102 }) },
  { name: 'Ink portal', p: { bristles: 10, dry: .15, streak: .25, rough: .25, paintOn: .2 } },
  { name: 'Arch chisel', p: Object.assign(brushOf('chisel'), { skeleton: 'ring', shape: 'arch', archH: 1.3, soften: .3, aspect: 1, coverage: .66, covJitter: .12, startDrift: 0, startJitter: .08, width: .1, count: 14, spacing: 320, length: 220, radius: 260, twist: 0, steps: 3, fog: .85, fogFar: 4200, lookY: 60, fly: .9, palette: 'SB Void', skipBg: true, seed: 11 }) },
  { name: 'Eye hook', p: Object.assign(brushOf('hook'), { skeleton: 'ring', shape: 'squircle', roundness: 2, aspect: .78, coverage: .84, covJitter: .04, startDrift: .5, startJitter: .04, width: .1, count: 12, spacing: 330, length: 110, radius: 250, twist: 3, wallShade: .88, gradType: 9, stripes: 2, stripeTwist: 2, animType: 1, gradSpeed: .5, steps: 2, fog: .55, fly: 1, palette: 'SB Lilac', seed: 22 }) },
  { name: 'Hook spiral', p: Object.assign(brushOf('hook'), { skeleton: 'spiral', spiralTurns: 1.25, spiralTighten: .5, aspect: .92, coverage: 1, covJitter: 0, startJitter: 0, width: .1, flareIn: 0, count: 12, spacing: 300, length: 110, radius: 260, twist: 30, wallShade: .88, steps: 2, fog: .55, fly: 1.1, palette: 'SB Lilac', seed: 33 }) },
  { name: 'Frame taper', p: Object.assign(brushOf('taper'), { skeleton: 'ring', shape: 'squircle', roundness: 10, aspect: .8, coverage: .97, covJitter: .02, startDrift: .12, startJitter: .03, width: .08, taperIn: .04, taperOut: .55, swell: 0, rough: 0, count: 16, spacing: 280, length: 160, radius: 240, twist: 10, steps: 4, fog: .7, fogFar: 4500, fly: 1.2, palette: 'SB Nightglass', skipBg: true, seed: 44 }) },
  { name: 'Dry vortex', p: Object.assign(brushOf('bristle'), { skeleton: 'ring', shape: 'squircle', roundness: 2, aspect: 1, strokes: 3, gap: .14, coverage: 1, covJitter: 0, startDrift: .07, startJitter: .1, wobble: .02, width: .22, count: 16, spacing: 260, length: 0, radius: 250, twist: 14, steps: 0, gradType: 0, angle: 0, fog: .8, fogFar: 4200, paintOn: .35, fly: 1.3, palette: 'SB Void', skipBg: true, seed: 55 }) },
  { name: 'Sumi gate', p: Object.assign(brushOf('sumi'), { skeleton: 'ring', shape: 'polygon', sides: 6, soften: .55, aspect: 1, strokes: 2, gap: .12, coverage: .95, startDrift: .09, startJitter: .2, wobble: .025, width: .3, count: 14, spacing: 300, length: 0, radius: 250, twist: 8, steps: 0, gradType: 1, fog: .75, fogFar: 4500, paintOn: .25, fly: 1, palette: 'SB Arcana', skipBg: true, seed: 66 }) },
  { name: 'Nib rune', p: Object.assign(brushOf('nib'), { skeleton: 'ring', shape: 'star', petals: 6, petalAmp: .15, aspect: 1, coverage: .9, startDrift: .33, startJitter: .05, width: .2, count: 16, spacing: 280, length: 90, radius: 250, twist: 6, gradType: 4, animType: 2, gradSpeed: .6, steps: 3, fog: .8, fogFar: 4200, fly: 1.2, palette: 'SB Arcana', skipBg: true, seed: 77 }) },
  { name: 'Linear corridor', p: { layout: 'corridor', axisYaw: 28, axisPitch: -10, camZ: 1800, count: 22, spacing: 240, length: 480, radius: 280, fly: 1.3, fog: .55, fogNear: 1500, fogFar: 7000, seed: 61 } },
  { name: 'Linear row', p: { layout: 'row', rowAngle: -18, rowDepth: -1500, camZ: 1300, count: 16, spacing: 430, length: 300, radius: 190, fly: .7, fog: .75, fogFar: 3600, palette: 'SB Void', seed: 62 } },
  { name: 'Helix brush', p: Object.assign(brushOf('bristle'), { layout: 'helix', pathAmp: 100, pathFreq: .35, pathSpeed: .2, camZ: 1100, skeleton: 'ring', shape: 'polygon', sides: 5, soften: .5, aspect: 1, coverage: .9, startDrift: .2, width: .2, count: 24, spacing: 200, length: 0, radius: 240, twist: 10, gradType: 4, animType: 2, gradSpeed: .8, steps: 0, fly: 1.8, fog: .75, fogFar: 4200, palette: 'SB Nightglass', skipBg: true, seed: 63 }) },
  { name: 'Wave ribbon', p: Object.assign(brushOf('nib'), { layout: 'wave', axisYaw: 30, axisPitch: -8, pathAmp: 280, pathFreq: .35, pathSpeed: .25, pathRound: 0, camZ: 2200, skeleton: 'ring', shape: 'squircle', roundness: 2, aspect: 1, coverage: .8, startDrift: .1, width: .24, count: 22, spacing: 230, length: 140, radius: 200, steps: 4, fly: 1.4, fog: .6, fogNear: 1200, fogFar: 6500, palette: 'SB Arcana', skipBg: true, seed: 64 }) },
];
// Presets hidden from the chip bar for now (definitions kept). Remove a name to bring it back.
const HIDDEN_PRESETS = ['Wave ribbon', 'Helix brush', 'Nib rune', 'Frame taper', 'Hook spiral', 'Ink portal', 'Eye hook', 'Arch chisel'];
const PRESETS = PRESETS_ALL.filter(p => !HIDDEN_LAYOUTS.includes(p.p.layout) && !HIDDEN_PRESETS.includes(p.name));

let PARAMS = Object.assign({}, BASE, (PRESETS[0] || { p: {} }).p);
let palette, motif, cnv;
let fmt = '4:5';
let playing = true, clock = 0, needGeo = true, needMotif = true, wantPNG = false;

function presetParams(p) { return Object.assign({}, BASE, p); }

// ---------------------------------------------------------------- setup / draw
function setup() {
  const [w, h] = FORMATS[fmt];
  createCanvas(w, h, WEBGL);
  // same attributes as the reference; one call so the context is rebuilt once
  setAttributes({ antialias: true, depth: false, alpha: true, preserveDrawingBuffer: true });
  // setAttributes swaps in a new <canvas>; move that one into the stage
  cnv = { elt: drawingContext.canvas };
  document.getElementById('stage').appendChild(cnv.elt);
  pixelDensity(2); // 4:5 frame exports at 1600×2000, same as the brand assets
  frameRate(30);
  noStroke();
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) playing = false;
  GUI.build();
  fitStage();
  if (PARAMS.introOn) PARAMS.introStart = 0;
}

function rebuild() {
  if (needMotif) {
    palette = getColorScheme(PARAMS.palette);
    randomSeed(PARAMS.seed);
    PARAMS.bgHex = palette.colors[0];
    PARAMS.wallColors = (PARAMS.skipBg && palette.colors.length > 1) ? palette.colors.slice(1) : palette.colors.slice();
    if (motif) motif.elements.forEach(el => el.geo && typeof freeGeometry === 'function' && freeGeometry(el.geo));
    motif = new Motif(PARAMS);
    needMotif = false; needGeo = true;
  }
  if (needGeo) { motif.buildGeo(PARAMS); needGeo = false; }
  const c = color(PARAMS.bgHex);
  PARAMS.fogRGB = [red(c) / 255, green(c) / 255, blue(c) / 255];
}

function draw() {
  if (playing) clock += Math.min(deltaTime, 100) / 1000;
  window.sbTime = clock;
  rebuild();
  background(PARAMS.bgHex);
  // Lens shift: the vanishing point moves (vpX / vpY, in frame widths/heights from the centre: ±0.5 = the frame edge)
  // while the camera keeps looking straight down the tunnel, so every layer stays square-on and keeps its true angles.
  {
    const near = 1, top = near * Math.tan(PARAMS.fov * PI / 360), right = top * width / height;
    const sx = 2 * PARAMS.vpX, sy = -2 * PARAMS.vpY;   // WebGL y points up; vpY > 0 moves the vanishing point down
    frustum(-right * (1 + sx), right * (1 - sx), -top * (1 + sy), top * (1 - sy), near, 30000);
  }
  camera(0, 0, PARAMS.camZ, PARAMS.lookX, PARAMS.lookY, PARAMS.camZ - 1000, 0, 1, 0);
  motif.run(PARAMS, clock);
  if (wantPNG) { wantPNG = false; cnv.elt.toBlob(b => b && GUI.showPNG(b), 'image/png'); }
}

// ---------------------------------------------------------------- stage sizing
function fitStage() {
  const st = document.getElementById('stage');
  if (!st || !cnv) return;
  const b = st.getBoundingClientRect();
  const s = Math.min(b.width / width, b.height / height);
  cnv.elt.style.width = Math.floor(width * s) + 'px';
  cnv.elt.style.height = Math.floor(height * s) + 'px';
}
function windowResized() { fitStage(); }
function setFormat(f) {
  fmt = f; const [w, h] = FORMATS[f];
  resizeCanvas(w, h); fitStage();
}

// ---------------------------------------------------------------- variants
// Rules that change stroke geometry (texture rules only touch the shader)
const SKELETON_KEYS = ['skeleton', 'shape', 'sides', 'soften', 'roundness', 'archH', 'petals', 'petalAmp', 'aspect', 'shapeRot',
  'spiralTurns', 'spiralTighten', 'strokes', 'gap', 'coverage', 'covJitter', 'startDrift', 'startJitter', 'wobble'];
const BRUSH_KEYS = ['brush', 'width', 'taperIn', 'taperOut', 'swell', 'flareIn', 'flareOut', 'stepAmp', 'stepPos', 'stepLen', 'stepJitter', 'stepSide',
  'pressure', 'nibAmt', 'nibAngle', 'bias', 'bristles', 'dry', 'rough', 'streak', 'tipMode', 'stampPlace', 'stampPivot', 'stampSize',
  'rectMode', 'rectTaper', 'rectTip', 'rectOver', 'rectHook', 'rectGap', 'rectJitter', 'tipSource', 'widthProfile',
  'scatterSpacing', 'scatterSize', 'scatterSizeJit', 'scatterRotJit', 'scatterOffset', 'scatterAlign', 'scatterByWidth'];
const GEO_KEYS = SKELETON_KEYS.concat(BRUSH_KEYS, ['length', 'seed', 'link', 'tailGap', 'chainDir', 'spacing', 'twist', 'count', 'layout', 'depthMode']);
const MOTIF_KEYS = ['count', 'palette', 'skipBg', 'seed'];

function setParam(k, v) {
  PARAMS[k] = v;
  if (k === 'layout' && LAYOUT_DEFAULTS[v]) Object.assign(PARAMS, LAYOUT_DEFAULTS[v]);
  if (k === 'brush' && BR.LIBRARY[v]) Object.assign(PARAMS, brushOf(v));
  if (k === 'widthProfile' && WIDTH_PROFILES[v]) Object.assign(PARAMS, WIDTH_PROFILES[v].p);
  if (['taperIn', 'taperOut', 'swell'].includes(k)) PARAMS.widthProfile = 'custom';
  if (k === 'tipSource' && v !== 'upload') { PARAMS.brush = 'custom'; BR.setBuiltinTip(v); }
  if (GEO_KEYS.includes(k)) needGeo = true;
  if (MOTIF_KEYS.includes(k)) needMotif = true;
}
// "Lock skeleton + brush" keeps these when switching presets or summoning
const SHAPE_KEYS = SKELETON_KEYS.concat(BRUSH_KEYS);
function applyPreset(p, keepShape) {
  const keep = {};
  if (keepShape) SHAPE_KEYS.forEach(k => keep[k] = PARAMS[k]);
  const intro = { introOn: PARAMS.introOn };
  PARAMS = Object.assign(presetParams(p), keep, intro);
  needGeo = needMotif = true;
  snapshotDefaults();
  if (PARAMS.introOn) openPortal();
}
// values the sliders reset to (double-click): the preset as it was loaded, plus any edition theme
let DEFAULTS_NOW = Object.assign({}, PARAMS);
function snapshotDefaults() { DEFAULTS_NOW = Object.assign({}, PARAMS); }
function applyTheme(id) {
  const th = THEMES.find(t => t.id === id); if (!th) return;
  Object.assign(PARAMS, th.p, { theme: id });
  needGeo = needMotif = true; snapshotDefaults();
  if (PARAMS.introOn) openPortal();
}
// play the portal opening from the current moment
function openPortal() { PARAMS.introStart = clock; if (!playing && typeof redraw === 'function') { playing = true; GUI.sync(); } }

// Summon: random look inside the rule ranges. Lock toggles keep component / palette.
function summon(lockShape, lockColor) {
  const r = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const n = { seed: Math.floor(r(1, 99999)) };
  if (!lockShape) {
    n.skeleton = pick(['ring', 'ring', 'ring', 'spiral'].concat(BR.hasSpine() ? ['path'] : []));
    n.shape = pick(['polygon', 'squircle', 'squircle', 'arch', 'star']);
    n.sides = Math.round(r(3, 8)); n.soften = pick([0, r(.2, .7)]); n.roundness = pick([2, r(3, 6), r(8, 14)]);
    n.archH = r(.9, 1.5); n.petals = Math.round(r(3, 8)); n.petalAmp = r(.08, .22); n.aspect = r(.75, 1.05);
    n.shapeRot = n.shape === 'polygon' && n.sides === 4 ? pick([0, 45]) : 0;
    n.spiralTurns = r(.8, 2); n.spiralTighten = r(.3, .7);
    n.strokes = pick([1, 1, 1, 2, 3]); n.gap = r(.05, .2);
    n.coverage = n.skeleton === 'spiral' ? 1 : pick([1, r(.7, .95), r(.6, .9)]); n.covJitter = pick([0, r(.03, .15)]);
    n.link = pick(['separate', 'separate', 'chain']); n.tailGap = pick([0, 0, r(.02, .12)]);
    n.startDrift = pick([0, .12, .25, .5, r(-.3, .3)]); n.startJitter = r(0, .2); n.wobble = pick([0, 0, r(.005, .03)]);
    const id = pick(Object.keys(BR.LIBRARY).filter(k => k !== 'custom' || BR.hasTip()));
    Object.assign(n, brushOf(id));
    n.width = BR.LIBRARY[id].width * r(.75, 1.35);
  }
  n.count = Math.round(r(10, 18)); n.spacing = r(240, 380); n.length = pick([0, 0, r(60, 220)]); n.radius = r(210, 270);
  n.paintOn = pick([0, 0, r(.2, .45)]);
  n.twist = pick([0, 0, r(-14, 14)]); n.spin = pick([0, 0, r(-.03, .03)]);
  n.layout = pick(['tunnel', 'tunnel', 'corridor', 'row', 'helix', 'wave'].filter(l => !HIDDEN_LAYOUTS.includes(l)));
  Object.assign(n, LAYOUT_DEFAULTS[n.layout]);
  if (n.layout === 'tunnel') { n.curveX = pick([0, 0, r(-.3, .3)]); n.curveY = pick([0, 0, r(-.3, .4)]); }
  if (n.layout === 'corridor' || n.layout === 'wave') { n.axisYaw = r(20, 45) * pick([-1, 1]); n.axisPitch = r(-18, 10); }
  if (n.layout === 'row') { n.rowAngle = r(-30, 30); n.length = r(900, 1600); }
  if (n.layout === 'helix' || n.layout === 'wave') { n.pathAmp = n.layout === 'helix' ? r(60, 140) : r(160, 320); n.pathFreq = r(.25, .7); n.pathSpeed = r(.1, .35); n.spacing = r(180, 280); n.count = Math.round(r(18, 26)); n.length = n.spacing * r(1.6, 2.2); }
  n.fly = pick([r(.6, 1.6), r(.8, 2), r(.6, 1.6)]); n.breathe = n.fly ? pick([0, r(0, .4)]) : r(.5, 1); n.breatheLength = r(.2, 1);
  n.gradType = pick([0, 0, 1, 4, 6, 9, 10]); n.animType = pick([1, 2, 5, 5, 6]); n.gradSpeed = r(.4, 1.5);
  n.angle = pick([90, 0, r(0, 180)]); n.stripes = Math.round(r(2, 9)); n.stripeTwist = r(0, 6);
  n.steps = pick([0, 0, 2, 3, 4, 5]); n.fog = r(.4, .9); n.fogFar = n.count * n.spacing * r(.7, 1);
  const keep = {}; SHAPE_KEYS.forEach(k => keep[k] = PARAMS[k]);
  const keepCol = { palette: PARAMS.palette, skipBg: PARAMS.skipBg };
  const introKeep = { introOn: PARAMS.introOn, introDur: PARAMS.introDur, introFade: PARAMS.introFade, introSpin: PARAMS.introSpin, introStagger: PARAMS.introStagger, introScale: PARAMS.introScale, introBounce: PARAMS.introBounce, introAlternate: PARAMS.introAlternate };
  PARAMS = Object.assign({}, BASE, n, lockShape ? keep : {}, introKeep);
  if (lockColor) Object.assign(PARAMS, keepCol);
  else { PARAMS.palette = pick(colorScheme.slice(0, 5).map(s => s.name).concat(colorScheme.map(s => s.name))); PARAMS.skipBg = Math.random() < .5; }
  needGeo = needMotif = true;
  if (PARAMS.introOn) openPortal();
}

function exportRules() {
  const o = Object.assign({}, PARAMS);
  ['fogRGB', 'bgHex', 'wallColors', 'introStart'].forEach(k => delete o[k]);
  return JSON.stringify(o, null, 1);
}

function keyPressed(e) {
  if (e && e.target && e.target.matches && e.target.matches('input,textarea,select')) return;
  if (key === ' ') { playing = !playing; GUI.sync(); return false; }
  if (key === 'o' || key === 'O') openPortal();
  if (key === 'h' || key === 'H') document.body.classList.toggle('hide-panel'), fitStage();
}
