// =============================================================
// brush.js — SKELETON + BRUSH system (replaces the shape tubes)
//
//   Skeleton (khung xương) = the spine a stroke travels along:
//     ring   – a base shape's outline (circle, squircle, polygon, arch, star)
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
    custom:    { name: 'Custom tip (SVG)',  width: .18, taperIn: 0,   taperOut: 0,   swell: 0,   flareIn: 0,   flareOut: 0,   stepAmp: 0,   pressure: 0,   nibAmt: 0,  bias: 0,   bristles: 0,  dry: 0,   rough: 0,   streak: 0 },
  };
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
    // step chisel: a raised, squared-off section on the outer edge (brand asset 01)
    if (B.stepAmp > 0) {
      const sp = clamp(B.stepPos + (hash(s, 9) - .5) * B.stepJitter, 0, 1);
      const bump = sstep(sp - .03, sp + .01, t) * (1 - sstep(sp + B.stepLen - .01, sp + B.stepLen + .03, t));
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
    for (let k = 0; k < 4; k++) {
      const c0 = C[k], c1 = C[(k + 1) % 4], dx = c1[0] - c0[0], dy = c1[1] - c0[1], len = Math.hypot(dx, dy) || 1;
      const tx = dx / len, ty = dy / len, nx = ty, ny = -tx, mode = thickAt[k], s = seed * 11 + k;
      const ext = P.rectOver * W, cut = P.rectGap;
      const sa = (mode === 'start' || mode === 'both') ? -ext / len : (mode === 'end' ? cut : 0);
      const sb = (mode === 'end' || mode === 'both') ? 1 + ext / len : (mode === 'start' ? 1 - cut : 1);
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
        if (P.rectHook > 0 && mode !== 'none') hi += P.rectHook * W * .5 * Math.pow(Math.max(0, (d - .8) / .2), 2.5);   // the little curled hook at the thick corner
        const wob = P.wobble ? (noise1(sp * 6 + s, s + 3) * .7 + noise1(sp * 17 + s, s + 5) * .3) * P.wobble : 0;
        const bx = c0[0] + dx * sp + nx * wob, by = c0[1] + dy * sp + ny * wob;
        rows.push({ zf: .5, t, ix: bx + nx * lo, iy: by + ny * lo, ox: bx + nx * hi, oy: by + ny * hi, nx, ny, ang });
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
    const masked = P.brush === 'custom' && !!tipMask;
    if (masked && P.tipMode === 'stamp') return stampGeometry(S, P, strokes, start, stride);
    const ribbons = P.skeleton === 'rect' ? rectRibbons(P, seed) : strokes.map(([ua, ub, s]) => {
      const span = ub - ua, M = Math.max(24, Math.round(Math.abs(span) * (S.closed ? 360 : 300)));
      const rows = [];
      for (let i = 0; i <= M; i++) {
        const t = i / M, u = ua + span * t, p = sampleSpine(S, u);
        const wob = P.wobble ? (noise1(u * 9 + s, s + 3) * .7 + noise1(u * 23 + s, s + 5) * .3) * P.wobble : 0;
        const bx = p.x + p.nx * wob, by = p.y + p.ny * wob;
        const [lo, hi] = masked ? profile(Object.assign({}, B, { flareIn: 0, flareOut: 0, stepAmp: 0, bias: 0 }), t, s, p.ang, false) : profile(B, t, s, p.ang, useTip);
        rows.push({ zf: chain ? -t * P.spacing : .5, t, ix: bx + p.nx * lo * W, iy: by + p.ny * lo * W, ox: bx + p.nx * hi * W, oy: by + p.ny * hi * W, nx: p.nx, ny: p.ny });
      }
      return rows;
    });
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
    isChained, chainLink, TIPS, setBuiltinTip, currentTip: () => tipName, hasSpine: () => !!customSpine, hasTip: () => !!tipMask, tipFitted: () => !!tipFit, tipMask: () => tipMask, loadTipRaster, drawSpinePreview, drawBrushPreview,
  };
})();
