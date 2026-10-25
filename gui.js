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
      { k: 'shape', type: 'select', label: 'Base shape of the ring', opts: [['squircle', 'Circle / squircle'], ['polygon', 'Polygon'], ['arch', 'Arch gate'], ['star', 'Rune star']], show: isRing },
      { k: 'roundness', label: 'Squareness', min: 2, max: 14, step: .1, show: p => isRing(p) && p.shape === 'squircle' },
      { k: 'sides', label: 'Sides', min: 3, max: 10, step: 1, show: p => isRing(p) && p.shape === 'polygon' },
      { k: 'soften', label: 'Corner soften', min: 0, max: 1, step: .01, show: p => isRing(p) && (p.shape === 'polygon' || p.shape === 'arch') },
      { k: 'archH', label: 'Arch leg length', min: .3, max: 2.2, step: .01, show: p => isRing(p) && p.shape === 'arch' },
      { k: 'petals', label: 'Petals', min: 2, max: 12, step: 1, show: p => isRing(p) && p.shape === 'star' },
      { k: 'petalAmp', label: 'Petal depth', min: 0, max: .45, step: .005, show: p => isRing(p) && p.shape === 'star' },
      { k: 'spiralTurns', label: 'Spiral turns', min: .3, max: 4, step: .01, show: p => p.skeleton === 'spiral' },
      { k: 'spiralTighten', label: 'Spiral tighten', min: 0, max: .95, step: .01, show: p => p.skeleton === 'spiral' },
      { k: 'aspect', label: 'Aspect (width)', min: .4, max: 1.6, step: .01 },
      { k: 'shapeRot', label: 'Rotate (°)', min: -180, max: 180, step: 1, show: p => p.skeleton !== 'spiral' },
      { k: 'link', type: 'select', label: 'Layers', opts: [['separate', 'Separate rings (no touch)'], ['chain', 'Chained · tail meets head (vortex)']], show: p => p.skeleton === 'ring' && p.layout === 'tunnel' },
      { k: 'tailGap', label: 'Tail gap (− overlap · + gap)', min: -.15, max: .4, step: .005, show: isChain },
      { k: 'chainDir', type: 'select', num: true, label: 'Vortex direction', opts: [[1, 'Clockwise'], [-1, 'Counter-clockwise']], show: isChain },
      { k: 'strokes', label: 'Strokes per layer', min: 1, max: 8, step: 1, show: p => notChain(p) && notRect(p) },
      { k: 'gap', label: 'Gap between strokes', min: 0, max: .6, step: .005, show: p => notChain(p) && notRect(p) },
      { k: 'coverage', label: 'Stroke coverage (turns per stroke when chained)', min: .05, max: 1.5, step: .005, show: notRect },
      { k: 'covJitter', label: 'Coverage scatter', min: 0, max: .6, step: .01, show: p => notChain(p) && notRect(p) },
      { k: 'startDrift', label: 'Start drift per layer', min: -.5, max: .5, step: .005, show: p => notChain(p) && notRect(p) },
      { k: 'startJitter', label: 'Start scatter', min: 0, max: 1, step: .01, show: p => notChain(p) && notRect(p) },
      { k: 'wobble', label: 'Hand wobble', min: 0, max: .08, step: .001 },
    ] },
    { t: 'Brush', s: 'how paint is laid', open: true, c: [
      { type: 'preview', which: 'brush' },
      { k: 'brush', type: 'select', label: 'Brush', opts: () => Object.entries(BR.LIBRARY).map(([k, v]) => [k, v.name]) },
      { k: 'widthProfile', type: 'select', label: 'Width profile (like Illustrator)', opts: () => [['custom', 'Custom (sliders)']].concat(Object.entries(WIDTH_PROFILES).map(([k, v]) => [k, v.name])), show: p => notStamp(p) && notRect(p) },
      { k: 'tipSource', type: 'select', label: 'Tip artwork', opts: () => [['upload', 'Upload your own SVG']].concat(Object.entries(BR.TIPS).map(([k, v]) => [k, 'Built-in · ' + v])), show: p => p.brush === 'custom' },
      { type: 'upload', which: 'tip', show: p => p.brush === 'custom' && p.tipSource === 'upload' },
      { k: 'tipMode', type: 'select', label: 'Use the uploaded tip as', opts: [['stamp', 'Stamp · keep the exact shape'], ['art', 'Art brush · bend it along the skeleton'], ['scatter', 'Scatter brush · copies along the strokes']], show: p => p.brush === 'custom' },
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
      { k: 'introDur', label: 'Duration (s)', min: .2, max: 4, step: .01 },
      { k: 'introFade', label: 'Fade-in (s)', min: .02, max: 1.5, step: .01 },
      { k: 'introSpin', label: 'Whirl (turns)', min: -3, max: 3, step: .01 },
      { k: 'introStagger', label: 'Ring stagger', min: 0, max: .95, step: .01 },
      { k: 'introDepth', label: 'Rush out of the depth (layers)', min: 0, max: 12, step: .1 },
      { k: 'introScale', label: 'Start size (1 = no zoom)', min: 0, max: 1, step: .01 },
      { k: 'introBounce', label: 'Overshoot', min: 0, max: 3, step: .01 },
      { k: 'introAlternate', type: 'toggle', label: 'Alternate whirl direction per ring' },
    ] },
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
    { t: 'Tunnel', s: 'depth & camera', c: [
      { k: 'count', label: 'Layers', min: 3, max: 30, step: 1 },
      { k: 'depthMode', type: 'select', label: 'Depth spacing', opts: [['even', 'Even · true 3D perspective'], ['geometric', 'Geometric · each layer shrinks by the same ratio']] },
      { k: 'spacing', label: 'Spacing', min: 120, max: 900, step: 1, show: p => p.depthMode !== 'geometric' },
      { k: 'geoRatio', label: 'Size ratio per layer', min: .3, max: .95, step: .005, show: p => p.depthMode === 'geometric' },
      { k: 'geoNear', label: 'Front layer distance', min: 60, max: 1500, step: 1, show: p => p.depthMode === 'geometric' },
      { k: 'length', label: 'Extrude depth (0 = flat strokes)', min: 0, max: 1600, step: 1 },
      { k: 'radius', label: 'Radius', min: 60, max: 600, step: 1 },
      { k: 'curveX', label: 'Bend X', min: -.8, max: .8, step: .01 },
      { k: 'curveY', label: 'Bend Y', min: -.8, max: .8, step: .01 },
      { k: 'camZ', label: 'Camera Z', min: -1500, max: 4000, step: 1 },
      { k: 'fov', label: 'Lens (FOV °)', min: 20, max: 110, step: 1 },
      { k: 'vpX', label: 'Vanishing point X (lens shift)', min: -1, max: 1, step: .005 },
      { k: 'vpY', label: 'Vanishing point Y (lens shift)', min: -1, max: 1, step: .005 },
      { k: 'lookX', label: 'Look X (tilts the camera)', min: -500, max: 500, step: 1 },
      { k: 'lookY', label: 'Look Y (tilts the camera)', min: -500, max: 500, step: 1 },
      { k: 'nearClip', label: 'Hide layers closer than', min: 0, max: 1200, step: 10 },
      { k: 'farFade', label: 'Fade in at the back (loop seam)', min: 0, max: .6, step: .01 },
      { k: 'nearFade', label: 'Fade out at the front (loop seam)', min: 0, max: .4, step: .01 },
      { k: 'wallShade', label: 'Extrude shade', min: 0, max: 1.2, step: .01 },
    ] },
    { t: 'Motion', s: 'pull & breathe', c: [
      { k: 'fly', label: 'Pull-in speed (layers/s)', min: -3, max: 3, step: .01 },
      { k: 'breathe', label: 'Breathe (ref. mount)', min: 0, max: 1.5, step: .01 },
      { k: 'breatheLength', label: 'Breathe stretches length', min: 0, max: 1.5, step: .01 },
      { k: 'twist', label: 'Twist (° per 500 depth)', min: -45, max: 45, step: .5 },
      { k: 'spin', label: 'Spin (turns/s)', min: -.2, max: .2, step: .002 },
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
    { t: 'Colour', s: 'palette', c: [
      { k: 'palette', type: 'select', label: 'Palette (first colour = background)', opts: () => colorScheme.map(s => [s.name, s.name]) },
      { type: 'swatches' },
      { k: 'skipBg', type: 'toggle', label: 'Keep background colour out of the paint' },
      { k: 'seed', label: 'Seed (colour order, timing)', min: 1, max: 999, step: 1 },
    ] },
  ];

  const items = [];
  const SHOW_KEYS = ['stepAmp', 'nibAmt', 'bristles', 'coverage'];   // sliders that reveal other rows
  function previews() {
    const a = document.getElementById('pv_spine'), b = document.getElementById('pv_brush');
    try { if (a) BR.drawSpinePreview(a, PARAMS); if (b) BR.drawBrushPreview(b, PARAMS); } catch (e) { /* preview is best-effort */ }
  }
  const $ = id => document.getElementById(id);
  const fmtV = (v, st) => st >= 1 ? String(Math.round(v)) : String(+(+v).toFixed(st < .01 ? 3 : 2));
  const near = (a, b, st) => b === undefined || Math.abs(a - b) < st / 2;
  // the short list shown until "Show all controls" is ticked
  const BASIC = new Set(['skeleton', 'shape', 'sides', 'roundness', 'aspect', 'shapeRot', 'rectMode', 'rectTaper', 'rectOver', 'rectHook', 'rectJitter',
    'link', 'tailGap', 'coverage', 'strokes', 'brush', 'widthProfile', 'tipSource', 'tipMode', 'stampPlace', 'stampPivot', 'stampSize',
    'scatterSpacing', 'scatterSize', 'scatterSizeJit', 'scatterRotJit', 'width', 'taperIn', 'taperOut', 'stepAmp', 'bristles', 'dry', 'rough', 'paintOn',
    'introOn', 'introDur', 'introSpin', 'introDepth', 'layout', 'count', 'depthMode', 'spacing', 'geoRatio', 'radius', 'vpX', 'vpY', 'fly', 'twist', 'spin',
    'gradType', 'steps', 'fog', 'palette', 'skipBg']);

  function build() {
    const panel = $('panel');
    GROUPS.forEach((g, gi) => {
      const det = document.createElement('details'); if (g.open) det.open = true;
      det.innerHTML = `<summary>${g.t}<small>${g.s}</small></summary>`;
      const grp = document.createElement('div'); grp.className = 'grp'; det.appendChild(grp);
      g.c.forEach(c => {
        const w = document.createElement('div'); w.className = 'ctl';
        if (c.type === 'select') {
          const opts = typeof c.opts === 'function' ? c.opts() : c.opts;
          w.innerHTML = `<label for="c_${c.k}">${c.label}</label><select id="c_${c.k}">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>`;
          w.querySelector('select').addEventListener('change', e => { setParam(c.k, c.num ? +e.target.value : e.target.value); if (c.k === 'layout' || c.k === 'brush' || c.k === 'skeleton') document.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); sync(); });
        } else if (c.type === 'toggle') {
          w.innerHTML = `<label class="tog"><input type="checkbox" id="c_${c.k}"> ${c.label}</label>`;
          w.querySelector('input').addEventListener('change', e => setParam(c.k, e.target.checked));
        } else if (c.type === 'button') {
          w.innerHTML = `<button class="btn primary" type="button" id="${c.id}">${c.label}</button>`;
          w.querySelector('button').onclick = () => openPortal();
        } else if (c.type === 'swatches') {
          w.innerHTML = `<div class="swatches" id="swatches"></div>`;
        } else if (c.type === 'preview') {
          w.innerHTML = `<canvas class="pv ${c.which}" id="pv_${c.which}" width="${c.which === 'spine' ? 280 : 560}" height="${c.which === 'spine' ? 280 : 120}" aria-label="${c.which === 'spine' ? 'Skeleton preview' : 'Brush stroke preview'}"></canvas>`;
        } else if (c.type === 'upload') {
          const id = c.which, label = id === 'spine' ? 'Upload SVG path' : 'Upload SVG brush tip';
          const hint = id === 'spine'
            ? 'Draw one line (open or closed) in Illustrator / Figma. The longest path becomes the skeleton.'
            : 'Any SVG, exactly as it looks (clip paths, halftones and compound shapes are kept). Its painted area becomes the brush.';
          w.innerHTML = `<div class="row">
              <label class="btn primary" for="u_${id}File">${label}</label><input type="file" id="u_${id}File" accept=".svg,image/svg+xml" hidden>
              <button class="btn" type="button" id="u_${id}Paste">Paste SVG code</button></div>
            <div id="u_${id}Box" hidden class="ctl">
              <textarea id="u_${id}Text" aria-label="SVG code or path" placeholder='<svg …>…</svg>  or  M0 0 C…'></textarea>
              <div class="row"><button class="btn" type="button" id="u_${id}Use">Use this SVG</button></div></div>
            <div class="ctl" id="u_${id}Pick" hidden><label for="u_${id}Sel">${id === 'spine' ? 'Path used as skeleton' : 'Outline used as brush tip'}</label><select id="u_${id}Sel"></select></div>
            <p class="hint" id="u_${id}Msg">${hint}</p>`;
          const load = id === 'spine' ? BR.loadSpine : BR.loadTip, select = id === 'spine' ? BR.selectSpine : BR.selectTip, info = id === 'spine' ? BR.spineInfo : BR.tipInfo;
          const apply = async t => {
            if (id === 'tip') {
              $('u_tipMsg').textContent = 'Reading the brush…';
              const r = await BR.loadTipRaster(t); $('u_tipMsg').textContent = r.msg; if (!r.ok) return;
              setParam('brush', 'custom'); setParam('strokes', 1); setParam('coverage', 1); setParam('rough', 0); needGeo = true; sync(); return;
            }
            const r = load(t, $('svgProbe')); $('u_' + id + 'Msg').textContent = r.msg; if (!r.ok) return;
            $('u_' + id + 'Sel').innerHTML = info().map((n, i) => `<option value="${i}">${n}</option>`).join('');
            $('u_' + id + 'Pick').hidden = false;
            if (id === 'spine') { setParam('skeleton', 'path'); setParam('shapeRot', 0); setParam('aspect', 1); } else setParam('brush', 'custom');
            needGeo = true; sync();
          };
          w.querySelector(`#u_${id}Sel`).onchange = e => { select(+e.target.value); needGeo = true; sync(); };
          w.querySelector(`#u_${id}Paste`).onclick = () => { const b = $('u_' + id + 'Box'); b.hidden = !b.hidden; };
          w.querySelector(`#u_${id}Use`).onclick = () => apply($('u_' + id + 'Text').value);
          w.querySelector(`#u_${id}File`).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('u_' + id + 'Text').value = rd.result; apply(rd.result); }; rd.readAsText(f); e.target.value = ''; };
        } else {
          w.classList.add('slider');
          w.innerHTML = `<div class="lab"><label for="c_${c.k}">${c.label}</label><input class="num" type="number" id="n_${c.k}" step="${c.step}" aria-label="${c.label} value"></div><input type="range" id="c_${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" title="Double-click to reset">`;
          const rng = w.querySelector('input[type=range]'), num = w.querySelector('.num');
          const commit = v => { if (!isFinite(v)) return; setParam(c.k, v); rng.value = v; num.value = fmtV(v, c.step); w.classList.toggle('changed', !near(v, DEFAULTS_NOW[c.k], c.step)); if (SHOW_KEYS.includes(c.k)) sync(); else previews(); };
          rng.addEventListener('input', e => commit(parseFloat(e.target.value)));
          num.addEventListener('change', e => commit(parseFloat(e.target.value)));          // typed values may go past the slider range
          num.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
          rng.addEventListener('dblclick', () => { if (DEFAULTS_NOW[c.k] !== undefined) commit(DEFAULTS_NOW[c.k]); });
        }
        grp.appendChild(w); items.push({ c, w });
      });
      panel.appendChild(det);
    });

    const pr = $('presets');
    PRESETS.forEach((p, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (i === 0 ? ' on' : ''); b.textContent = p.name;
      b.onclick = () => { applyPreset(p.p, lock('shape')); document.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); sync(); };
      pr.appendChild(b);
    });

    const ed = $('editions');
    THEMES.forEach(th => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ed'; b.dataset.id = th.id;
      b.innerHTML = `<span class="sw">${th.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>${th.name}`;
      b.onclick = () => { applyTheme(th.id); sync(); };
      ed.appendChild(b);
    });
    $('showAll').addEventListener('change', sync);
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

  function sync() {
    for (const { c, w } of items) {
      const all = $('showAll') && $('showAll').checked;
      w.hidden = (c.show ? !c.show(PARAMS) : false) || (!!c.k && !all && !BASIC.has(c.k));
      if (c.type === 'select') w.querySelector('select').value = PARAMS[c.k];
      else if (c.type === 'toggle') w.querySelector('input').checked = !!PARAMS[c.k];
      else if (c.k) { w.querySelector('input[type=range]').value = PARAMS[c.k]; $('n_' + c.k).value = fmtV(PARAMS[c.k], c.step); w.classList.toggle('changed', !near(PARAMS[c.k], DEFAULTS_NOW[c.k], c.step)); }
    }
    const tm = $('u_tipMsg'); if (tm && PARAMS.brush === 'custom' && !BR.hasTip() && !tm.dataset.n) { tm.dataset.n = 1; }
    const sw = $('swatches');
    if (sw) sw.innerHTML = getColorScheme(PARAMS.palette).colors.map((h, i) => `<span title="${h}${i === 0 ? ' · background' : ''}" style="background:${h}"></span>`).join('');
    $('bPlay').textContent = playing ? 'Pause' : 'Play';
    $('seedOut').textContent = PARAMS.seed;
    document.querySelectorAll('.ed').forEach(b => b.classList.toggle('on', b.dataset.id === PARAMS.theme));
    previews();
  }

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

  return { build, sync, lock, showPNG, saveFile, previews };
})();
