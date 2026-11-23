// =============================================================
// brush.js — SKELETON + BRUSH system (replaces the shape tubes)
//
//   Skeleton (khung xương) = the spine a stroke travels along:
//     ring   – a base shape's outline (circle, squircle, polygon)
//     spiral – an open coil that tightens toward the centre
//     path   – any SVG path you upload (open or closed)
//
//   Brush = how paint is laid along that spine, like an Illustrator
//   art brush: width, pressure profile (taper / swell / hook / chisel),
//   calligraphic nib, and an optional uploaded SVG used as the brush tip.
//   Texture (bristles, dry brush, rough edges, paint-on) lives in the shader.
//
//   Each portal layer = one or more brush strokes on the skeleton.
//   Geometry: a flat ribbon facing the camera, optionally extruded back
//   into a wall (that wall is what gives the tunnel its depth).
// =============================================================
const BR = (() => {
  const T = Math.PI * 2;
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n, s) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  // smooth 1-D value noise in [-1, 1]
  const noise1 = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return mix(hash(i, s), hash(i + 1, s), u) * 2 - 1; };

  let customSpine = null;   // [[x,y],…] from an uploaded SVG path
  let customClosed = false;
  let customTip = null;     // (legacy vector envelope, unused)
  // Uploaded brush tip, rendered by the browser exactly as the SVG looks (clip paths, halftones, compound shapes…)
  let tipMask = null;       // p5.Image used as an alpha mask in the shader
  let tipCanvas = null;     // cropped mask canvas, for the panel preview
  let tipAspect = 1;        // width / height of the artwork
  let tipFit = null;        // centre of curvature of the artwork's outer edge {px, py, r} (fractions of the artwork width/height)
  let gid = 0;

  // ------------------------------------------------------------ brush library
  // Each brush is a starting point; every value stays editable in the panel.
  const LIBRARY = {
    marker:    { name: 'Flat marker',       width: .12, taperIn: 0,   taperOut: 0,   swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: 0,   nibAmt: 0,  bias: 0,   bristles: 0,  dry: 0,   rough: 0,   streak: 0 },
    taper:     { name: 'Tapered ink',       width: .14, taperIn: .35, taperOut: .45, swell: .15, flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: .1,  nibAmt: 0,  bias: 0,   bristles: 0,  dry: 0,   rough: .15, streak: 0 },
    hook:      { name: 'Hook flare',        width: .11, taperIn: 0,   taperOut: 0,   swell: 0,   flareIn: 1.1, flareOut: 1.1, stepAmp: 0,   pressure: 0,   nibAmt: 0,  bias: .3,  bristles: 0,  dry: 0,   rough: 0,   streak: 0 },
    chisel:    { name: 'Step chisel',       width: .09, taperIn: 0,   taperOut: .06, swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 1.6, pressure: 0,   nibAmt: 0,  bias: .5,  bristles: 0,  dry: 0,   rough: 0,   streak: 0, stepPos: .3, stepLen: .3, stepJitter: .8 },
    nib:       { name: 'Calligraphy nib',   width: .2,  taperIn: .05, taperOut: .1,  swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: .05, nibAmt: .9, bias: 0,   bristles: 0,  dry: 0,   rough: .1,  streak: 0, nibAngle: 35 },
    bristle:   { name: 'Dry bristle',       width: .18, taperIn: .1,  taperOut: .35, swell: .1,  flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: .25, nibAmt: 0,  bias: 0,   bristles: 22, dry: .6,  rough: .45, streak: .35 },
    sumi:      { name: 'Sumi wash',         width: .26, taperIn: .2,  taperOut: .6,  swell: .35, flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: .35, nibAmt: .3, bias: 0,   bristles: 40, dry: .3,  rough: .6,  streak: .2 },
    barb:      { name: 'Barb step',         width: .045, taperIn: 0,  taperOut: 0,   swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 2.4, pressure: 0,   nibAmt: 0,  bias: 0,   bristles: 0,  dry: 0,   rough: 0,   streak: 0, stepPos: .45, stepLen: .6, stepJitter: .3, stepBarb: .9 },
    thorn:     { name: 'Thorn',             width: .1,  taperIn: .04, taperOut: .3,  swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: 0,   nibAmt: 0,  bias: 0,   bristles: 0,  dry: 0,   rough: 0,   streak: 0, thornAmp: .9, thornCount: 6 },
    custom:    { name: 'Custom tip (SVG)',  width: .18, taperIn: 0,   taperOut: 0,   swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: 0,   nibAmt: 0,  bias: 0,   bristles: 0,  dry: 0,   rough: 0,   streak: 0 },
  };
  // shape extras every brush carries (0 = off), so switching brush always resets them
  const EXTRA = { stepBarb: 0, stepFacets: 0, thornAmp: 0, thornCount: 6, thornSide: 1 };
  for (const k in LIBRARY) LIBRARY[k] = Object.assign({}, EXTRA, LIBRARY[k]);
  const BRUSH_KEYS = Object.keys(LIBRARY.marker).filter(k => k !== 'name');

  // ------------------------------------------------------------ spines
  function resample(pts, N, closed) {
    const n = pts.length, segs = closed ? n : n - 1, L = [0];
    for (let i = 0; i < segs; i++) { const a = pts[i], b = pts[(i + 1) % n]; L.push(L[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const tot = L[segs] || 1, out = []; let j = 0;
    const cnt = closed ? N : N + 1;
    for (let k = 0; k < cnt; k++) {
      const tg = closed ? k / N * tot : k / N * tot;
      while (j < segs - 1 && L[j + 1] < tg) j++;
      const a = pts[j], b = pts[(j + 1) % n], seg = L[j + 1] - L[j] || 1, t = clamp((tg - L[j]) / seg, 0, 1);
      out.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]);
    }
    return out;
  }

  // Spine = arc-length-uniform polyline with unit normals pointing "outward".
  function makeSpine(pts, closed) {
    const n = pts.length, S = { closed, n, x: new Float32Array(n), y: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n) };
    pts.forEach((p, i) => { S.x[i] = p[0]; S.y[i] = p[1]; });
    for (let i = 0; i < n; i++) {
      let tx = 0, ty = 0;
      for (let o = 1; o <= 2; o++) {
        const a = closed ? (i + o) % n : Math.min(n - 1, i + o), b = closed ? (i - o + n) % n : Math.max(0, i - o);
        tx += S.x[a] - S.x[b]; ty += S.y[a] - S.y[b];
      }
      const l = Math.hypot(tx, ty) || 1; S.tx[i] = tx / l; S.ty[i] = ty / l;
      S.nx[i] = ty / l; S.ny[i] = -tx / l;
    }
    // flip so normals point away from the centre on average
    let dot = 0; for (let i = 0; i < n; i++) dot += S.nx[i] * S.x[i] + S.ny[i] * S.y[i];
    if (dot < 0) for (let i = 0; i < n; i++) { S.nx[i] *= -1; S.ny[i] *= -1; }
    return S;
  }
  function sampleSpine(S, u) {
    const n = S.n;
    let f;
    if (S.closed) f = (((u % 1) + 1) % 1) * n; else f = clamp(u, 0, 1) * (n - 1);
    const i = Math.floor(f), j = S.closed ? (i + 1) % n : Math.min(n - 1, i + 1), t = f - i, ii = S.closed ? i % n : Math.min(i, n - 1);
    let nx = mix(S.nx[ii], S.nx[j], t), ny = mix(S.ny[ii], S.ny[j], t); const l = Math.hypot(nx, ny) || 1;
    return { x: mix(S.x[ii], S.x[j], t), y: mix(S.y[ii], S.y[j], t), nx: nx / l, ny: ny / l, ang: Math.atan2(mix(S.ty[ii], S.ty[j], t), mix(S.tx[ii], S.tx[j], t)) };
  }

  function normalise(pts, aspect, rotDeg) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sc = 1 / (Math.max(x1 - x0, y1 - y0) / 2 || 1);
    const r = (rotDeg || 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
    return pts.map(p => { const x = (p[0] - cx) * sc * aspect, y = (p[1] - cy) * sc; return [x * co - y * si, x * si + y * co]; });
  }

  function rectCorners(P, seed) {
    const a = P.aspect, j = P.rectJitter || 0, r = (P.shapeRot || 0) * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
    return [[-a, -1], [a, -1], [a, 1], [-a, 1]].map(([x, y], k) => {
      if (seed !== undefined && j > 0) { x += (hash(seed * 5.1 + k * 2.3, 21) - .5) * 2 * j; y += (hash(seed * 5.1 + k * 2.3, 22) - .5) * 2 * j; }
      return [x * co - y * si, x * si + y * co];
    });
  }
  function buildSpine(P) {
    if (P.skeleton === 'rect') return makeSpine(resample(rectCorners(P), 720, true), true);
    if (P.skeleton === 'spiral') {
      const pts = [], M = 600;
      for (let k = 0; k <= M; k++) {
        const t = k / M, a = -Math.PI / 2 + P.spiralTurns * T * t, r = mix(1, 1 - P.spiralTighten, t);
        pts.push([P.aspect * r * Math.cos(a), r * Math.sin(a)]);
      }
      return makeSpine(resample(pts, 600, false), false);
    }
    if (P.skeleton === 'path' && customSpine) {
      const pts = normalise(customSpine, P.aspect, P.shapeRot);
      return makeSpine(resample(pts, 720, customClosed), customClosed);
    }
    // ring: reuse the base-shape contour from shapes.js as the spine
    const C = SB.contour(Object.assign({}, P, { shape: P.shape === 'custom' ? 'squircle' : P.shape }));
    const pts = []; for (let i = 0; i < C.N; i++) pts.push([C.x[i], C.y[i]]);
    return makeSpine(pts, true);
  }

  // ------------------------------------------------------------ brush profile
  // Returns [lo, hi]: inner and outer edge offsets in units of brush width.
  function profile(B, t, s, ang, useTip) {
    let lo = -.5, hi = .5;
    if (useTip && customTip) {
      const f = clamp(t, 0, 1) * (customTip.lo.length - 1), i = Math.floor(f), j = Math.min(customTip.lo.length - 1, i + 1), k = f - i;
      lo = mix(customTip.lo[i], customTip.lo[j], k); hi = mix(customTip.hi[i], customTip.hi[j], k);
    }
    let w = 1;
    if (B.taperIn > 0) w *= Math.pow(sstep(0, B.taperIn, t), .75);
    if (B.taperOut > 0) w *= Math.pow(sstep(0, B.taperOut, 1 - t), .75);
    w *= 1 + B.swell * (Math.sin(Math.PI * t) - .5);
    w *= Math.max(0, 1 + B.pressure * noise1(t * 7 + s * 13.7, s));
    if (B.nibAmt > 0) w *= mix(1, Math.max(.12, Math.abs(Math.sin(ang - B.nibAngle * Math.PI / 180))), B.nibAmt);
    lo *= w; hi *= w;
    // hook flare: the ends curl outward to one side (brand assets 02 / 03)
    const fi = B.flareIn * (1 - sstep(0, .07, t)), fo = B.flareOut * (1 - sstep(0, .07, 1 - t));
    hi += (fi + fo) * .5;
    // thorns: hooked spikes along the edge — a sheer face, then a concave slope back down (brand thorn frames)
    if (B.thornAmp > 0) {
      const ends = sstep(0, .05, t) * sstep(0, .05, 1 - t), n = Math.max(1, B.thornCount);
      const spike = ph => { const f = ph - Math.floor(ph); return Math.pow(Math.max(0, 1 - f / .32), 2.6); };
      const a = B.thornAmp * .5 * ends * w;
      if (B.thornSide !== -1) hi += a * spike(t * n + hash(s, 17));
      if (B.thornSide !== 1) lo -= a * .8 * spike(t * n + .5 + hash(s, 19));
    }
    // step chisel: a raised, squared-off section on the outer edge (brand asset 01)
    if (B.stepAmp > 0) {
      const sp = clamp(B.stepPos + (hash(s, 9) - .5) * B.stepJitter, 0, 1);
      let bump = (B.stepBarb > 0 ? sstep(sp - .004, sp, t) : sstep(sp - .03, sp + .01, t)) * (1 - sstep(sp + B.stepLen - .01, sp + B.stepLen + .03, t));
      // barb: the step's front edge is a hooked spike — a sheer face, then a concave dip down to the step
      if (B.stepBarb > 0) { const x = (t - sp) / .06; if (x >= 0 && x < 1) bump *= 1 + B.stepBarb * Math.pow(1 - x, 2.2); }
      // facets: the step's outer edge runs in straight chords (a polygon round a round skeleton)
      if (B.stepFacets > 2 && bump > 0) { const seg = 2 * Math.PI / B.stepFacets, ph = ((ang % seg) + seg) % seg - seg / 2; bump += (1 / Math.cos(ph) - 1) * 2 / (Math.max(.01, B.width) * Math.max(.1, B.stepAmp)) * Math.min(1, bump); }
      if (B.stepSide < 0) lo -= B.stepAmp * bump * .5; else hi += B.stepAmp * bump * .5;
    }
    const sh = B.bias * .5 * w; lo += sh; hi += sh;
    return [lo, hi];
  }

  // ------------------------------------------------------------ geometry
  // One p5.Geometry per portal layer, holding all of that layer's strokes.
  // uv.x = position along the stroke (0..1) — walls use uv.x + 2 so the shader can tell them apart
  // uv.y = across the stroke (0 inner edge .. 1 outer edge)
  // Chain maths. Layer i is turned by twist·depth, so the deeper neighbour sits `delta` turns further round.
  // Per-layer start drift g is snapped so g·count is a whole number of turns: the chain then closes on itself
  // and stays seamless while layers loop through the tunnel.
  function isChained(P, S) { return P.link === 'chain' && P.skeleton === 'ring' && P.depthMode !== 'geometric' && (S ? S.closed : P.skeleton !== 'path' && P.skeleton !== 'spiral') && P.layout === 'tunnel'; }
  function chainLink(P) {
    const n = Math.max(1, Math.round(P.count));
    const delta = (P.twist * P.spacing / 500) / 360;
    const want = Math.max(.05, P.coverage) * (P.chainDir < 0 ? -1 : 1);
    const drift = Math.round((delta - want) * n) / n || (1 / n) * (want > 0 ? -1 : 1);
    return { drift, cov: delta - drift - P.tailGap * (want > 0 ? 1 : -1) };
  }

  // RECT skeleton: every side is its own brush stroke, thick at one corner and running to a sharp point.
  //   L        – two L-shaped brushes: thick at top-left and bottom-right (the reference frames)
  //   pinwheel – each side thick where it starts, turning round the frame
  //   corners  – thick at both corners, pinched in the middle
  //   uniform  – even width
  function rectRibbons(P, seed) {
    const C = rectCorners(P, seed), W = P.width, out = [];
    const thickAt = { L: ['start', 'end', 'start', 'end'], pinwheel: ['start', 'start', 'start', 'start'], 'pinwheel-rev': ['end', 'end', 'end', 'end'], corners: ['both', 'both', 'both', 'both'], uniform: ['none', 'none', 'none', 'none'] }[P.rectMode] || ['start', 'end', 'start', 'end'];
    // Clean corners: a thick end runs on exactly to the OUTER edge of the side it meets, so the two outer
    // edges close into one sharp square corner (no step, no notch sticking out past the frame).
    const mx = (C[0][0] + C[1][0] + C[2][0] + C[3][0]) / 4, my = (C[0][1] + C[1][1] + C[2][1] + C[3][1]) / 4;
    const sideSign = k => {                                            // +1 when the side's +normal points out of the frame
      const c0 = C[k], c1 = C[(k + 1) % 4], dx = c1[0] - c0[0], dy = c1[1] - c0[1], len = Math.hypot(dx, dy) || 1;
      return Math.sign(dy / len * ((c0[0] + c1[0]) / 2 - mx) - dx / len * ((c0[1] + c1[1]) / 2 - my)) || 1;
    };
    const outerOf = k => { const off = P.bias * .5 * W; return Math.max(0, sideSign(k) > 0 ? W / 2 + off : W / 2 - off); };   // how far side k's paint reaches outward at full width
    for (let k = 0; k < 4; k++) {
      const c0 = C[k], c1 = C[(k + 1) % 4], dx = c1[0] - c0[0], dy = c1[1] - c0[1], len = Math.hypot(dx, dy) || 1;
      const tx = dx / len, ty = dy / len, nx = ty, ny = -tx, mode = thickAt[k], s = seed * 11 + k, sg = sideSign(k);
      const cut = P.rectGap, extA = outerOf((k + 3) % 4), extB = outerOf((k + 1) % 4);
      const sa = (mode === 'start' || mode === 'both' || mode === 'none') ? -extA / len : (mode === 'end' ? cut : 0);
      const sb = (mode === 'end' || mode === 'both' || mode === 'none') ? 1 + extB / len : (mode === 'start' ? 1 - cut : 1);
      const rows = [], M = 140, ang = Math.atan2(ty, tx);
      for (let i = 0; i <= M; i++) {
        const t = i / M, sp = mix(sa, sb, t);
        let d = 1;                                                     // 1 = thick corner end, 0 = thin end
        if (mode === 'start') d = 1 - clamp(sp, 0, 1); else if (mode === 'end') d = clamp(sp, 0, 1);
        else if (mode === 'both') d = Math.abs(clamp(sp, 0, 1) - .5) * 2;
        let f = mode === 'none' ? 1 : mix(P.rectTip, 1, Math.pow(d, P.rectTaper));
        f *= Math.max(0, 1 + P.pressure * noise1(t * 7 + s * 13.7, s));
        if (P.nibAmt > 0) f *= mix(1, Math.max(.12, Math.abs(Math.sin(ang - P.nibAngle * Math.PI / 180))), P.nibAmt);
        const w = W * f, off = P.bias * .5 * w;
        let lo = -w / 2 + off, hi = w / 2 + off;
        if (P.rectHook > 0 && mode !== 'none' && sp >= 0 && sp <= 1) {   // the little hook at the thick corner grows INTO the frame, so the outer corner stays one clean square
          const hk = P.rectHook * W * .5 * Math.pow(Math.max(0, (d - .8) / .2), 2.5);
          if (sg > 0) lo -= hk; else hi += hk;
        }
        const wob = P.wobble ? (noise1(sp * 6 + s, s + 3) * .7 + noise1(sp * 17 + s, s + 5) * .3) * P.wobble : 0;
        const bx = c0[0] + dx * sp + nx * wob, by = c0[1] + dy * sp + ny * wob, shi = w / 2 + off, slo = -w / 2 + off;
        rows.push({ zf: .5, t, ix: bx + nx * lo, iy: by + ny * lo, ox: bx + nx * hi, oy: by + ny * hi, nx, ny, ang,
          six: bx + nx * slo, siy: by + ny * slo, sox: bx + nx * shi, soy: by + ny * shi });
      }
      out.push(rows);
    }
    return out;
  }

  // SCATTER (Illustrator scatter brush): copies of the tip dropped along the strokes
  function scatterGeometry(ribbons, P, seed) {
    const g = new p5.Geometry(1, 1, function () {
      const V = this.vertices, N = this.vertexNormals, U = this.uvs, F = this.faces;
      let n = 0;
      for (const rows of ribbons) {
        let acc = P.scatterSpacing * hash(seed, 31), prev = null;
        for (const R of rows) {
          const cx = (R.ix + R.ox) / 2, cy = (R.iy + R.oy) / 2, wloc = Math.hypot(R.ox - R.ix, R.oy - R.iy);
          if (prev) acc += Math.hypot(cx - prev[0], cy - prev[1]);
          prev = [cx, cy];
          if (acc < P.scatterSpacing) continue;
          acc -= P.scatterSpacing; n++;
          const h1 = hash(seed * 7 + n, 41), h2 = hash(seed * 7 + n, 42), h3 = hash(seed * 7 + n, 43);
          let size = P.scatterSize * (1 + (h1 - .5) * 2 * P.scatterSizeJit);
          if (P.scatterByWidth) size *= clamp(wloc / Math.max(1e-4, P.width), 0, 3);
          if (size <= 1e-4) continue;
          const tang = Math.atan2(R.oy - R.iy, R.ox - R.ix) - Math.PI / 2;
          const ang = (P.scatterAlign ? tang : 0) + (h2 - .5) * 2 * P.scatterRotJit * Math.PI;
          const off = (h3 - .5) * 2 * P.scatterOffset;
          const px = cx + R.nx * off, py = cy + R.ny * off, w = size, hgt = size / tipAspect;
          const co = Math.cos(ang), si = Math.sin(ang), base = V.length;
          for (const [lx, ly, u, v] of [[-w / 2, -hgt / 2, 0, 1], [w / 2, -hgt / 2, 1, 1], [-w / 2, hgt / 2, 0, 0], [w / 2, hgt / 2, 1, 0]]) {
            V.push(new p5.Vector(px + lx * co - ly * si, py + lx * si + ly * co, .5)); N.push(new p5.Vector(0, 0, 1)); U.push(u, v);
          }
          F.push([base, base + 1, base + 2], [base + 1, base + 3, base + 2]);
        }
      }
    });
    g.gid = 'sb-scatter-' + (gid++);
    return g;
  }

  // HALFTONE (print AM screen, Euclidean dot): beyond the stroke's outer edge the ink carries on as a screen that
  // fades OUTWARD. Right at the edge it is solid with tiny round paper holes; the holes grow until half the cell is
  // ink, then it flips to round ink dots that shrink away from the stroke until nothing is left.
  // Dark cells are "ink square minus a round hole", so neighbouring cells always tile with no gaps.
  // The band follows the brush shape: its distance is measured square to the stroke edge (sharp mitred corners), and
  // it stops at the stroke's two ends instead of wrapping round the tips. The grid lies on the layer's plane, so
  // the screen shrinks with perspective like the rest of the stroke.
  //   halftone      – band width, in multiples of the brush width
  //   halftoneDot   – screen pitch (cell size), in units of the portal radius
  //   halftoneAngle – screen angle (°)
  const HALFTONE_FALL = 1;     // hole growth across the band (1 = even)
  // Returns a list of p5.Geometry chunks (each under 60k vertices: WebGL draws one buffer with 16-bit indices).
  const HALFTONE_MAX_CELLS = 4500;   // per layer: past this the screen coarsens a little so rebuilding stays quick
  function halftoneDots(ribbons, P, inset = 0) {
    const B = P.halftone * P.width + inset, chunks = [];   // the band starts `inset` inside the original brush edge
    let edgeLen = 0;
    for (const rows of ribbons) for (let i = 1; i < rows.length; i++) edgeLen += Math.hypot(rows[i].ox - rows[i - 1].ox, rows[i].oy - rows[i - 1].oy);
    // the band must hold at least ~3 cells, or a thin brush with a low Halftone value shows no dots at all:
    // there the screen gets finer than the chosen dot size instead of disappearing
    const cell = Math.max(.0025, Math.min(P.halftoneDot, B / 3), Math.sqrt(edgeLen * B * 1.2 / HALFTONE_MAX_CELLS));
    if (B < cell) return chunks;
    let V, N, U, F;
    const flush = () => {
      if (V && V.length) { const vv = V, nn = N, uu = U, ff = F; const g = new p5.Geometry(1, 1, function () { this.vertices = vv; this.vertexNormals = nn; this.uvs = uu; this.faces = ff; }); g.gid = 'sb-halftone-' + (gid++); chunks.push(g); }
      V = []; N = []; U = []; F = [];
    };
    flush();
    const add = (x, y, z, nx, ny, nz, u, v) => { V.push(new p5.Vector(x, y, z)); N.push(new p5.Vector(nx, ny, nz)); U.push(u, v); return V.length - 1; };
    // edge samples of every stroke (smooth outer edge: no chisel step / hook)
    const strokes = [];
    for (const rows of ribbons) {
      const L = rows.map(R => ({ x: R.sox ?? R.ox, y: R.soy ?? R.oy, nx: R.nx, ny: R.ny, z: R.zf, t: R.t }));
      const closed = L.length > 2 && Math.hypot(L[0].x - L[L.length - 1].x, L[0].y - L[L.length - 1].y) < 1e-3;
      strokes.push({ L, closed });
    }
    const bs = B + cell, grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    strokes.forEach((st, si) => st.L.forEach((e, i) => {
      const k = key(Math.floor(e.x / bs), Math.floor(e.y / bs));
      (grid.get(k) || grid.set(k, []).get(k)).push([si, i]);
      x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x); y1 = Math.max(y1, e.y);
    }));
    x0 -= bs; y0 -= bs; x1 += bs; y1 += bs;
    const a = P.halftoneAngle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
    // cell outline: 16 rays from the centre; the square's corners fall exactly on rays 2, 6, 10, 14
    const RAYS = 16, ray = [];
    for (let k = 0; k < RAYS; k++) {
      const t = k / RAYS * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), sq = .5 / Math.max(Math.abs(c), Math.abs(s));
      ray.push([c, s, sq]);
    }
    const ray8 = ray.filter((_, k) => k % 2 === 0);   // small holes: 8 rays are plenty (corners stay on rays 1, 3, 5, 7)
    const toW = (px, py, u, v) => [px + (u * ca - v * sa) * cell, py + (u * sa + v * ca) * cell];
    // only visit grid cells whose centre lies in a hash bucket next to some edge sample (each cell once: by its own bucket)
    const buckets = new Set();
    strokes.forEach(st => st.L.forEach(e => { const i = Math.floor(e.x / bs), j = Math.floor(e.y / bs); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) buckets.add((i + di) + ',' + (j + dj)); }));
    const cells = [];
    for (const bk of buckets) {
      const [bx, by] = bk.split(',').map(Number), wx0 = bx * bs, wy0 = by * bs, wx1 = wx0 + bs, wy1 = wy0 + bs;
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const [wx, wy] of [[wx0, wy0], [wx1, wy0], [wx0, wy1], [wx1, wy1]]) {
        const dx = wx - cx0, dy = wy - cy0, u = (dx * ca + dy * sa) / cell, v = (-dx * sa + dy * ca) / cell;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
      for (let gi = Math.floor(u0); gi <= Math.ceil(u1); gi++) for (let gj = Math.floor(v0); gj <= Math.ceil(v1); gj++) {
        const px = cx0 + (gi * ca - gj * sa) * cell, py = cy0 + (gi * sa + gj * ca) * cell;
        if (Math.floor(px / bs) === bx && Math.floor(py / bs) === by) cells.push(px, py);
      }
    }
    for (let ci = 0; ci < cells.length; ci += 2) {
      const px = cells[ci], py = cells[ci + 1];
      // nearest edge sample
      const bi = Math.floor(px / bs), bj = Math.floor(py / bs);
      let best = null, bd = 1e9;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const Lb = grid.get(key(bi + di, bj + dj)); if (!Lb) continue;
        for (const [si, i] of Lb) { const e = strokes[si].L[i], d2 = (px - e.x) ** 2 + (py - e.y) ** 2; if (d2 < bd) { bd = d2; best = [si, i]; } }
      }
      if (!best) continue;
      const st = strokes[best[0]], L = st.L, i0 = best[1];
      if (!st.closed && (i0 === 0 || i0 === L.length - 1)) continue;          // past a stroke end: the band stops there
      // square distance out from the edge: the largest of the nearby edge tangents (gives mitred corners)
      let d = -1e9;
      const reach = (B + cell) * (B + cell);
      for (const dir of [1, -1]) for (let k = 0, i = i0; k < L.length; k++, i += dir) {
        if (st.closed) i = (i + L.length) % L.length; else if (i < 0 || i >= L.length) break;
        const e = L[i]; if ((px - e.x) ** 2 + (py - e.y) ** 2 > reach && k > 0) break;
        d = Math.max(d, (px - e.x) * e.nx + (py - e.y) * e.ny);
      }
      if (d < -cell * .75 || d >= B) continue;                                  // inside the solid stroke / past the band
      if (V.length > 60000) flush();
      const cov = 1 - Math.pow(Math.min(1, Math.max(0, d / B)), HALFTONE_FALL);   // ink share of this cell: 1 at the edge → 0 outside
      const e = L[i0];
      if (cov > .995) {                                                        // full ink: a plain square
        const q = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([u, v]) => { const w = toW(px, py, u, v); return add(w[0], w[1], e.z, 0, 0, 1, e.t, 1); });
        F.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
        continue;
      }
      if (cov >= .5) {
        // dark half (Euclidean screen): the paper shows as quarter circles in the cell's four corners (paper area
        // 1 − cov). Paper at the corners breaks every cell edge, so where the dark half meets the dots there is
        // no continuous ink border left to read as a line along the stroke.
        const r = Math.min(.5, Math.sqrt((1 - cov) / Math.PI)), base = V.length, cw = toW(px, py, 0, 0), A = 5;
        add(cw[0], cw[1], e.z, 0, 0, 1, e.t, 1);
        for (const [cx, cy, t0] of [[.5, -.5, Math.PI], [.5, .5, 1.5 * Math.PI], [-.5, .5, 2 * Math.PI], [-.5, -.5, .5 * Math.PI]]) {
          for (let k = 0; k <= A; k++) { const th = t0 - k / A * Math.PI / 2, w = toW(px, py, cx + r * Math.cos(th), cy + r * Math.sin(th)); add(w[0], w[1], e.z, 0, 0, 1, e.t, 1); }
        }
        const nr = 4 * (A + 1);
        for (let k = 0; k < nr; k++) F.push([base, base + 1 + k, base + 1 + (k + 1) % nr]);
      } else {
        // light half, further out: a round ink dot, dot area = cov; the dots shrink away from the stroke
        const r = Math.sqrt(cov / Math.PI); if (r < .03) continue;
        const rr = r < .22 ? ray8 : ray, base = V.length, cw = toW(px, py, 0, 0);
        add(cw[0], cw[1], e.z, 0, 0, 1, e.t, 1);
        for (const [c, s] of rr) { const w = toW(px, py, c * r, s * r); add(w[0], w[1], e.z, 0, 0, 1, e.t, 1); }
        const nr = rr.length;
        for (let k = 0; k < nr; k++) F.push([base, base + 1 + k, base + 1 + (k + 1) % nr]);
      }
    }
    flush();
    return chunks;
  }

  // ------------------------------------------------------------ PATTERN BRUSH (like Illustrator's Pattern Brush)
  // Five tiles, each an SVG drawn as its own artwork (the whole viewBox counts, empty margins included):
  //   side   – repeats along every side and round smooth curves, at its own proportions (never stretched over the stroke)
  //   outer  – the corner where the path turns AWAY from the tile's top: drawn as the top-right corner of a frame whose
  //            side tile runs left→right with its top outside — the side comes in through the LEFT edge and leaves
  //            through the BOTTOM edge
  //   inner  – the corner where the path turns TOWARD the top: comes in through the LEFT edge, leaves through the TOP
  //   start / end – optional caps of an open path
  // Tile "top" (v = 1) is the +normal side of the skeleton. Without a corner tile, the side tiles meet on the corner's
  // bisector (mitre). Fit per side: stretch (tiles eased to end exactly at the corners), space (tiles keep their
  // size, the slack becomes even gaps) or approx (tiles keep their size and spacing, centred; may be a hair short/long).
  // All tiles share one texture atlas, so the shader still samples a single mask.
  const PATTERN_CORNER = 32 * Math.PI / 180;    // a turn sharper than this is a corner
  const PATTERN_MIN_W = .09;                     // narrowest band an uploaded pattern brush is drawn at
  const PT_SLOTS = ['side', 'outer', 'inner', 'start', 'end'];
  const PT = { side: null, outer: null, inner: null, start: null, end: null };   // { canvas, aspect, name }
  let ptAtlas = null, ptUV = {};

  // render an SVG exactly as drawn, over its full viewBox, into a white + alpha canvas
  function renderTileSVG(text) {
    return new Promise(resolve => {
      text = (text || '').trim();
      if (!/<svg[\s>]/i.test(text)) return resolve({ ok: false, msg: 'Upload or paste a whole SVG file.' });
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) return resolve({ ok: false, msg: 'This SVG could not be parsed. Re-export it as plain SVG.' });
      let vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (vb.length !== 4 || vb.some(isNaN)) vb = [0, 0, parseFloat(svg.getAttribute('width')) || 512, parseFloat(svg.getAttribute('height')) || 512];
      const k = 1024 / Math.max(vb[2], vb[3]), W = Math.max(8, Math.round(vb[2] * k)), H = Math.max(8, Math.round(vb[3] * k));
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', vb.join(' '));
      svg.setAttribute('preserveAspectRatio', 'none');
      const img = new Image();
      img.onerror = () => resolve({ ok: false, msg: 'The browser could not draw this SVG. Try re-saving it as SVG 1.1.' });
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H), px = d.data; let seen = 0;
        for (let i = 0; i < px.length; i += 4) { px[i] = px[i + 1] = px[i + 2] = 255; if (px[i + 3] > 127) seen++; }
        if (!seen) return resolve({ ok: false, msg: 'Nothing visible was found in this SVG.' });
        g.putImageData(d, 0, 0);
        resolve({ ok: true, canvas: c, aspect: W / H });
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    });
  }

  // all tiles side by side in one texture; ptUV[slot] = [u0, u1] inside it
  function buildAtlas() {
    const tiles = PT_SLOTS.map(k => [k, PT[k] || (k === 'side' && tipCanvas ? { canvas: tipCanvas, aspect: tipAspect } : null)]).filter(t => t[1]);
    ptUV = {}; if (!tiles.length) { ptAtlas = null; return; }
    const pad = 8, sumA = tiles.reduce((a, [, t]) => a + Math.max(.05, t.aspect), 0);
    const H = Math.max(64, Math.min(512, Math.floor((8000 - pad * (tiles.length + 1)) / sumA)));
    const ws = tiles.map(([, t]) => Math.max(8, Math.round(H * Math.max(.05, t.aspect))));
    const AW = ws.reduce((a, w) => a + w + pad, pad), c = document.createElement('canvas'); c.width = AW; c.height = H;
    const g = c.getContext('2d'); let x = pad;
    tiles.forEach(([k, t], i) => { g.drawImage(t.canvas, x, 0, ws[i], H); ptUV[k] = [(x + .5) / AW, (x + ws[i] - .5) / AW]; x += ws[i] + pad; });
    const im = createImage(AW, H); im.drawingContext.drawImage(c, 0, 0); if (im.setModified) im.setModified(true);
    ptAtlas = im;
  }
  async function loadPatternTile(slot, text) {
    if (!PT_SLOTS.includes(slot)) return { ok: false, msg: 'Unknown tile.' };
    const r = await renderTileSVG(text); if (!r.ok) return r;
    PT[slot] = { canvas: r.canvas, aspect: r.aspect };
    if (slot === 'side') { tipCanvas = r.canvas; tipAspect = r.aspect; tipName = 'upload'; }
    buildAtlas();
    return { ok: true, msg: `${slot === 'side' ? 'Side' : slot[0].toUpperCase() + slot.slice(1)} tile loaded · ${r.canvas.width}×${r.canvas.height}px` };
  }
  function clearPatternTile(slot) { PT[slot] = null; buildAtlas(); }
  function patternTiles() { const o = {}; PT_SLOTS.forEach(k => o[k] = !!PT[k] || (k === 'side' && !!tipCanvas)); return o; }
  function hasPattern() { return !!(PT.side || tipCanvas); }
  function maskFor(P) {
    if (P.brush !== 'custom') return null;
    if (P.tipMode === 'pattern') { if (!ptAtlas && hasPattern()) buildAtlas(); return ptAtlas; }
    return tipMask;
  }

  function patternGeometry(S, P, strokes) {
    if (!ptAtlas) buildAtlas();
    // an uploaded brush needs room to read: thin-line styles (chevrons, barbs) still give it a usable band
    const sc = P.patternScale || 1, W = Math.max(P.width, PATTERN_MIN_W) * sc, half = W / 2;
    const aspectOf = k => PT[k] ? PT[k].aspect : (k === 'side' ? tipAspect : 1);
    const tileLen = Math.max(.01, W * aspectOf('side')), gapLen = tileLen * Math.max(-.9, P.patternSpacing || 0);   // < 0: tiles overlap (interlocking artwork)
    const fit = P.patternFit || 'stretch', has = k => !!ptUV[k];
    const uvOf = k => ptUV[k] || ptUV.side || [0, 1];
    // corner method per corner type: Illustrator's auto corners, or the user's own corner tile (falls back to sliced)
    const methodOf = outer => { const m = (outer ? P.patternOuter : P.patternInner) || 'sliced'; return m === 'custom' && !has(outer ? 'outer' : 'inner') ? 'sliced' : m; };
    const g = new p5.Geometry(1, 1, function () {
      const V = this.vertices, N = this.vertexNormals, U = this.uvs, F = this.faces;
      const add = (x, y, u, v) => { V.push(new p5.Vector(x, y, .5)); N.push(new p5.Vector(0, 0, 1)); U.push(u, v); };
      for (const [ua, ub] of strokes) {
        const span = ub - ua, full = S.closed && Math.abs(span) >= .999;
        const M = Math.max(16, Math.round(Math.abs(span) * S.n));
        let pts = [];
        for (let i = 0; i < (full ? M : M + 1); i++) { const p = sampleSpine(S, ua + span * i / M); pts.push([p.x, p.y, p.nx, p.ny]); }
        const n = pts.length, at = i => pts[full ? ((i % n) + n) % n : clamp(i, 0, n - 1)];
        // ---- path analysis: corners = sharp turns (local maxima); smooth curves and straight runs are left to the side tiles
        const turn = [];
        for (let i = 0; i < n; i++) {
          if (!full && (i < 2 || i > n - 3)) { turn.push(0); continue; }
          const a = at(i - 2), b = at(i), c = at(i + 2);
          const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
          let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d; turn.push(d);
        }
        const corners = [];
        for (let i = 0; i < n; i++) {
          if (turn[i] < PATTERN_CORNER) continue;
          let isMax = true; for (let k = -3; k <= 3; k++) if (k && turn[full ? (i + k + n) % n : clamp(i + k, 0, n - 1)] > turn[i]) isMax = false;
          if (isMax && !corners.some(c => Math.abs(c - i) < 4)) corners.push(i);
        }
        let cuts;
        if (full) {
          if (corners.length) { const c0 = corners[0]; pts = pts.slice(c0).concat(pts.slice(0, c0)); cuts = corners.map(c => c - c0).concat([n]); pts.push(pts[0]); }
          else { cuts = [0, n]; pts.push(pts[0]); }
        } else cuts = [0].concat(corners, [n - 1]);
        const isCorner = ci => full ? corners.length > 0 : (ci > 0 && ci < cuts.length - 1);
        // ---- straight sides: the skeleton is sampled smoothly, so its corners come out a little rounded. A side that
        // is straight in its middle is rebuilt as a true straight line, and its corners become the exact intersection
        // of the neighbouring lines, so tiles sit square on the side and corner tiles land on the real corner.
        const NS = cuts.length - 1, SEG = [], LINE = [];
        for (let si = 0; si < NS; si++) {
          const seg = pts.slice(cuts[si], cuts[si + 1] + 1); SEG.push(seg); let line = null;
          if (seg.length >= 6) {
            const a = seg[Math.floor(seg.length * .15)], b = seg[Math.ceil(seg.length * .85) - 1];
            const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
            if (l > 1e-4) {
              const d = [dx / l, dy / l]; let dev = 0;
              for (let i = Math.floor(seg.length * .15); i < Math.ceil(seg.length * .85); i++) dev = Math.max(dev, Math.abs((seg[i][0] - a[0]) * d[1] - (seg[i][1] - a[1]) * d[0]));
              if (dev < l * .012 + 1e-4) line = { p: a, d };
            }
          }
          LINE.push(line);
        }
        const inter = (A, B) => { const cr = A.d[0] * B.d[1] - A.d[1] * B.d[0]; if (Math.abs(cr) < .05) return null; const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / cr; return [A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]; };
        const proj = (L, q) => { const t = (q[0] - L.p[0]) * L.d[0] + (q[1] - L.p[1]) * L.d[1]; return [L.p[0] + L.d[0] * t, L.p[1] + L.d[1] * t]; };
        const sidePrev = ci => ci > 0 ? ci - 1 : (full ? NS - 1 : -1), sideNext = ci => ci < NS ? ci : (full ? 0 : -1);
        const CP = cuts.map((j, ci) => {
          const A = LINE[sidePrev(ci)], B = LINE[sideNext(ci)];
          if (A && B && isCorner(ci)) { const x = inter(A, B); if (x) return x; }
          if (!isCorner(ci)) { if (B && ci === 0) return proj(B, pts[j]); if (A && ci === NS) return proj(A, pts[j]); }
          return [pts[j][0], pts[j][1]];
        });
        for (let si = 0; si < NS; si++) if (LINE[si]) {
          const A = CP[si], B = CP[si + 1], m = SEG[si][SEG[si].length >> 1], K = Math.max(8, SEG[si].length);
          SEG[si] = Array.from({ length: K }, (_, i) => [mix(A[0], B[0], i / (K - 1)), mix(A[1], B[1], i / (K - 1)), m[2], m[3]]);
        }
        const P_ = i => pts[clamp(i, 0, pts.length - 1)];
        const dir = (i0, i1) => { const a = P_(i0), b = P_(i1); const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
        // ---- corner geometry. Tile top (v = 1) is the +spine-normal side. The two offset lines (±half) of the sides
        // meet on the bisector at the two mitre points; `a` is how far from the corner the square-cut sides stop.
        const cornerInfo = ci => {
          const j = cuts[ci], sp = pts[j], o = CP[ci], LA = LINE[sidePrev(ci)], LB = LINE[sideNext(ci)];
          const t1 = LA ? LA.d : (full && j === 0 ? dir(pts.length - 4, pts.length - 1) : dir(j - 3, j)), t2 = LB ? LB.d : dir(j, j + 3);
          let n1 = [t1[1], -t1[0]]; const sg = (n1[0] * sp[2] + n1[1] * sp[3]) < 0 ? -1 : 1;
          n1 = [n1[0] * sg, n1[1] * sg]; const n2 = [t2[1] * sg, -t2[0] * sg];
          const th = Math.min(2.6, Math.acos(clamp(t1[0] * t2[0] + t1[1] * t2[1], -1, 1)));
          const outer = n1[0] * (t2[0] - t1[0]) + n1[1] * (t2[1] - t1[1]) < 0;   // turning away from the top: the top edge is convex
          const slot = outer ? 'outer' : 'inner', method = methodOf(outer), a = half * Math.tan(th / 2);
          let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1, mk = half / Math.max(.2, Math.cos(th / 2));
          mx = mx / ml * mk; my = my / ml * mk;
          // sliced / overlap between two straight sides: each side's tile run simply carries on into the corner and is
          // cut there (on the bisector for sliced, square past the far edge for overlap) — the artwork stays whole
          const clip = !!(LA && LB) && (method === 'sliced' || method === 'overlap');
          const reserve = clip || method === 'between' ? 0 : method === 'centered' ? Math.max(a, tileLen / 2) : a;
          return { o, t1, t2, n1, n2, th, outer, slot, method, a, reserve, clip, mitTop: [o[0] + mx, o[1] + my], mitBot: [o[0] - mx, o[1] - my] };
        };
        const CI = cuts.map((_, ci) => isCorner(ci) ? cornerInfo(ci) : null);
        if (full && CI.length) CI[CI.length - 1] = CI[0];
        // ---- a run of rows {b: bottom point, t: top point, u}; consecutive rows become quads (subdivided so the
        // texture stays even on trapezoids such as mitred ends)
        const rowsOut = rows => {
          for (let r = 0; r < rows.length - 1; r++) {
            const A = rows[r], B = rows[r + 1], K = 4, base = V.length;
            for (let k = 0; k <= K; k++) {
              const f = k / K, u = mix(A.u, B.u, f);
              add(mix(A.b[0], B.b[0], f), mix(A.b[1], B.b[1], f), u, 0); add(mix(A.t[0], B.t[0], f), mix(A.t[1], B.t[1], f), u, 1);
            }
            for (let k = 0; k < K; k++) { const q = base + k * 2; F.push([q, q + 2, q + 1], [q + 2, q + 3, q + 1]); }
          }
        };
        const off = (p, t, d, n, h) => [p[0] + t[0] * d + n[0] * h, p[1] + t[1] * d + n[1] * h];
        const row = (p, t, d, n, u) => ({ b: off(p, t, d, n, -half), t: off(p, t, d, n, half), u });
        const slotU = (k, f) => { const [u0, u1] = uvOf(k); return mix(u0, u1, clamp(f, 0, 1)); };
        // ---- the corner itself, by method (Illustrator's corner options)
        const cornerOut = C => {
          const { o, t1, t2, n1, n2, a } = C, mit = { b: C.mitBot, t: C.mitTop };
          if (C.clip) return;   // drawn by the two sides themselves (clipped tile runs)
          if (C.method === 'custom') {
            // the user's corner square: incoming cut on its left edge, the outgoing cut on its bottom (outer) / top (inner) edge
            const c1 = row(o, t1, -a, n1, 0), c2 = row(o, t2, a, n2, 0);
            const Q00 = c1.b, Q01 = c1.t, Q11 = C.outer ? C.mitTop : c2.b, Q10 = C.outer ? c2.t : C.mitBot;
            const [u0, u1] = uvOf(C.slot), G = 8, base = V.length;
            for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) {
              const uu = i / G, vv = j / G, w00 = (1 - uu) * (1 - vv), w10 = uu * (1 - vv), w01 = (1 - uu) * vv, w11 = uu * vv;
              add(w00 * Q00[0] + w10 * Q10[0] + w01 * Q01[0] + w11 * Q11[0], w00 * Q00[1] + w10 * Q10[1] + w01 * Q01[1] + w11 * Q11[1], mix(u0, u1, uu), vv);
            }
            for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const q = base + i * (G + 1) + j, r = q + G + 1; F.push([q, r, q + 1], [r, r + 1, q + 1]); }
          } else if (C.method === 'sliced') {
            // a slice of the side tile, cut on the bisector like a mitred picture frame: the incoming half carries on
            // from where the last tile ended (tile start), the outgoing half leads into the next tile (tile end)
            const f = a / tileLen;
            rowsOut([row(o, t1, -a, n1, slotU('side', 0)), Object.assign({ u: slotU('side', f) }, mit)]);
            rowsOut([Object.assign({ u: slotU('side', 1 - f) }, mit), row(o, t2, a, n2, slotU('side', 1))]);
          } else if (C.method === 'centered') {
            // one side tile centred on the corner, folded on the bisector
            const r = C.reserve;
            rowsOut([row(o, t1, -r, n1, slotU('side', 0)), Object.assign({ u: slotU('side', .5) }, mit)]);
            rowsOut([Object.assign({ u: slotU('side', .5) }, mit), row(o, t2, r, n2, slotU('side', 1))]);
          } else if (C.method === 'overlap') {
            // both sides run straight on past the corner to the far edge and overlap there
            const e = Math.min(1, (a + half) / tileLen);
            rowsOut([row(o, t1, -a, n1, slotU('side', 0)), row(o, t1, half, n1, slotU('side', e))]);
            rowsOut([row(o, t2, -half, n2, slotU('side', 1 - e)), row(o, t2, a, n2, slotU('side', 1))]);
          }
          // 'between': nothing here — the side tiles run all the way into the corner and are folded on the bisector
        };
        for (let si = 0; si < NS; si++) {
          const seg = SEG[si];
          if (seg.length < 2) continue;
          const Ls = [0]; for (let i = 1; i < seg.length; i++) Ls.push(Ls[i - 1] + Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]));
          const len = Ls[Ls.length - 1]; if (len < 1e-4) continue;
          const sideN = i => {
            const a = seg[Math.max(0, i - 2)], b = seg[Math.min(seg.length - 1, i + 2)];
            let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; let nx = ty / l, ny = -tx / l;
            if (nx * seg[i][2] + ny * seg[i][3] < 0) { nx = -nx; ny = -ny; } return [nx, ny];
          };
          const cA = CI[si], cB = CI[si + 1], foldA = cA && cA.method === 'between', foldB = cB && cB.method === 'between';
          const rA = cA ? cA.reserve : 0, rB = cB ? cB.reserve : 0;
          const capA = !full && si === 0 && has('start'), capB = !full && si === NS - 1 && has('end');
          const lenA = capA ? W * aspectOf('start') : 0, lenB = capB ? W * aspectOf('end') : 0;
          const posAt = d => {   // point on the side at arc length d, with the half-width offset vector
            let i = 1; while (i < Ls.length - 1 && Ls[i] < d) i++;
            const t = clamp((d - Ls[i - 1]) / ((Ls[i] - Ls[i - 1]) || 1), 0, 1), a = seg[i - 1], b = seg[i];
            const nn = sideN(t < .5 ? i - 1 : i);
            return [mix(a[0], b[0], t), mix(a[1], b[1], t), nn[0] * half, nn[1] * half];
          };
          // one tile from d0 to d1: straight sides are single quads (ends folded onto the mitre at a 'between' corner),
          // curved sides follow the curve in short rows
          const tileOut = (d0, d1, slot) => {
            const rows = [], straight = !!LINE[si], steps = straight ? 1 : Math.max(2, Math.ceil((d1 - d0) / (W * .25)));
            for (let r = 0; r <= steps; r++) {
              const d = mix(d0, d1, r / steps), u = slotU(slot, r / steps);
              if (r === 0 && foldA && d <= 1e-6) { rows.push({ b: cA.mitBot, t: cA.mitTop, u }); continue; }
              if (r === steps && foldB && d >= len - 1e-6) { rows.push({ b: cB.mitBot, t: cB.mitTop, u }); continue; }
              const [x, y, ox, oy] = posAt(d); rows.push({ b: [x - ox, y - oy], t: [x + ox, y + oy], u });
            }
            rowsOut(rows);
          };
          // straight side meeting a clipped corner: tiles are cut by lines in (d, v) space — d along the side, v across
          const straight = !!LINE[si], T0 = seg[0], TE = seg[seg.length - 1];
          const tl0 = Math.hypot(TE[0] - T0[0], TE[1] - T0[1]) || 1, tv = [(TE[0] - T0[0]) / tl0, (TE[1] - T0[1]) / tl0], nv = sideN(0);
          const dOf = q => (q[0] - T0[0]) * tv[0] + (q[1] - T0[1]) * tv[1];
          const lin = (a0, a1) => v => a0 + (a1 - a0) * v;
          const lo = straight && cA && cA.clip ? (cA.method === 'sliced' ? lin(dOf(cA.mitBot), dOf(cA.mitTop)) : () => -half) : null;
          const hi = straight && cB && cB.clip ? (cB.method === 'sliced' ? lin(dOf(cB.mitBot), dOf(cB.mitTop)) : () => len + half) : null;
          const at = (d, v) => [T0[0] + tv[0] * d + nv[0] * (v - .5) * W, T0[1] + tv[1] * d + nv[1] * (v - .5) * W];
          const clipTile = (d0, d1, slot) => {
            const L_ = v => Math.max(d0, lo ? lo(v) : -1e9), R_ = v => Math.min(d1, hi ? hi(v) : 1e9);
            const vs = [0, 1];
            for (const f of [lo, hi]) if (f) { const f0 = f(0), f1 = f(1); if (Math.abs(f1 - f0) > 1e-9) for (const d of [d0, d1]) { const v = (d - f0) / (f1 - f0); if (v > 1e-6 && v < 1 - 1e-6) vs.push(v); } }
            vs.sort((x, y) => x - y);
            const uo = d => slotU(slot, (d - d0) / ((d1 - d0) || 1));
            for (let i = 0; i < vs.length - 1; i++) {
              const va = vs[i], vb = vs[i + 1], vm = (va + vb) / 2; if (vb - va < 1e-6 || R_(vm) <= L_(vm)) continue;
              const la = L_(va), ra = Math.max(la, R_(va)), lb = L_(vb), rb = Math.max(lb, R_(vb)), base = V.length;
              for (const [d, v] of [[la, va], [ra, va], [rb, vb], [lb, vb]]) { const p = at(d, v); add(p[0], p[1], uo(d), v); }
              F.push([base, base + 1, base + 2], [base, base + 2, base + 3]);
            }
          };
          const dA = rA, dB = len - rB;
          if (capA) tileOut(dA, dA + lenA, 'start');
          if (capB) tileOut(dB - lenB, dB, 'end');
          const s0 = dA + lenA, s1 = dB - lenB, L = s1 - s0;
          if (L > W * .02) {
            let count, tl, gp, o0 = 0;
            if (fit === 'space') {          // tiles keep their size; the slack becomes even gaps
              count = Math.max(1, Math.floor((L + gapLen) / (tileLen + gapLen)));
              tl = Math.min(tileLen, L);
              if (count > 1) gp = (L - tl) / (count - 1) - tl; else { gp = 0; o0 = (L - tl) / 2; }   // first tile at the start, last at the end
            } else if (fit === 'approx') {  // tiles keep size and spacing, centred on the side
              count = Math.max(1, Math.round((L + gapLen) / (tileLen + gapLen)));
              tl = tileLen; gp = gapLen; o0 = (L - (count * tl + (count - 1) * gp)) / 2;
            } else {                         // stretch: a whole number of tiles, eased to end exactly at the corners
              count = Math.max(1, Math.round((L + gapLen) / (tileLen + gapLen)));
              const k = (L + gapLen) / (count * (tileLen + gapLen)); tl = tileLen * k; gp = gapLen * k;
            }
            if (lo || hi) {
              // carry the run on past each clipped end until the corner is covered, then cut every tile to the corner
              const step = tl + gp, minLo = lo ? Math.min(lo(0), lo(1)) : 0, maxHi = hi ? Math.max(hi(0), hi(1)) : 0;
              let k0 = 0, k1 = count - 1;
              if (lo) while (k0 > -40 && s0 + o0 + (k0 - 1) * step + tl > minLo) k0--;
              if (hi) while (k1 < count + 40 && s0 + o0 + (k1 + 1) * step < maxHi) k1++;
              for (let k = k0; k <= k1; k++) { const d0 = s0 + o0 + k * step; clipTile(d0, d0 + tl, 'side'); }
            } else
            for (let k = 0; k < count; k++) { const d0 = s0 + o0 + k * (tl + gp); tileOut(d0, d0 + tl, 'side'); }
          }
        }
        // corner pieces last, on top of the sides they join
        const seen = new Set();
        CI.forEach(C => { if (C && !seen.has(C)) { seen.add(C); cornerOut(C); } });
      }
    });
    g.gid = 'sb-pattern-' + (gid++);
    return g;
  }

  function layerGeometry(S, P, layerIndex, seed) {
    let k = Math.max(1, Math.round(P.strokes));
    const strokes = [];
    const r = n => hash(seed * 3.17 + n * 1.71, P.seed);
    // CHAIN: each layer's stroke runs from its own start, back into the tunnel, and ends exactly where the
    // next deeper layer's stroke begins (tail meets head) — one continuous vortex built from separate strokes.
    const chain = isChained(P, S);
    let cov, start, stride, segLen;
    if (chain) {
      const L = chainLink(P);
      k = 1; cov = L.cov; start = L.drift * layerIndex; stride = cov; segLen = cov;
      strokes.push([start, start + cov, seed * 7]);
    } else {
      cov = clamp(P.coverage + (r(1) - .5) * P.covJitter, .04, 1);
      start = P.startDrift * layerIndex + (r(2) - .5) * P.startJitter;
      stride = cov / k; segLen = stride * (1 - (k > 1 || cov < 1 ? P.gap : 0)) || stride;
      for (let j = 0; j < k; j++) {
        let ua, ub;
        if (S.closed) { ua = start - cov / 2 + j * stride + (r(10 + j) - .5) * P.startJitter * .3; ub = ua + (k === 1 && cov >= .999 ? 1 : segLen); }
        else { const off = clamp(start % 1, 0, 1 - cov); ua = off + j * stride; ub = ua + segLen; }
        strokes.push([ua, ub, seed * 7 + j]);
      }
    }
    const B = P;
    const useTip = false;
    const W = P.width;
    const masked = P.brush === 'custom' && (P.tipMode === 'pattern' ? hasPattern() : !!tipMask);
    if (masked && P.tipMode === 'stamp') return stampGeometry(S, P, strokes, start, stride);
    if (masked && P.tipMode === 'pattern') return patternGeometry(S, P, P.skeleton === 'rect' ? [[0, 1]] : strokes);
    const ribbons = P.skeleton === 'rect' ? rectRibbons(P, seed) : strokes.map(([ua, ub, s]) => {
      const span = ub - ua, M = Math.max(24, Math.round(Math.abs(span) * (S.closed ? 360 : 300)));
      const rows = [];
      for (let i = 0; i <= M; i++) {
        const t = i / M, u = ua + span * t, p = sampleSpine(S, u);
        const wob = P.wobble ? (noise1(u * 9 + s, s + 3) * .7 + noise1(u * 23 + s, s + 5) * .3) * P.wobble : 0;
        const bx = p.x + p.nx * wob, by = p.y + p.ny * wob;
        const [lo, hi] = masked ? profile(Object.assign({}, B, { flareIn: 0, flareOut: 0, stepAmp: 0, bias: 0 }), t, s, p.ang, false) : profile(B, t, s, p.ang, useTip);
        // the halftone grows from the stroke's smooth edge (no chisel step / hook), so it never jumps out with them
        const [slo, shi] = P.halftone > 0 && !masked ? profile(Object.assign({}, B, { flareIn: 0, flareOut: 0, stepAmp: 0 }), t, s, p.ang, useTip) : [lo, hi];
        rows.push({ zf: chain ? -t * P.spacing : .5, t, ix: bx + p.nx * lo * W, iy: by + p.ny * lo * W, ox: bx + p.nx * hi * W, oy: by + p.ny * hi * W, nx: p.nx, ny: p.ny,
          six: bx + p.nx * slo * W, siy: by + p.ny * slo * W, sox: bx + p.nx * shi * W, soy: by + p.ny * shi * W });
      }
      return rows;
    });
    // halftone dissolves the brush itself: the stroke's outer part (step and hook included) is taken away and
    // rebuilt as halftone cells, so there is no solid brush edge left inside the screen — ink → holes → dots
    let htIn = 0;
    if (P.halftone > 0 && !masked) {
      htIn = Math.min(P.halftone * P.width * .45, P.width * .55);
      for (const rows of ribbons) for (const R of rows) {
        const sx = R.sox ?? R.ox, sy = R.soy ?? R.oy, ix = R.six ?? R.ix, iy = R.siy ?? R.iy;
        const wl = (sx - ix) * R.nx + (sy - iy) * R.ny, keep = Math.max(wl * .3, wl - htIn);
        R.ox = ix + R.nx * keep; R.oy = iy + R.ny * keep; R.sox = R.ox; R.soy = R.oy;
      }
    }
    if (masked && P.tipMode === 'scatter') return scatterGeometry(ribbons, P, seed);

    const g = new p5.Geometry(1, 1, function () {
      const V = this.vertices, N = this.vertexNormals, U = this.uvs, F = this.faces;
      const add = (x, y, z, nx, ny, nz, u, v) => { V.push(new p5.Vector(x, y, z)); N.push(new p5.Vector(nx, ny, nz)); U.push(u, v); return V.length - 1; };
      const extrude = P.length > 1 && !masked;   // a masked tip is a flat cut-out
      // walls first (drawn underneath), then the brush face on top
      if (extrude) for (const rows of ribbons) {
        for (const side of ['o', 'i']) {
          const base = V.length;
          for (const R of rows) {
            const x = side === 'o' ? R.ox : R.ix, y = side === 'o' ? R.oy : R.iy, sg = side === 'o' ? 1 : -1, v = side === 'o' ? 1 : 0;
            add(x, y, R.zf, R.nx * sg, R.ny * sg, 0, R.t + 2, v);
            add(x, y, chain ? R.zf - P.length : -.5, R.nx * sg, R.ny * sg, 0, R.t + 2, v);
          }
          for (let i = 0; i < rows.length - 1; i++) { const a = base + i * 2; F.push([a, a + 2, a + 1], [a + 2, a + 3, a + 1]); }
        }
      }
      for (const rows of ribbons) {
        const base = V.length;
        for (const R of rows) { add(R.ix, R.iy, R.zf, 0, 0, 1, R.t, 0); add(R.ox, R.oy, R.zf, 0, 0, 1, R.t, 1); }
        for (let i = 0; i < rows.length - 1; i++) { const a = base + i * 2; F.push([a, a + 2, a + 1], [a + 2, a + 3, a + 1]); }
      }
    });
    g.gid = 'sb-brush-' + (gid++);
    g.extra = P.halftone > 0 && !masked ? halftoneDots(ribbons, P, htIn) : [];
    g.worldZ = chain;   // chained strokes carry real depth (world units) instead of a unit extrusion
    return g;
  }

  // Stamp: the uploaded artwork, unchanged, as a flat cut-out.
  //   centre – centred on the portal axis and turned by the stroke's start angle (concentric portal, like the brand assets)
  //   along  – placed on the skeleton at each stroke, turned to follow it
  function stampGeometry(S, P, strokes, start, stride) {
    const g = new p5.Geometry(1, 1, function () {
      const V = this.vertices, N = this.vertexNormals, U = this.uvs, F = this.faces;
      for (const [ua, ub] of strokes) {
        let cx = 0, cy = 0, ang, w, h;
        if (P.stampPlace === 'along') {
          const p = sampleSpine(S, (ua + ub) / 2);
          cx = p.x; cy = p.y; ang = p.ang; w = P.stampSize; h = w / tipAspect;
        } else {
          ang = T * ((ua + ub) / 2);
          if (tipFit && P.stampPivot === 'auto') { w = P.stampSize / tipFit.r; h = w / tipAspect; }   // the curve lands on a ring of radius stampSize
          else { w = 2 * P.stampSize; h = w / tipAspect; }
        }
        // pivot inside the artwork that sits on the portal axis (centre mode) or on the skeleton (along)
        const usePivot = P.stampPlace !== 'along' && tipFit && P.stampPivot === 'auto';
        const bottom = P.stampPlace !== 'along' && P.stampPivot === 'bottom';
        const px = usePivot ? tipFit.px : .5, py = usePivot ? tipFit.py : bottom ? 1 : .5;
        const L = -px * w, R = (1 - px) * w, Tp = -py * h, Bt = (1 - py) * h;
        const co = Math.cos(ang), si = Math.sin(ang), base = V.length;
        // corners: top-left first … uv.y = 1 at the top edge (shader samples the image at 1 - uv.y)
        for (const [lx, ly, u, v] of [[L, Tp, 0, 1], [R, Tp, 1, 1], [L, Bt, 0, 0], [R, Bt, 1, 0]]) {
          V.push(new p5.Vector(cx + lx * co - ly * si, cy + lx * si + ly * co, .5)); N.push(new p5.Vector(0, 0, 1)); U.push(u, v);
        }
        F.push([base, base + 1, base + 2], [base + 1, base + 3, base + 2]);
      }
    });
    g.gid = 'sb-stamp-' + (gid++);
    return g;
  }

  // Render the SVG the way a browser shows it, then turn what is painted into an alpha mask.
  function loadTipRaster(text) {
    return new Promise(resolve => {
      text = (text || '').trim();
      if (!/<svg[\s>]/i.test(text)) return resolve({ ok: false, msg: 'Upload or paste a whole SVG file for the brush tip.' });
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) return resolve({ ok: false, msg: 'This SVG could not be parsed. Re-export it as plain SVG.' });
      let vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (vb.length !== 4 || vb.some(isNaN)) vb = [0, 0, parseFloat(svg.getAttribute('width')) || 512, parseFloat(svg.getAttribute('height')) || 512];
      const LONG = 2048, k = LONG / Math.max(vb[2], vb[3]);
      const W = Math.max(8, Math.round(vb[2] * k)), H = Math.max(8, Math.round(vb[3] * k));
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', vb.join(' '));
      const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      const img = new Image();
      img.onerror = () => resolve({ ok: false, msg: 'The browser could not draw this SVG. Try re-saving it from Illustrator as SVG 1.1.' });
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
        const r = maskFromCanvas(c, true);
        if (!r.ok) return resolve(r);
        tipName = 'upload';
        resolve({ ok: true, msg: `Brush tip loaded exactly as drawn · ${r.cw}×${r.ch}px${r.opaqueBg ? ' · background colour removed' : ''}${tipFit ? ' · curve centre found, layers stay concentric' : ''}.` });
      };
      img.src = src;
    });
  }

  // Turn whatever is painted on a canvas into the brush-tip mask (crop, curve fit, p5 image).
  function maskFromCanvas(c, keyBg) {
    {
      {
        const W = c.width, H = c.height, g = c.getContext('2d', { willReadFrequently: true });
        const d = g.getImageData(0, 0, W, H), px = d.data;
        // a solid background (all four corners opaque and alike) is keyed out by colour
        const at = (x, y) => (y * W + x) * 4, cs = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
        const opaqueBg = keyBg && cs.every(i => px[i + 3] > 250) && cs.every(i => Math.abs(px[i] - px[cs[0]]) + Math.abs(px[i + 1] - px[cs[0] + 1]) + Math.abs(px[i + 2] - px[cs[0] + 2]) < 30);
        const br = px[cs[0]], bg = px[cs[0] + 1], bb = px[cs[0] + 2];
        let x0 = W, x1 = -1, y0 = H, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = at(x, y);
          let a = px[i + 3];
          if (opaqueBg) a = Math.min(255, (Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb)) * 3);
          px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = a;
          if (a > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) return { ok: false, msg: 'Nothing visible was found in this SVG.' };
        g.putImageData(d, 0, 0);
        const pad = 2, cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2;
        const crop = document.createElement('canvas'); crop.width = cw; crop.height = ch;
        crop.getContext('2d').drawImage(c, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch);
        tipCanvas = crop; tipAspect = cw / ch;
        // fit a circle to the top edge of the painted area (Kasa least squares) to find the curve's centre
        tipFit = null;
        {
          const cd = crop.getContext('2d').getImageData(0, 0, cw, ch).data, P = [];
          for (let x = 0; x < cw; x += 3) for (let y = 0; y < ch; y++) if (cd[(y * cw + x) * 4 + 3] > 127) { P.push([x, y]); break; }
          if (P.length > 20) {
            let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sxz = 0, syz = 0; const n = P.length;
            for (const [x, y] of P) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sz += z; sxz += x * z; syz += y * z; }
            // [sxx sxy sx; sxy syy sy; sx sy n] [D E F]^T = -[sxz syz sz]^T
            const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], bv = [-sxz, -syz, -sz];
            const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
            const d0 = det(A);
            if (Math.abs(d0) > 1e-9) {
              const col = (i) => A.map((r, k) => r.map((v, j) => j === i ? bv[k] : v));
              const D = det(col(0)) / d0, E = det(col(1)) / d0, F = det(col(2)) / d0;
              const cx = -D / 2, cy = -E / 2, r = Math.sqrt(Math.max(0, cx * cx + cy * cy - F));
              let err = 0; for (const [x, y] of P) err += Math.abs(Math.hypot(x - cx, y - cy) - r); err /= n;
              if (r > cw * .15 && r < cw * 4 && err < r * .04) tipFit = { px: cx / cw, py: cy / ch, r: r / cw };
            }
          }
        }
        const im = createImage(cw, ch); im.drawingContext.drawImage(crop, 0, 0); if (im.setModified) im.setModified(true);
        if (tipMask && tipMask !== im && typeof tipMask.remove === 'function') { /* old p5.Image is garbage collected */ }
        tipMask = im;
        return { ok: true, cw, ch, opaqueBg };
      }
    }
  }

  // Built-in tip library (for scatter / stamp / art without uploading anything)
  let tipName = null;
  const TIPS = {
    dot:       'Dot',
    diamond:   'Diamond',
    spark:     'Spark ✦',
    star:      'Star',
    leaf:      'Leaf',
    drop:      'Water drop',
    snowflake: 'Snowflake',
    shard:     'Ice shard',
    bolt:      'Lightning bolt',
    flame:     'Flame',
    bat:       'Bat',
  };
  function drawTip(g, name, S) {
    const c = S / 2;
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.lineCap = 'round';
    const poly = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)); g.closePath(); g.fill(); };
    switch (name) {
      case 'dot': g.beginPath(); g.arc(c, c, S * .45, 0, T); g.fill(); break;
      case 'diamond': poly([[.5, .02], [.98, .5], [.5, .98], [.02, .5]]); break;
      case 'spark': { const p = []; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? .1 : .48; p.push([.5 + r * Math.cos(a), .5 + r * Math.sin(a)]); } poly(p); break; }
      case 'star': { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .2 : .48; p.push([.5 + r * Math.cos(a), .5 + r * Math.sin(a)]); } poly(p); break; }
      case 'leaf': g.beginPath(); g.moveTo(S * .02, c); g.quadraticCurveTo(c, S * .08, S * .98, c); g.quadraticCurveTo(c, S * .92, S * .02, c); g.fill(); break;
      case 'drop': g.beginPath(); g.moveTo(c, S * .02); g.bezierCurveTo(S * .58, S * .25, S * .86, S * .45, S * .86, S * .64); g.arc(c, S * .64, S * .36, 0, Math.PI); g.bezierCurveTo(S * .14, S * .45, S * .42, S * .25, c, S * .02); g.fill(); break;
      case 'snowflake': {
        g.lineWidth = S * .06;
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3, ex = c + Math.cos(a) * S * .46, ey = c + Math.sin(a) * S * .46;
          g.beginPath(); g.moveTo(c, c); g.lineTo(ex, ey); g.stroke();
          for (const f of [.55, .78]) {
            const bx = c + Math.cos(a) * S * .46 * f, by = c + Math.sin(a) * S * .46 * f, L = S * .13 * (1.2 - f * .6);
            for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + sg * .8) * L, by + Math.sin(a + sg * .8) * L); g.stroke(); }
          }
        }
        break;
      }
      case 'shard': poly([[.5, .02], [.72, .3], [.62, .98], [.38, .98], [.28, .36]]); break;
      case 'bolt': poly([[.58, .02], [.22, .55], [.47, .55], [.36, .98], [.8, .4], [.54, .4], [.7, .02]]); break;
      case 'flame': g.beginPath(); g.moveTo(c, S * .02); g.bezierCurveTo(S * .62, S * .22, S * .9, S * .4, S * .82, S * .7); g.bezierCurveTo(S * .76, S * .92, S * .6, S * .98, c, S * .98); g.bezierCurveTo(S * .3, S * .98, S * .16, S * .86, S * .18, S * .66); g.bezierCurveTo(S * .2, S * .5, S * .34, S * .44, S * .36, S * .3); g.bezierCurveTo(S * .42, S * .4, S * .44, S * .46, S * .5, S * .48); g.bezierCurveTo(S * .46, S * .32, S * .44, S * .16, c, S * .02); g.fill(); break;
      case 'bat': poly([[.5, .3], [.56, .22], [.58, .32], [.7, .26], [.86, .2], [.99, .36], [.9, .38], [.84, .5], [.74, .46], [.64, .58], [.56, .5], [.5, .7], [.44, .5], [.36, .58], [.26, .46], [.16, .5], [.1, .38], [.01, .36], [.14, .2], [.3, .26], [.42, .32], [.44, .22]]); break;
    }
  }
  function setBuiltinTip(name) {
    if (!TIPS[name]) return false;
    if (tipName === name && tipMask) return true;
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    drawTip(c.getContext('2d'), name, S);
    const r = maskFromCanvas(c, false);
    if (r.ok) tipName = name;
    return r.ok;
  }

  function drawTipPreview(cv) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h); if (!tipCanvas) return;
    const s = Math.min((w - 12) / tipCanvas.width, (h - 12) / tipCanvas.height), dw = tipCanvas.width * s, dh = tipCanvas.height * s;
    const tmp = document.createElement('canvas'); tmp.width = Math.ceil(dw); tmp.height = Math.ceil(dh);
    const tg = tmp.getContext('2d'); tg.drawImage(tipCanvas, 0, 0, dw, dh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#a490ff'; tg.fillRect(0, 0, dw, dh);
    g.drawImage(tmp, (w - dw) / 2, (h - dh) / 2);
  }

  // ------------------------------------------------------------ SVG input
  const SVGNS = 'http://www.w3.org/2000/svg';
  function polylines(text, host) {
    text = (text || '').trim();
    if (!text) return { ok: false, msg: 'Paste SVG code or upload an .svg file first.' };
    if (!/<svg[\s>]/i.test(text)) {
      const m = text.match(/\sd\s*=\s*["']([^"']+)["']/i);
      const d = m ? m[1] : (/^[Mm]/.test(text) ? text : null);
      if (!d) return { ok: false, msg: 'No path found. Paste a whole SVG file or a path like "M0 0 C…".' };
      text = `<svg xmlns="${SVGNS}"><path d="${d.replace(/"/g, '')}"/></svg>`;
    }
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const src = doc.querySelector('svg');
    if (!src || doc.querySelector('parsererror')) return { ok: false, msg: 'This SVG could not be parsed. Re-export it as plain SVG.' };
    host.innerHTML = '';
    const live = document.importNode(src, true);
    live.setAttribute('width', '400'); live.setAttribute('height', '400');
    host.appendChild(live);
    const els = [...live.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')].filter(el => !el.closest('defs,clipPath,mask,symbol,marker,pattern'));
    const out = [];
    for (const el of els) {
      let len = 0; try { len = el.getTotalLength(); } catch (e) { continue; }
      if (!len || !isFinite(len)) continue;
      const ctm = el.getCTM && el.getCTM(), M = Math.max(240, Math.min(4000, Math.round(len / 2))), step = len / M;
      let cur = [], prev = null;
      const flush = () => { if (cur.length >= 8) out.push(cur); cur = []; };
      for (let k = 0; k <= M; k++) {
        const raw = el.getPointAtLength(Math.min(len, k * step));
        if (prev && Math.hypot(raw.x - prev.x, raw.y - prev.y) > step * 6) flush();
        prev = raw;
        const p = ctm ? new DOMPoint(raw.x, raw.y).matrixTransform(ctm) : raw;
        cur.push([p.x, p.y]);
      }
      flush();
    }
    host.innerHTML = '';
    if (!out.length) return { ok: false, msg: 'No usable paths found. Convert text and strokes to outlines, then export again.' };
    const info = out.map(pts => {
      let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const a = pts[0], b = pts[pts.length - 1], closed = Math.hypot(a[0] - b[0], a[1] - b[1]) < L * .02;
      return { pts, L, closed, w: x1 - x0, h: y1 - y0 };
    });
    // drop a full-canvas background rectangle when there is something else
    const all = { w: Math.max(...info.map(i => i.w)), h: Math.max(...info.map(i => i.h)) };
    let list = info.filter(i => !(i.closed && i.w >= all.w * .97 && i.h >= all.h * .97 && info.length > 1));
    if (!list.length) list = info;
    list.sort((a, b) => b.L - a.L);
    return { ok: true, list: list.slice(0, 24) };
  }

  let spineCands = [], tipCands = [];
  function loadSpine(text, host) {
    const r = polylines(text, host); if (!r.ok) return r;
    spineCands = r.list; selectSpine(0);
    return { ok: true, msg: `Found ${r.list.length} path${r.list.length > 1 ? 's' : ''}. The longest is the skeleton.` };
  }
  function selectSpine(i) { const c = spineCands[i]; if (!c) return; customSpine = c.pts.map(p => p.slice()); customClosed = c.closed; }

  // Brush tip from an SVG outline: its long axis runs along the stroke,
  // and its top / bottom edge become the brush's outer / inner edge.
  function loadTip(text, host) {
    const r = polylines(text, host); if (!r.ok) return r;
    tipCands = r.list.filter(c => c.closed);
    if (!tipCands.length) return { ok: false, msg: 'The brush tip needs a closed outline (a filled shape).' };
    tipCands.sort((a, b) => b.w * b.h - a.w * a.h);
    selectTip(0);
    return { ok: true, msg: `Found ${tipCands.length} outline${tipCands.length > 1 ? 's' : ''}. Using the largest as the brush tip.` };
  }
  function selectTip(i) {
    const c = tipCands[i]; if (!c) return;
    let pts = c.pts;
    if (c.h > c.w) pts = pts.map(p => [p[1], -p[0]]);            // long axis → along the stroke
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const BINS = 160, lo = new Float32Array(BINS), hi = new Float32Array(BINS), H = (y1 - y0) || 1, cy = (y0 + y1) / 2;
    for (let b = 0; b < BINS; b++) {
      const x = x0 + (b + .5) / BINS * (x1 - x0); let mn = 1e9, mx = -1e9;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], q = pts[(i + 1) % pts.length];
        if ((a[0] - x) * (q[0] - x) <= 0 && a[0] !== q[0]) { const y = mix(a[1], q[1], (x - a[0]) / (q[0] - a[0])); mn = Math.min(mn, y); mx = Math.max(mx, y); }
      }
      // screen y grows downward: the top edge of the artwork becomes the outer edge
      if (mx > mn) { hi[b] = -(mn - cy) / H; lo[b] = -(mx - cy) / H; } else { hi[b] = 0; lo[b] = 0; }
    }
    customTip = { lo, hi };
  }
  const spineInfo = () => spineCands.map((c, i) => `Path ${i + 1} · ${c.closed ? 'closed' : 'open'}`);
  const tipInfo = () => tipCands.map((c, i) => `Outline ${i + 1}`);

  // preview helpers for the panel
  function drawSpinePreview(cv, P) {
    const S = buildSpine(P), g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h); g.strokeStyle = '#a490ff'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i < S.n; i++) { const x = w / 2 + S.x[i] * w * .42, y = h / 2 + S.y[i] * h * .42; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    if (S.closed) g.closePath(); g.stroke();
  }
  function drawBrushPreview(cv, P) {
    if (P.brush === 'custom' && tipCanvas) return drawTipPreview(cv);
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, M = 200;
    g.clearRect(0, 0, w, h);
    const raw = []; let ext = .05;
    if (P.skeleton === 'rect') {
      // one side of the frame: thick corner on the left running to the sharp end
      const rows = rectRibbons(Object.assign({}, P, { rectJitter: 0, wobble: 0, shapeRot: 0, aspect: 1, rectMode: P.rectMode === 'uniform' ? 'uniform' : P.rectMode === 'corners' ? 'corners' : 'pinwheel' }), 1)[0];
      for (const R of rows) {
        const lo = -((R.iy - (-1)) * -1), hi = -((R.oy - (-1)) * -1);
        raw.push([R.t, (R.iy + 1) / P.width * -1, (R.oy + 1) / P.width * -1]);
      }
      for (const r of raw) ext = Math.max(ext, Math.abs(r[1]), Math.abs(r[2]));
    } else
    for (let i = 0; i <= M; i++) { const t = i / M, [lo, hi] = profile(P, t, 3, Math.PI / 4, P.brush === 'custom'); raw.push([t, lo, hi]); ext = Math.max(ext, Math.abs(lo), Math.abs(hi)); }
    // draw at the stroke's real proportion (width vs a length of ~2 radians of a ring), capped to fit the box
    const len = w - 24, sc = Math.min((h / 2 - 6) / ext, len * P.width / 2);
    g.fillStyle = '#a490ff'; g.beginPath();
    raw.forEach(([t, lo, hi], i) => { const x = 12 + t * len, y = h / 2 - hi * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    for (let i = raw.length - 1; i >= 0; i--) g.lineTo(12 + raw[i][0] * len, h / 2 - raw[i][1] * sc);
    g.closePath(); g.fill();
  }

  return {
    LIBRARY, BRUSH_KEYS, buildSpine, layerGeometry, loadSpine, selectSpine, spineInfo, loadTip, selectTip, tipInfo,
    isChained, chainLink, TIPS, setBuiltinTip, currentTip: () => tipName, hasSpine: () => !!customSpine, hasTip: () => !!tipMask, tipFitted: () => !!tipFit, tipMask: () => tipMask, loadTipRaster, loadPatternTile, clearPatternTile, patternTiles, hasPattern, maskFor, patternUV: () => ptUV, patternGeometry, spineFrom: (pts, closed) => makeSpine(resample(pts, 720, closed), closed), drawSpinePreview, drawBrushPreview,
  };
})();
