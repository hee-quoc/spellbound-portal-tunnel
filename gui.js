// =============================================================
// gui.js — control panel generated from a control list.
// Every control writes straight into PARAMS through setParam().
// =============================================================
const GUI = (() => {
  const GRAD = ['Linear', 'Radial', 'Stripe', 'Checker', 'Conic', 'Diamond', 'Spiral', 'Star', 'Kaleidoscope', 'Vortex (new)', 'Depth rings (new)'];
  const ANIM = ['None', 'Move', 'Rotate', 'Wave', 'Pulse', 'Wave pattern', 'Noise'];
  const isRing = p => p.skeleton === 'ring';
  const isRect = p => p.skeleton === 'rect';
  const notRect = p => p.skeleton !== 'rect';
  const isStamp = p => p.brush === 'custom' && p.tipMode === 'stamp';
  const notStamp = p => !isStamp(p);
  const isScatter = p => p.brush === 'custom' && p.tipMode === 'scatter';
  const notCustom = p => p.brush !== 'custom';
  const isChain = p => BR.isChained(p);
  const notChain = p => !isChain(p);

  const GROUPS = [
    { t: 'Skeleton', s: 'khung xương · the path', open: true, c: [
      { type: 'preview', which: 'spine' },
      { k: 'skeleton', type: 'select', label: 'Spine', opts: [['ring', 'Ring · follows a base shape'], ['rect', 'Rectangle · corner-to-corner brushes'], ['spiral', 'Spiral · open coil'], ['path', 'SVG path · your own line']] },
      { k: 'rectMode', type: 'select', label: 'How the sides join', opts: [['L', 'Two L brushes · thick top-left & bottom-right'], ['pinwheel', 'Pinwheel · each side thick at its start'], ['pinwheel-rev', 'Pinwheel reversed'], ['corners', 'Thick at every corner'], ['uniform', 'Even width']], show: isRect },
      { k: 'rectTaper', label: 'Taper to the sharp end', min: .2, max: 4, step: .01, show: isRect },
      { k: 'rectTip', label: 'Sharp end width', min: 0, max: 1, step: .005, show: isRect },
      { k: 'rectOver', label: 'Overshoot past the corner', min: 0, max: 3, step: .01, show: isRect },
      { k: 'rectHook', label: 'Corner hook', min: 0, max: 2, step: .01, show: isRect },
      { k: 'rectGap', label: 'Gap at the sharp end', min: 0, max: .6, step: .005, show: isRect },
      { k: 'rectJitter', label: 'Hand-drawn skew', min: 0, max: .2, step: .001, show: isRect },
      { type: 'upload', which: 'spine', show: p => p.skeleton === 'path' },
      { k: 'shape', type: 'select', label: 'Base shape of the ring', opts: [['squircle', 'Circle / squircle'], ['polygon', 'Polygon']], show: isRing },
      { k: 'roundness', label: 'Squareness', min: 2, max: 14, step: .1, show: p => isRing(p) && p.shape === 'squircle' },
      { k: 'sides', label: 'Sides', min: 3, max: 10, step: 1, show: p => isRing(p) && p.shape === 'polygon' },
      { k: 'soften', label: 'Corner soften', min: 0, max: 1, step: .01, show: p => isRing(p) && p.shape === 'polygon' },
      { k: 'spiralTurns', label: 'Spiral turns', min: .3, max: 4, step: .01, show: p => p.skeleton === 'spiral' },
      { k: 'spiralTighten', label: 'Spiral tighten', min: 0, max: .95, step: .01, show: p => p.skeleton === 'spiral' },
      { k: 'aspect', label: 'Aspect (width)', min: .4, max: 1.6, step: .01 },
      { k: 'shapeRot', label: 'Rotate', min: -180, max: 180, step: 1, show: p => p.skeleton !== 'spiral' && !(isRing(p) && p.shape === 'squircle' && p.roundness <= 2.2) },   // a circle looks the same turned: no slider
      { k: 'link', type: 'select', label: 'Layers', opts: [['separate', 'Separate rings (no touch)'], ['chain', 'Chained · tail meets head (vortex)']], show: p => p.skeleton === 'ring' && p.layout === 'tunnel' },
      { k: 'tailGap', label: 'Tail gap (− overlap · + gap)', min: -.15, max: .4, step: .005, show: isChain },
      { k: 'chainDir', type: 'select', num: true, label: 'Vortex direction', opts: [[1, 'Clockwise'], [-1, 'Counter-clockwise']], show: isChain },
      { k: 'strokes', label: 'Strokes per layer', min: 1, max: 8, step: 1, show: p => notChain(p) && notRect(p) },
      { k: 'gap', label: 'Gap between strokes', min: 0, max: .6, step: .005, show: p => notChain(p) && notRect(p) },
      { k: 'coverage', label: 'Coverage', min: .05, max: 1.5, step: .005, show: notRect },
      { k: 'covJitter', label: 'Coverage scatter', min: 0, max: .6, step: .01, show: p => notChain(p) && notRect(p) },
      { k: 'startDrift', label: 'Start drift per layer', min: -.5, max: .5, step: .005, show: p => notChain(p) && notRect(p) },
      { k: 'startJitter', label: 'Start scatter', min: 0, max: 1, step: .01, show: p => notChain(p) && notRect(p) },
      { k: 'wobble', label: 'Hand wobble', min: 0, max: .08, step: .001 },
    ] },
    { t: 'Brush', s: 'how paint is laid', open: true, c: [
      { type: 'brushes' },   // pick a brush by its stroke (the uploaded SVG shows up here as its own tile)
      { type: 'preview', which: 'brush', show: p => DEV || p.brush === 'custom' },
      { k: 'brush', type: 'select', label: 'Brush', opts: () => Object.entries(BR.LIBRARY).map(([k, v]) => [k, v.name]) },
      // public width profiles: one sharp end at most
      { k: 'widthProfile', type: 'select', label: 'Width profile (like Illustrator)', opts: () => DEV ? [['custom', 'Custom (sliders)']].concat(Object.entries(WIDTH_PROFILES).map(([k, v]) => [k, v.name])) : [['custom', 'Style default'], ['uniform', 'Even · no sharp end'], ['wp2', 'Sharp at the end'], ['wp3', 'Sharp at the start']], show: p => notStamp(p) && notRect(p) },
      { k: 'tipSource', type: 'select', label: 'Tip artwork', opts: () => [['upload', 'Upload your own SVG']].concat(Object.entries(BR.TIPS).map(([k, v]) => [k, 'Built-in · ' + v])), show: p => p.brush === 'custom' },
      { type: 'upload', which: 'tip', show: p => !DEV || (p.brush === 'custom' && p.tipSource === 'upload') },   // everyone: upload a pattern tile
      { k: 'tipMode', type: 'select', label: 'Use the uploaded tip as', opts: [['stamp', 'Stamp · keep the exact shape'], ['art', 'Art brush · bend it along the skeleton'], ['scatter', 'Scatter brush · copies along the strokes'], ['pattern', 'Pattern brush · tile repeats along each side, corners cut to fit']], show: p => p.brush === 'custom' },
      { k: 'patternScale', label: 'Scale', min: .25, max: 4, step: .01, show: p => p.brush === 'custom' && p.tipMode === 'pattern' },
      { k: 'patternFit', type: 'select', label: 'Fit', opts: [['stretch', 'Stretch to fit'], ['space', 'Add space to fit'], ['approx', 'Approximate path']], show: p => p.brush === 'custom' && p.tipMode === 'pattern' },
      { k: 'patternSpacing', label: 'Spacing', min: -.9, max: 2, step: .01, show: p => p.brush === 'custom' && p.tipMode === 'pattern' },
      { k: 'patternOuter', type: 'select', label: 'Outer corner', opts: [['centered', 'Auto-Centered'], ['between', 'Auto-Between'], ['sliced', 'Auto-Sliced'], ['overlap', 'Auto-Overlap'], ['custom', 'Custom SVG']], show: p => p.brush === 'custom' && p.tipMode === 'pattern' },
      { type: 'ptiles', slots: ['outer'], show: p => p.brush === 'custom' && p.tipMode === 'pattern' && p.patternOuter === 'custom' },
      { k: 'patternInner', type: 'select', label: 'Inner corner', opts: [['centered', 'Auto-Centered'], ['between', 'Auto-Between'], ['sliced', 'Auto-Sliced'], ['overlap', 'Auto-Overlap'], ['custom', 'Custom SVG']], show: p => p.brush === 'custom' && p.tipMode === 'pattern' },
      { type: 'ptiles', slots: ['inner'], show: p => p.brush === 'custom' && p.tipMode === 'pattern' && p.patternInner === 'custom' },
      { type: 'ptiles', slots: ['start', 'end'], caps: true, show: p => p.brush === 'custom' && p.tipMode === 'pattern' },
      { k: 'stampPlace', type: 'select', label: 'Stamp placement', opts: [['centre', 'Centred on the portal (concentric)'], ['along', 'Along the skeleton']], show: isStamp },
      { k: 'stampPivot', type: 'select', label: 'Turn around', opts: [['auto', 'The curve’s own centre (auto)'], ['centre', 'The middle of the artwork'], ['bottom', 'The bottom edge (chevrons, arches)']], show: p => isStamp(p) && p.stampPlace !== 'along' },
      { k: 'stampSize', label: 'Stamp size', min: .1, max: 2.5, step: .01, show: isStamp },
      { k: 'scatterSpacing', label: 'Scatter spacing', min: .01, max: 1, step: .001, show: isScatter },
      { k: 'scatterSize', label: 'Scatter size', min: .01, max: .8, step: .001, show: isScatter },
      { k: 'scatterSizeJit', label: 'Size · random', min: 0, max: 1, step: .01, show: isScatter },
      { k: 'scatterRotJit', label: 'Rotation · random', min: 0, max: 1, step: .01, show: isScatter },
      { k: 'scatterOffset', label: 'Scatter · random offset', min: 0, max: .4, step: .001, show: isScatter },
      { k: 'scatterAlign', type: 'toggle', label: 'Rotate copies to follow the path', show: isScatter },
      { k: 'scatterByWidth', type: 'toggle', label: 'Size follows the brush width (taper)', show: isScatter },
      { k: 'width', label: 'Width', min: .01, max: .6, step: .001, show: notStamp },
      { k: 'halftone', label: 'Halftone', min: 0, max: 6, step: .01, show: notCustom },   // uploaded tips keep their own artwork
      { k: 'halftoneDot', label: 'Dot size', min: .004, max: .06, step: .001, show: p => notCustom(p) && p.halftone > 0 },
      { k: 'halftoneAngle', label: 'Screen angle', min: 0, max: 90, step: 1, show: p => notCustom(p) && p.halftone > 0 },
      { k: 'taperIn', label: 'Taper in', min: 0, max: 1, step: .01, show: p => notStamp(p) && notRect(p) },
      { k: 'taperOut', label: 'Taper out', min: 0, max: 1, step: .01, show: p => notStamp(p) && notRect(p) },
      { k: 'swell', label: 'Swell (belly)', min: -1, max: 1, step: .01, show: p => notStamp(p) && notRect(p) },
      { k: 'pressure', label: 'Pressure jitter', min: 0, max: 1, step: .01, show: notStamp },
      { k: 'flareIn', label: 'Hook at start', min: 0, max: 3, step: .01, show: p => notCustom(p) && notRect(p) },
      { k: 'flareOut', label: 'Hook at end', min: 0, max: 3, step: .01, show: p => notCustom(p) && notRect(p) },
      { k: 'stepAmp', label: 'Chisel step', min: 0, max: 3, step: .01, show: p => notCustom(p) && notRect(p) },
      { k: 'stepPos', label: 'Step position', min: 0, max: 1, step: .01, show: p => p.stepAmp > 0 },
      { k: 'stepLen', label: 'Step length', min: .02, max: .8, step: .01, show: p => p.stepAmp > 0 },
      { k: 'stepJitter', label: 'Step scatter', min: 0, max: 1, step: .01, show: p => p.stepAmp > 0 },
      { k: 'stepSide', type: 'select', num: true, label: 'Step on', opts: [[1, 'Outer edge'], [-1, 'Inner edge']], show: p => p.stepAmp > 0 && p.brush !== 'custom' },
      { k: 'nibAmt', label: 'Calligraphy nib', min: 0, max: 1, step: .01, show: notStamp },
      { k: 'nibAngle', label: 'Nib angle (°)', min: -90, max: 90, step: 1, show: p => p.nibAmt > 0 },
      { k: 'bias', label: 'Grow inward ← → outward', min: -1, max: 1, step: .01, show: notCustom },
    ] },
    { t: 'Portal opening', s: 'fade in · whirl', open: true, c: [
      { type: 'button', id: 'bOpen', label: 'Open portal (O)' },
      { k: 'introOn', type: 'toggle', label: 'Play when switching preset or edition' },
      { k: 'introDur', label: 'Duration', min: .2, max: 4, step: .01 },
      { k: 'introFade', label: 'Fade-in (s)', min: .02, max: 1.5, step: .01 },
      { k: 'introSpin', label: 'Whirl', min: -3, max: 3, step: .01 },
      { k: 'introStagger', label: 'Ring stagger', min: 0, max: .95, step: .01 },
      { k: 'introDepth', label: 'Rush out of the depth (layers)', min: 0, max: 12, step: .1 },
      { k: 'introScale', label: 'Start size (1 = no zoom)', min: 0, max: 1, step: .01 },
      { k: 'introBounce', label: 'Bounce (overshoot)', min: 0, max: 3, step: .01 },
      { k: 'introAlternate', type: 'toggle', label: 'Alternate whirl direction per ring' },
    ] },
    ...(Banner.ENABLED ? [{ t: 'Banner', s: 'text · logo', open: true, c: [
      { k: 'bannerMode', type: 'select', label: 'Banner motion', opts: [['off', 'Off · portal only'], ['drop', 'Drop · tunnel slides down, panel drops, lines rise'], ['pop', 'Pop · text pops in on a plate'], ['rise', 'Rise · lines slide up, no panel']] },
      { k: 'bannerText', type: 'text', label: 'Text (one line per row)', show: p => p.bannerMode !== 'off' },
      { k: 'bannerSize', label: 'Text size', min: .04, max: .35, step: .005, show: p => p.bannerMode !== 'off' },
      { k: 'bannerPos', type: 'select', label: 'Text position', opts: [['top', 'Top'], ['center', 'Centre'], ['bottom', 'Bottom']], show: p => p.bannerMode === 'pop' || p.bannerMode === 'rise' },
      { k: 'bannerPlate', type: 'toggle', label: 'Solid plate behind the text', show: p => p.bannerMode === 'pop' },
      { k: 'bannerPanel', label: 'Panel height', min: .2, max: .85, step: .01, show: p => p.bannerMode === 'drop' },
      { k: 'bannerShift', label: 'Slide down', min: 0, max: .6, step: .01, show: p => p.bannerMode === 'drop' },
      { k: 'bannerDelay', label: 'Delay', min: 0, max: 3, step: .05, show: p => p.bannerMode !== 'off' },
      { type: 'logo', show: p => p.bannerMode !== 'off' },
      { k: 'bannerLogoSize', label: 'Logo size', min: .08, max: .7, step: .01, show: p => p.bannerMode !== 'off' && Banner.hasLogo() },
      { k: 'bannerLogoTint', type: 'toggle', label: 'Paint the logo in the type colour', show: p => p.bannerMode !== 'off' && Banner.hasLogo() },
    ] }] : []),   // banner motion is switched off for now (Banner.ENABLED in banner.js)
    { t: 'Brush texture', s: 'bristles · dry · paint-on', open: true, c: [
      { k: 'bristles', label: 'Bristles (0 = solid)', min: 0, max: 60, step: 1 },
      { k: 'dry', label: 'Dry brush', min: 0, max: 1, step: .01, show: p => p.bristles > 0 },
      { k: 'streak', label: 'Bristle streaks', min: 0, max: 1, step: .01, show: p => p.bristles > 0 },
      { k: 'rough', label: 'Rough edges', min: 0, max: 1, step: .01 },
      { k: 'paintOn', label: 'Paint-on as strokes arrive', min: 0, max: 1, step: .01 },
    ] },
    { t: 'Layout', s: 'pull · vortex · wave', open: true, c: [
      { k: 'layout', type: 'select', label: 'Arrangement', opts: () => [['tunnel', 'Tunnel · pull-in'], ['corridor', 'Linear corridor · tilted'], ['row', 'Linear row · sideways'], ['helix', 'Helix vortex'], ['wave', 'Wave line']].filter(o => !HIDDEN_LAYOUTS.includes(o[0])) },
      { k: 'axisYaw', label: 'Axis turn (°)', min: -80, max: 80, step: 1 },
      { k: 'axisPitch', label: 'Axis tilt (°)', min: -60, max: 60, step: 1 },
      { k: 'rowAngle', label: 'Row angle (°)', min: -90, max: 90, step: 1, show: p => p.layout === 'row' },
      { k: 'rowDepth', label: 'Row distance', min: -4000, max: 400, step: 10, show: p => p.layout === 'row' },
      { k: 'pathAmp', label: 'Path radius', min: 0, max: 700, step: 1, show: p => p.layout === 'helix' || p.layout === 'wave' },
      { k: 'pathFreq', label: 'Coils / waves per 1000', min: 0, max: 2, step: .01, show: p => p.layout === 'helix' || p.layout === 'wave' },
      { k: 'pathSpeed', label: 'Path travel (cycles/s)', min: -1, max: 1, step: .01, show: p => p.layout === 'helix' || p.layout === 'wave' },
      { k: 'pathRound', label: 'Flat ↔ round wave', min: 0, max: 1, step: .01, show: p => p.layout === 'wave' },
    ] },
    { t: 'Tunnel', s: 'depth & camera', open: true, c: [
      { k: 'count', label: 'Layers', min: 3, max: 30, step: 1 },
      { k: 'depthMode', type: 'select', label: 'Depth spacing', opts: [['even', 'Even · true 3D perspective'], ['geometric', 'Geometric · each layer shrinks by the same ratio']] },
      { k: 'spacing', label: 'Spacing', min: 120, max: 900, step: 1, show: p => p.depthMode !== 'geometric' },
      { k: 'geoRatio', label: 'Size ratio', min: .3, max: .95, step: .005, show: p => p.depthMode === 'geometric' },
      { k: 'geoNear', label: 'Front layer distance', min: 60, max: 1500, step: 1, show: p => p.depthMode === 'geometric' },
      { k: 'length', label: 'Extrude depth (0 = flat strokes)', min: 0, max: 1600, step: 1 },
      { k: 'radius', label: 'Radius', min: 60, max: 600, step: 1 },
      { k: 'curveX', label: 'Bend X', min: -.8, max: .8, step: .01 },
      { k: 'curveY', label: 'Bend Y', min: -.8, max: .8, step: .01 },
      { k: 'camZ', label: 'Camera Z', min: -1500, max: 4000, step: 1 },
      { k: 'fov', label: 'Lens (FOV °)', min: 20, max: 110, step: 1 },
      { k: 'vpX', label: 'Vanish X', min: -1, max: 1, step: .005 },
      { k: 'vpY', label: 'Vanish Y', min: -1, max: 1, step: .005 },
      { k: 'lookX', label: 'Look X (tilts the camera)', min: -500, max: 500, step: 1 },
      { k: 'lookY', label: 'Look Y (tilts the camera)', min: -500, max: 500, step: 1 },
      { k: 'nearClip', label: 'Hide layers closer than', min: 0, max: 1200, step: 10 },
      { k: 'farFade', label: 'Fade in at the back (loop seam)', min: 0, max: .6, step: .01 },
      { k: 'nearFade', label: 'Fade out at the front (loop seam)', min: 0, max: .4, step: .01 },
      { k: 'wallShade', label: 'Extrude shade', min: 0, max: 1.2, step: .01 },
    ] },
    { t: 'Motion', s: 'pull & breathe', open: true, c: [
      { k: 'fly', label: 'Speed', min: -3, max: 3, step: .01 },
      { k: 'breathe', label: 'Breathe (ref. mount)', min: 0, max: 1.5, step: .01 },
      { k: 'breatheLength', label: 'Breathe stretches length', min: 0, max: 1.5, step: .01 },
      { k: 'twist', label: 'Twist', min: -45, max: 45, step: .5 },
      { k: 'spin', label: 'Spin', min: -.2, max: .2, step: .002 },
    ] },
    { t: 'Shader', s: 'paint colour', c: [
      { k: 'gradType', type: 'select', num: true, label: 'Gradient', opts: GRAD.map((n, i) => [i, n]) },
      { k: 'animType', type: 'select', num: true, label: 'Animation', opts: ANIM.map((n, i) => [i, n]) },
      { k: 'gradSpeed', label: 'Gradient speed', min: 0, max: 2, step: .01 },
      { k: 'angle', label: 'Angle (°)', min: 0, max: 180, step: 1 },
      { k: 'gScale', label: 'Scale', min: .2, max: 4, step: .01 },
      { k: 'stripes', label: 'Stripe count', min: 1, max: 24, step: 1 },
      { k: 'stripeTwist', label: 'Vortex wind', min: -10, max: 10, step: .1, show: p => p.gradType === 9 },
      { k: 'steps', label: 'Poster steps (0 = smooth)', min: 0, max: 8, step: 1 },
      { k: 'ambient', label: 'Ambient', min: 0, max: 1.5, step: .01 },
      { k: 'diffuse', label: 'Diffuse light', min: 0, max: 1.5, step: .01 },
      { k: 'fog', label: 'Depth fog', min: 0, max: 1, step: .01 },
      { k: 'fogFar', label: 'Fog distance', min: 800, max: 12000, step: 10 },
    ] },
    { t: 'Colour', s: 'palette', open: true, c: [
      { k: 'palette', type: 'select', label: 'Palette (first colour = background)', opts: () => colorScheme.map(s => [s.name, s.name]) },
      { k: 'skipBg', type: 'toggle', label: 'Keep background colour out of the paint' },
      { k: 'seed', label: 'Seed (colour order, timing)', min: 1, max: 999, step: 1 },
    ] },
  ];

  const items = [], groups = [];
  let styleName = '';
  const fill = r => { const a = +r.min, b = +r.max, v = +r.value; r.style.setProperty('--p', ((v - a) / ((b - a) || 1) * 100) + '%'); };
  const SHOW_KEYS = ['stepAmp', 'nibAmt', 'bristles', 'coverage', 'halftone'];   // sliders that reveal other rows
  function previews() {
    const a = document.getElementById('pv_spine'), b = document.getElementById('pv_brush');
    try { if (a) BR.drawSpinePreview(a, PARAMS); if (b) BR.drawBrushPreview(b, PARAMS); } catch (e) { /* preview is best-effort */ }
  }
  const $ = id => document.getElementById(id);
  const fmtV = (v, st) => st >= 1 ? String(Math.round(v)) : String(+(+v).toFixed(st < .01 ? 3 : 2));
  const near = (a, b, st) => b === undefined || Math.abs(a - b) < st / 2;
  // Brand-safe panel. Everyone sees only these controls, inside the SAFE ranges, so a look cannot drift off the
  // Spellbound identity (skeleton, layout, texture and shader are fixed by the chosen style).
  // Open the page with ?dev to get the full workshop panel back ("Show all controls", full slider ranges).
  const DEV = /[?&]dev\b/.test(location.search);
  const BASIC = new Set(['shapeRot', 'coverage', 'chainDir',
    'tipMode', 'stampPlace', 'stampPivot', 'stampSize',
    'halftone', 'halftoneDot', 'patternScale', 'patternFit', 'patternSpacing', 'patternOuter', 'patternInner',
    'introOn', 'introDur', 'introSpin', 'count', 'spacing', 'geoRatio', 'vpX', 'vpY', 'fly', 'twist', 'spin']);
  const SAFE = {
    shapeRot: [-45, 45], aspect: [.75, 1.25], coverage: [.4, 1], rectHook: [0, 1], rectJitter: [0, .05],
    width: [.02, .25], halftone: [0, 4], halftoneDot: [.008, .03], patternScale: [.5, 1.6], patternSpacing: [-.8, 1],   // < 0 = tiles overlap, for artwork that interlocks
    introDur: [.5, 2.5], introSpin: [-1, 1], count: [11, 20], spacing: [200, 500], geoRatio: [.55, .85],
    vpX: [-.3, .3], vpY: [-.25, .65],   // vanishing point stays well inside the frame (Chevron rise sits low on purpose)
    fly: [0, 2], twist: [-15, 15], spin: [-.05, .05],
  };
  // brand colours offered to users (the other palettes stay in sketch.js for the dev panel / hidden styles)
  const BRAND_PALETTES = ['SB Void mono', 'SB Lilac mono', 'SB Lilac white'];
  const PALETTES = () => colorScheme.filter(sc => BRAND_PALETTES.includes(sc.name));

  function build() {
    styleName = PRESETS[0] ? PRESETS[0].name : '';
    const panel = $('panel');
    GROUPS.forEach((g, gi) => {
      const det = document.createElement('details'); if (g.open) det.open = true;
      det.innerHTML = `<summary>${g.t}<small>${g.s}</small></summary>`;
      const grp = document.createElement('div'); grp.className = 'grp'; det.appendChild(grp); groups.push(det);
      g.c.forEach(c => {
        const w = document.createElement('div'); w.className = 'ctl';
        if (c.type === 'select') {
          const opts = typeof c.opts === 'function' ? c.opts() : c.opts;
          w.innerHTML = `<label for="c_${c.k}">${c.label}</label><select id="c_${c.k}">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>`;
          w.querySelector('select').addEventListener('change', e => { setParam(c.k, c.num ? +e.target.value : e.target.value); if (c.k === 'layout' || c.k === 'brush' || c.k === 'skeleton') styleName = ''; sync(); });
        } else if (c.type === 'toggle') {
          w.innerHTML = `<label class="tog"><input type="checkbox" id="c_${c.k}"> ${c.label}</label>`;
          w.querySelector('input').addEventListener('change', e => setParam(c.k, e.target.checked));
        } else if (c.type === 'text') {
          w.innerHTML = `<label for="c_${c.k}">${c.label}</label><textarea id="c_${c.k}" rows="4" spellcheck="false"></textarea>`;
          w.querySelector('textarea').addEventListener('input', e => setParam(c.k, e.target.value));
        } else if (c.type === 'logo') {
          w.innerHTML = `<label>Logo <span class="hint">(optional · SVG or PNG)</span></label>
            <div class="upl"><label class="btn" for="u_logo">Upload logo</label><input type="file" id="u_logo" accept=".svg,.png,image/svg+xml,image/png" hidden>
            <button class="btn" type="button" id="u_logoClear" hidden>Remove</button></div>`;
          w.querySelector('#u_logo').onchange = async e => { const f = e.target.files[0]; if (!f) return; const ok = await Banner.loadLogo(f); toast(ok ? 'Logo added' : 'Could not read this logo'); e.target.value = ''; sync(); };
          w.querySelector('#u_logoClear').onclick = () => { Banner.clearLogo(); sync(); };
        } else if (c.type === 'brushes') {
          const OFF_BRAND = ['bristle', 'sumi', 'nib'];   // dry bristle, sumi wash, calligraphy: kept for ?dev, not offered to customers
          const keys = Object.keys(BR.LIBRARY).filter(k => k !== 'custom' && (DEV || !OFF_BRAND.includes(k)));
          w.innerHTML = `<label>Brush</label><div class="brushes" role="radiogroup" aria-label="Brush">${keys.map(k =>
            `<button type="button" class="bt" role="radio" data-k="${k}" title="${BR.LIBRARY[k].name}"><canvas width="240" height="70"></canvas><span>${BR.LIBRARY[k].name}</span></button>`).join('')}
            <button type="button" class="bt" role="radio" data-k="custom" id="bt_custom" hidden title="Your uploaded SVG"><canvas width="240" height="70"></canvas><span>Your SVG</span></button></div>`;
          w.querySelectorAll('.bt').forEach(b => {
            if (b.dataset.k !== 'custom') { try { BR.drawBrushPreview(b.querySelector('canvas'), Object.assign({}, PARAMS, brushOf(b.dataset.k), { skeleton: 'ring' })); } catch (e) { } }
            b.onclick = () => { setParam('brush', b.dataset.k); if (b.dataset.k === 'custom') setParam('tipSource', 'upload'); styleName = ''; needGeo = true; sync(); };
          });
        } else if (c.type === 'ptiles') {
          // optional tile overrides: a custom corner square, or start / end caps for open paths
          const NAME = { outer: ['Outer corner tile', 'square · side comes in on the left, leaves at the bottom'], inner: ['Inner corner tile', 'square · side comes in on the left, leaves at the top'], start: ['Start tile', 'open paths only'], end: ['End tile', 'open paths only'] };
          const rowsH = c.slots.map(k => `<div class="ptile" data-slot="${k}"><span class="pt-n">${NAME[k][0]}<small>${NAME[k][1]}</small></span><b class="pt-s" id="pt_${k}">—</b>
              <label class="btn" for="pt_${k}File">Upload</label><input type="file" id="pt_${k}File" accept=".svg,image/svg+xml" hidden>
              <button class="btn" type="button" id="pt_${k}Clear" hidden>Remove</button></div>`).join('');
          w.innerHTML = c.caps ? `<details class="pt-caps"><summary>Start &amp; end tiles <span class="hint">optional</span></summary>${rowsH}</details>` : rowsH;
          c.slots.forEach(k => {
            w.querySelector(`#pt_${k}File`).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
              rd.onload = async () => { const r = await BR.loadPatternTile(k, rd.result); toast(r.msg); needGeo = true; sync(); }; rd.readAsText(f); e.target.value = ''; };
            w.querySelector(`#pt_${k}Clear`).onclick = () => { BR.clearPatternTile(k); needGeo = true; sync(); };
          });
        } else if (c.type === 'button') {
          if (!DEV) w.dataset.dev = '1';
          w.innerHTML = `<button class="btn primary" type="button" id="${c.id}">${c.label}</button>`;
          w.querySelector('button').onclick = () => openPortal();
        } else if (c.type === 'palettes') {
          w.innerHTML = `<div class="palettes" id="palettes" role="radiogroup" aria-label="Palette">${PALETTES().map(sc =>
            `<button type="button" class="pal" role="radio" data-name="${sc.name}" title="${sc.name}"><span class="sw">${sc.colors.map(h => `<i style="background:${h}"></i>`).join('')}</span>${sc.name.replace(/^SB /, '')}</button>`).join('')}</div>`;
          w.querySelectorAll('.pal').forEach(b => b.onclick = () => { setParam('palette', b.dataset.name); sync(); });
        } else if (c.type === 'preview') {
          w.innerHTML = `<canvas class="pv ${c.which}" id="pv_${c.which}" width="${c.which === 'spine' ? 280 : 560}" height="${c.which === 'spine' ? 280 : 120}" aria-label="${c.which === 'spine' ? 'Skeleton preview' : 'Brush stroke preview'}"></canvas>`;
        } else if (c.type === 'upload') {
          const id = c.which, label = id === 'spine' ? 'Upload SVG path' : (DEV ? 'Upload SVG brush tip' : 'Upload brush artwork (SVG)');
          const hint = id === 'spine'
            ? 'Draw one line (open or closed) in Illustrator / Figma. The longest path becomes the skeleton.'
            : DEV ? 'Any SVG, exactly as it looks (clip paths, halftones and compound shapes are kept). Its painted area becomes the brush.'
            : 'Your SVG repeats along the path as a pattern brush (draw it left → right, outside on top).';
          const compact = id === 'tip' && !DEV;
          w.innerHTML = `<div class="row${compact ? ' upl-row' : ''}">
              <label class="btn${compact ? ' sm primary' : ''}" for="u_${id}File">${compact ? '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 11V3m-3 3 3-3 3 3M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Upload SVG brush' : label}</label><input type="file" id="u_${id}File" accept=".svg,image/svg+xml" hidden>
              <button class="btn${compact ? ' sm' : ''}" type="button" id="u_${id}Paste">${compact ? 'Paste code' : 'Paste SVG code'}</button></div>
            <div id="u_${id}Box" hidden class="ctl">
              <textarea id="u_${id}Text" aria-label="SVG code or path" placeholder='<svg …>…</svg>  or  M0 0 C…'></textarea>
              <div class="row"><button class="btn" type="button" id="u_${id}Use">Use this SVG</button></div></div>
            <div class="ctl" id="u_${id}Pick" hidden><label for="u_${id}Sel">${id === 'spine' ? 'Path used as skeleton' : 'Outline used as brush tip'}</label><select id="u_${id}Sel"></select></div>
            <p class="hint" id="u_${id}Msg">${hint}</p>`;
          const load = id === 'spine' ? BR.loadSpine : BR.loadTip, select = id === 'spine' ? BR.selectSpine : BR.selectTip, info = id === 'spine' ? BR.spineInfo : BR.tipInfo;
          const apply = async t => {
            if (id === 'tip') {
              $('u_tipMsg').textContent = 'Reading the brush…';
              const asPattern = !DEV || PARAMS.tipMode === 'pattern';   // public upload = the pattern brush's side tile
              const r = asPattern ? await BR.loadPatternTile('side', t) : await BR.loadTipRaster(t); $('u_tipMsg').textContent = r.msg; if (!r.ok) return;
              setParam('brush', 'custom'); setParam('tipSource', 'upload'); setParam('rough', 0);
              if (asPattern) setParam('tipMode', 'pattern'); else { setParam('strokes', 1); setParam('coverage', 1); }
              needGeo = true; sync(); return;
            }
            const r = load(t, $('svgProbe')); $('u_' + id + 'Msg').textContent = r.msg; if (!r.ok) return;
            $('u_' + id + 'Sel').innerHTML = info().map((n, i) => `<option value="${i}">${n}</option>`).join('');
            $('u_' + id + 'Pick').hidden = false;
            if (id === 'spine') { setParam('skeleton', 'path'); setParam('shapeRot', 0); setParam('aspect', 1); } else setParam('brush', 'custom');
            needGeo = true; sync();
          };
          w.querySelector(`#u_${id}Sel`).onchange = e => { select(+e.target.value); needGeo = true; sync(); };
          w.querySelector(`#u_${id}Paste`).onclick = () => { const b = $('u_' + id + 'Box'); b.hidden = !b.hidden; };
          const rs = w.querySelector('#u_tipReset');
          if (rs) rs.onclick = () => { BRUSH_KEYS.forEach(k => { if (DEFAULTS_NOW[k] !== undefined) PARAMS[k] = DEFAULTS_NOW[k]; }); $('u_tipMsg').textContent = hint; $('u_tipBox').hidden = true; needGeo = true; sync(); };
          w.querySelector(`#u_${id}Use`).onclick = () => apply($('u_' + id + 'Text').value);
          w.querySelector(`#u_${id}File`).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('u_' + id + 'Text').value = rd.result; apply(rd.result); }; rd.readAsText(f); e.target.value = ''; };
        } else {
          w.classList.add('slider');
          const [mn, mx] = (!DEV && SAFE[c.k]) ? SAFE[c.k] : [c.min, c.max];
          w.innerHTML = `<div class="lab"><label for="c_${c.k}">${c.label}</label><input class="num" type="number" id="n_${c.k}" step="${c.step}" min="${DEV ? '' : mn}" max="${DEV ? '' : mx}" aria-label="${c.label} value"></div><input type="range" id="c_${c.k}" min="${mn}" max="${mx}" step="${c.step}" title="Double-click to reset">`;
          const rng = w.querySelector('input[type=range]'), num = w.querySelector('.num');
          const commit = v => { if (!isFinite(v)) return; if (!DEV) v = Math.min(mx, Math.max(mn, v)); setParam(c.k, v); rng.value = v; fill(rng); num.value = fmtV(v, c.step); w.classList.toggle('changed', !near(v, DEFAULTS_NOW[c.k], c.step)); if (SHOW_KEYS.includes(c.k)) sync(); else previews(); };
          rng.addEventListener('input', e => commit(parseFloat(e.target.value)));
          num.addEventListener('change', e => commit(parseFloat(e.target.value)));          // typed values may go past the slider range
          num.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
          rng.addEventListener('dblclick', () => { if (DEFAULTS_NOW[c.k] !== undefined) commit(DEFAULTS_NOW[c.k]); });
        }
        grp.appendChild(w); items.push({ c, w, det });
      });
      panel.appendChild(det);
    });

    const pr = $('presets');
    PRESETS.forEach((p, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip style' + (i === 0 ? ' on' : '');
      b.innerHTML = `<img alt="" width="64" height="80"><span>${p.name}</span>`;
      b.setAttribute('role', 'radio'); b.dataset.name = p.name;
      b.onclick = () => { applyPreset(p.p, lock('shape')); styleName = p.name; sync(); };
      pr.appendChild(b);
    });

    const grad = cols => cols.length > 1 ? `linear-gradient(90deg, ${cols.map((c, i) => `${c} ${Math.round(i / (cols.length - 1) * 100)}%`).join(', ')})` : cols[0];
    const ed = $('editions');   // editions are parked: the sidebar only offers the brand colours
    if (ed) THEMES.forEach(th => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tile ed'; b.dataset.id = th.id;
      b.innerHTML = `<span class="grad" style="background:${grad(th.sw)}"></span>${th.name.split(" · ").pop()}`;
      b.title = th.name;
      b.onclick = () => { applyTheme(th.id); sync(); };
      ed.appendChild(b);
    });
    const ph = $('palettesHost');
    PALETTES().forEach(sc => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tile pal'; b.dataset.name = sc.name; b.setAttribute('role', 'radio');
      // background first, then the paint: the tile reads like the artwork
      b.innerHTML = `<span class="grad" style="background:${grad(sc.colors.slice(0, 4))}"></span>${sc.name.replace(/^SB /, '')}`;
      b.title = sc.name.replace(/^SB /, '') + ' · ' + sc.colors.join(' ');
      b.onclick = () => { setParam('palette', sc.name); PARAMS.theme = 'none'; sync(); };
      ph.appendChild(b);
    });
    buildChrome();
    $('showAll').addEventListener('change', sync);
    if (!DEV) $('showAll').closest('label').hidden = true;
    $('bPlay').onclick = () => { playing = !playing; sync(); };
    $('bPng').onclick = () => { wantPNG = true; if (!playing) redraw(); };
    $('bMp4').onclick = openVideo;
    $('mSave').onclick = () => { if (pendingSave) pendingSave(); };
    $('bJson').onclick = () => copy(exportRules(), 'Rules copied as JSON');
    $('fmt').onchange = e => setFormat(e.target.value);
    $('mClose').onclick = () => { if (!recording) { $('modal').hidden = true; $('mSave').textContent = 'Download'; } };
    $('modal').addEventListener('click', e => { if (e.target.id === 'modal' && !recording) $('modal').hidden = true; });
    new ResizeObserver(() => fitStage()).observe($('stage'));
    $('stage').addEventListener('click', () => openPortal());
    $('stage').title = 'Click to open the portal';
    sync();
  }

  // ---- top bar, dock, saved looks, undo / redo
  const RUNTIME = ['fogRGB', 'bgHex', 'wallColors', 'introStart'];
  const snap = () => { const o = {}; for (const k in PARAMS) if (!RUNTIME.includes(k)) o[k] = PARAMS[k]; return { p: o, style: styleName }; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hist = { list: [], at: -1, quiet: false };
  function record() {
    if (hist.quiet) return;
    const cur = snap(); if (hist.at >= 0 && same(cur, hist.list[hist.at])) return;
    hist.list = hist.list.slice(0, hist.at + 1); hist.list.push(cur); if (hist.list.length > 80) hist.list.shift(); hist.at = hist.list.length - 1;
    undoState();
  }
  function restore(st) {
    hist.quiet = true;
    const keepIntro = PARAMS.introStart;
    PARAMS = Object.assign({}, st.p, { introStart: keepIntro }); styleName = st.style;
    needGeo = needMotif = true; sync();
    hist.quiet = false;
  }
  function undo() { if (hist.at > 0) { hist.at--; restore(hist.list[hist.at]); undoState(); } }
  function redo() { if (hist.at < hist.list.length - 1) { hist.at++; restore(hist.list[hist.at]); undoState(); } }
  function undoState() { $('bUndo').disabled = hist.at <= 0; $('bRedo').disabled = hist.at >= hist.list.length - 1; }

  const LOOKS_KEY = 'sb-portal-looks';
  const looks = () => { try { return JSON.parse(localStorage.getItem(LOOKS_KEY) || '[]'); } catch (e) { return []; } };
  const saveLooks = L => { try { localStorage.setItem(LOOKS_KEY, JSON.stringify(L)); return true; } catch (e) { return false; } };
  function renderLooks() {
    const L = looks(), box = $('savedList'); $('savedCount').textContent = L.length;
    box.innerHTML = L.length ? '' : '<div class="empty">Name a look in the top bar and press Save.</div>';
    L.forEach((lk, i) => {
      const it = document.createElement('div'); it.className = 'item';
      it.innerHTML = `<button type="button" class="use" title="Apply this look"></button><button type="button" class="del" aria-label="Delete look">✕</button>`;
      it.querySelector('.use').textContent = lk.name;
      it.querySelector('.use').onclick = () => { restore({ p: Object.assign({}, BASE, lk.p), style: lk.style || '' }); record(); if (PARAMS.introOn) openPortal(); toast('Look applied: ' + lk.name); };
      it.querySelector('.del').onclick = () => { const M = looks(); M.splice(i, 1); saveLooks(M); renderLooks(); };
      box.appendChild(it);
    });
  }

  function buildChrome() {
    $('bUndo').onclick = undo; $('bRedo').onclick = redo;
    $('bReset').onclick = () => {
      const pr = PRESETS.find(p => p.name === styleName);
      if (pr) applyPreset(pr.p, false); else { PARAMS = Object.assign({}, DEFAULTS_NOW); needGeo = needMotif = true; }
      sync(); toast('Back to the style');
    };
    $('bSave').onclick = () => {
      const L = looks(), name = ($('lookName').value || '').trim() || `${styleName || 'Look'} ${L.length + 1}`;
      L.unshift({ name, style: styleName, p: snap().p, at: Date.now() });
      if (!saveLooks(L.slice(0, 40))) { toast('Could not save in this browser'); return; }
      $('lookName').value = ''; renderLooks(); toast('Saved: ' + name);
      $('savedList').hidden = false; $('savedToggle').setAttribute('aria-expanded', 'true');
    };
    $('lookName').addEventListener('keydown', e => { if (e.key === 'Enter') $('bSave').click(); });
    $('savedToggle').onclick = () => { const b = $('savedList'), open = b.hidden; b.hidden = !open; $('savedToggle').setAttribute('aria-expanded', String(open)); };
    renderLooks();
    // export menu
    const menu = $('exportMenu'), ex = $('bExport');
    const closeMenu = () => { menu.hidden = true; ex.setAttribute('aria-expanded', 'false'); };
    ex.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; ex.setAttribute('aria-expanded', String(!menu.hidden)); };
    document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
    menu.querySelectorAll('button').forEach(b => b.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    // dock
    $('bOpen2').onclick = () => openPortal();
    $('uiToggle').onchange = e => { document.body.classList.toggle('hide-panel', !e.target.checked); fitStage(); };
    // shortcuts: undo / redo (not while typing)
    document.addEventListener('keydown', e => {
      if (e.target.matches && e.target.matches('input,textarea,select')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    });
    setInterval(record, 400);
    record();
  }

  function sync() {
    for (const { c, w } of items) {
      const all = DEV && $('showAll') && $('showAll').checked;
      w.hidden = (c.show ? !c.show(PARAMS) : false) || (!!c.k && !all && !BASIC.has(c.k)) || (!!c.k && !all && (PARAMS.uiHide || []).includes(c.k)) || w.dataset.dev === '1';
      if (c.type === 'select') w.querySelector('select').value = PARAMS[c.k];
      else if (c.type === 'toggle') w.querySelector('input').checked = !!PARAMS[c.k];
      else if (c.type === 'text') { const ta = w.querySelector('textarea'); if (document.activeElement !== ta) ta.value = PARAMS[c.k] || ''; }
      else if (c.k) { w.querySelector('input[type=range]').value = PARAMS[c.k]; $('n_' + c.k).value = fmtV(PARAMS[c.k], c.step); w.classList.toggle('changed', !near(PARAMS[c.k], DEFAULTS_NOW[c.k], c.step)); }
    }
    const tm = $('u_tipMsg'); if (tm && PARAMS.brush === 'custom' && !BR.hasTip() && !tm.dataset.n) { tm.dataset.n = 1; }
    const rsb = $('u_tipReset'); if (rsb) rsb.hidden = PARAMS.brush !== 'custom';
    // brush tiles: highlight the current one; the uploaded SVG gets its own tile once there is one
    const own = $('bt_custom');
    if (own) { const has = BR.hasPattern() || BR.hasTip(); own.hidden = !has; if (has && own.dataset.drawn !== String(BR.tipVersion ? BR.tipVersion() : 1)) { BR.drawBrushPreview(own.querySelector('canvas'), Object.assign({}, PARAMS, { brush: 'custom' })); } }
    document.querySelectorAll('.bt').forEach(b => { const on = b.dataset.k === PARAMS.brush; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    groups.forEach(det => { det.hidden = !items.some(it => it.det === det && !it.w.hidden); });
    document.querySelectorAll('.pal').forEach(b => { const on = b.dataset.name === PARAMS.palette; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    document.querySelectorAll('#presets .chip').forEach(b => { const on = b.dataset.name === styleName; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('styleTag').textContent = $('inspTitle').textContent = styleName || 'Custom look';
    if (BR.patternTiles) { const T = BR.patternTiles(); ['outer', 'inner', 'start', 'end'].forEach(k => { const b = $('pt_' + k); if (b) { b.textContent = T[k] ? '✓' : '—'; $('pt_' + k + 'Clear').hidden = !T[k]; } }); }
    const lc = $('u_logoClear'); if (lc) lc.hidden = !Banner.hasLogo();
    document.querySelectorAll('#panel input[type=range]').forEach(fill);
    $('bPlay').textContent = playing ? 'Pause' : 'Play';
    $('seedOut').textContent = PARAMS.seed;
    document.querySelectorAll('.ed').forEach(b => b.classList.toggle('on', b.dataset.id === PARAMS.theme));
    previews();
  }

  function setThumbs(list) { document.querySelectorAll('#presets .chip img').forEach((im, i) => { if (list[i]) im.src = list[i]; }); }

  function lock(which) { const el = $(which === 'shape' ? 'lockShape' : 'lockColor'); return !!(el && el.checked); }

  function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 1600); }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copied'); }
    catch (e) { showText('Rules JSON', text); }
  }
  // Save a generated file: the claude.ai viewer's downloads capability when present, a normal download otherwise.
  async function saveFile(blob, filename) {
    let dl = null;
    try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename, data: blob }); toast('Saved ' + filename); }
      catch (e) { if (e && e.code !== 'declined') toast('Could not save: ' + (e.message || e.code)); }
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  let pendingSave = null;
  function openSheet(title, html, hint, save) {
    $('mTitle').textContent = title; $('mBody').innerHTML = html; $('mHint').textContent = hint || '';
    pendingSave = save || null; $('mSave').hidden = !save; $('modal').hidden = false;
  }
  function showText(title, text) {
    openSheet(title, '<textarea readonly style="min-height:260px"></textarea>', 'Select all and copy.');
    $('mBody').querySelector('textarea').value = text;
  }
  function showPNG(blob) {
    const [w, h] = [Math.round(width * pixelDensity()), Math.round(height * pixelDensity())];
    const url = URL.createObjectURL(blob);
    openSheet(`PNG · ${w}×${h}`, `<img src="${url}" alt="Exported portal frame">`, '', () => saveFile(blob, `spellbound-portal-${PARAMS.seed}.png`));
  }

  // ---- MP4
  function openVideo() {
    if (recording) return;
    openSheet('Record video', `
      <div class="vgrid">
        <div class="ctl"><label for="vSec">Length</label><select id="vSec"><option value="4">4 s</option><option value="8" selected>8 s</option><option value="12">12 s</option><option value="20">20 s</option></select></div>
        <div class="ctl"><label for="vFps">Frame rate</label><select id="vFps"><option value="30" selected>30 fps</option><option value="60">60 fps</option></select></div>
      </div>
      <label class="tog"><input type="checkbox" id="vIntro" checked> Start with the portal opening</label>
      <p class="hint">Records from the current frame at ${Math.round(width * pixelDensity())}×${Math.round(height * pixelDensity())}. Each frame is rendered exactly, so a slow computer just takes longer.</p>
      <div class="row"><button class="btn primary" type="button" id="vGo">Start recording</button><button class="btn" type="button" id="vStop" hidden>Cancel</button></div>
      <div class="prog" id="vProg" hidden><span id="vBar"></span></div>
      <div id="vOut"></div>`, '');
    $('vGo').onclick = startVideo;
    $('vStop').onclick = () => Recorder.cancel();
  }
  let recording = false;
  async function startVideo() {
    recording = true;
    const seconds = +$('vSec').value, fps = +$('vFps').value;
    if ($('vIntro').checked) PARAMS.introStart = clock;
    $('vGo').hidden = true; $('vStop').hidden = false; $('vProg').hidden = false; $('mClose').disabled = true;
    try {
      const r = await Recorder.record({ seconds, fps, onProgress: p => { const b = $('vBar'); if (b) b.style.width = Math.round(p * 100) + '%'; } });
      if (r === 'cancelled') { $('vOut').innerHTML = '<p class="hint">Recording cancelled.</p>'; }
      else {
        const url = URL.createObjectURL(r.blob), name = `spellbound-portal-${PARAMS.seed}-${seconds}s.${r.ext}`;
        $('vOut').innerHTML = `<video src="${url}" controls loop muted autoplay playsinline></video><p class="hint">${r.note} · ${(r.blob.size / 1048576).toFixed(1)} MB</p>`;
        pendingSave = () => saveFile(r.blob, name); $('mSave').hidden = false; $('mSave').textContent = 'Download ' + r.ext.toUpperCase();
      }
    } catch (e) {
      $('vOut').innerHTML = `<p class="hint">Recording failed: ${(e && e.message) || e}. Try a shorter length or 30 fps.</p>`;
    }
    recording = false;
    const go = $('vGo'); if (go) { go.hidden = false; go.textContent = 'Record again'; }
    const st = $('vStop'); if (st) st.hidden = true;
    $('mClose').disabled = false;
  }

  return { build, sync, lock, showPNG, saveFile, previews, setThumbs, DEV };
})();
