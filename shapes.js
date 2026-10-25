// =============================================================
// shapes.js — swappable cross-section components + tube geometry
// Every shape becomes a unit contour (max radius ~1), sampled
// clockwise from the top, with outward normals. That contour is
// then extruded into a tube (p5.Geometry) and an optional front ring.
// Namespaced in SB so nothing collides with p5 globals.
// =============================================================
const SB = (() => {
  const T = Math.PI * 2;
  const mix = (a, b, t) => a + (b - a) * t;
  let customPts = null;
  let gidCounter = 0;

  function subdivide(poly, m) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      for (let k = 0; k < m; k++) { const t = k / m; out.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]); }
    }
    return out;
  }
  function chaikin(pts, it) {
    for (; it > 0; it--) {
      const o = [], n = pts.length;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        o.push([.75 * p[0] + .25 * q[0], .75 * p[1] + .25 * q[1]], [.25 * p[0] + .75 * q[0], .25 * p[1] + .75 * q[1]]);
      }
      pts = o;
    }
    return pts;
  }
  function soften(poly, amt) {
    if (amt <= 0.001) return subdivide(poly, 12);
    const m = Math.max(2, Math.round(mix(40, 2, amt)));
    return chaikin(subdivide(poly, m), 3);
  }

  function rawShape(P) {
    const out = [];
    switch (P.shape) {
      case 'polygon': {
        const k = Math.round(P.sides), poly = [];
        for (let j = 0; j < k; j++) { const a = -Math.PI / 2 + j / k * T; poly.push([Math.cos(a), Math.sin(a)]); }
        return soften(poly, P.soften);
      }
      case 'arch': {
        const poly = [];
        for (let j = 0; j <= 48; j++) { const a = Math.PI + j / 48 * Math.PI; poly.push([Math.cos(a), Math.sin(a)]); }
        poly.push([1, P.archH], [-1, P.archH]);
        const m = Math.max(2, Math.round(mix(40, 2, P.soften))), dense = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length], seg = i < 48 ? 1 : m;
          for (let k = 0; k < seg; k++) { const t = k / seg; dense.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]); }
        }
        return P.soften > 0.001 ? chaikin(dense, 3) : dense;
      }
      case 'star': {
        for (let k = 0; k < 720; k++) {
          const a = k / 720 * T, r = 1 + P.petalAmp * Math.cos(P.petals * (a + Math.PI / 2));
          out.push([r * Math.cos(a), r * Math.sin(a)]);
        }
        return out;
      }
      case 'custom':
        if (customPts && customPts.length > 8) return customPts.map(p => p.slice());
      // falls through to squircle when nothing is loaded
      default: {
        const n = P.roundness;
        for (let k = 0; k < 720; k++) {
          const a = k / 720 * T, c = Math.cos(a), s = Math.sin(a);
          out.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
        }
        return out;
      }
    }
  }

  function resample(pts, N) {
    const n = pts.length, L = [0];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; L.push(L[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const tot = L[n], out = []; let j = 0;
    for (let k = 0; k < N; k++) {
      const tg = k / N * tot;
      while (L[j + 1] < tg) j++;
      const a = pts[j], b = pts[(j + 1) % n], seg = L[j + 1] - L[j] || 1, t = (tg - L[j]) / seg;
      out.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]);
    }
    return out;
  }

  // Unit contour: centred, max half-extent 1, aspect applied, rotated, clockwise from top.
  function contour(P) {
    const N = P.shape === 'custom' ? 720 : 360;   // custom SVGs keep more detail
    let pts = resample(rawShape(P), N);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sc = 1 / Math.max((x1 - x0) / 2, (y1 - y0) / 2);
    const rot = (P.shapeRot || 0) * Math.PI / 180, co = Math.cos(rot), si = Math.sin(rot);
    pts = pts.map(p => {
      const x = (p[0] - cx) * sc * P.aspect, y = (p[1] - cy) * sc;
      return [x * co - y * si, x * si + y * co];
    });
    let best = 0, bv = 1e9;
    pts.forEach((p, i) => { const v = p[1] + .25 * Math.abs(p[0]); if (v < bv) { bv = v; best = i; } });
    pts = pts.slice(best).concat(pts.slice(0, best));
    // clockwise on screen (y down) => positive signed area; normals then point outward for any shape
    let sa = 0;
    for (let i = 0; i < N; i++) { const p = pts[i], q = pts[(i + 1) % N]; sa += p[0] * q[1] - q[0] * p[1]; }
    if (sa < 0) pts = [pts[0]].concat(pts.slice(1).reverse());
    const C = { N, x: new Float32Array(N), y: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N) };
    pts.forEach((p, i) => { C.x[i] = p[0]; C.y[i] = p[1]; });
    for (let i = 0; i < N; i++) {
      let tx = 0, ty = 0;
      for (let o = 1; o <= 2; o++) { tx += C.x[(i + o) % N] - C.x[(i - o + N) % N]; ty += C.y[(i + o) % N] - C.y[(i - o + N) % N]; }
      const l = Math.hypot(tx, ty) || 1; C.nx[i] = ty / l; C.ny[i] = -tx / l;
    }
    return C;
  }
  function sample(C, u) {
    const f = (((u % 1) + 1) % 1) * C.N, i = Math.floor(f) % C.N, j = (i + 1) % C.N, t = f - Math.floor(f);
    let nx = mix(C.nx[i], C.nx[j], t), ny = mix(C.ny[i], C.ny[j], t); const l = Math.hypot(nx, ny) || 1;
    return { x: mix(C.x[i], C.x[j], t), y: mix(C.y[i], C.y[j], t), nx: nx / l, ny: ny / l };
  }

  function arcParams(C, cov) {
    const closed = cov >= 0.999;
    const n = closed ? C.N : Math.max(8, Math.round(C.N * cov));
    return { closed, n, u: q => closed ? q : -cov / 2 + cov * q };
  }

  // Tube wall: unit radius, z from -0.5 (far) to +0.5 (near). uv.x = around, uv.y = along.
  function tube(C, cov, along = 12) {
    const A = arcParams(C, cov);
    const g = new p5.Geometry(A.n, along, function () {
      for (let j = 0; j <= along; j++) {
        const z = j / along - 0.5;
        for (let k = 0; k <= A.n; k++) {
          const q = k / A.n, p = sample(C, A.u(q));
          this.vertices.push(new p5.Vector(p.x, p.y, z));
          this.vertexNormals.push(new p5.Vector(-p.nx, -p.ny, 0));
          this.uvs.push(q, j / along);
        }
      }
      const row = A.n + 1;
      for (let j = 0; j < along; j++) for (let k = 0; k < A.n; k++) {
        const a = j * row + k, b = a + 1, c = a + row, d = c + 1;
        this.faces.push([a, b, c], [b, d, c]);
      }
    });
    g.gid = 'sb-tube-' + (gidCounter++);
    return g;
  }

  // Front ring: flat band at the tube mouth (z = +0.5), width = thickness along the normal.
  function ring(C, cov, thickness) {
    const A = arcParams(C, cov);
    const g = new p5.Geometry(A.n, 1, function () {
      for (let j = 0; j <= 1; j++) for (let k = 0; k <= A.n; k++) {
        const q = k / A.n, p = sample(C, A.u(q)), off = j === 0 ? 0 : -thickness;
        this.vertices.push(new p5.Vector(p.x + p.nx * off, p.y + p.ny * off, 0.5));
        this.vertexNormals.push(new p5.Vector(0, 0, 1));
        this.uvs.push(q, j);
      }
      const row = A.n + 1;
      for (let k = 0; k < A.n; k++) { const a = k, b = k + 1, c = a + row, d = c + 1; this.faces.push([a, b, c], [b, d, c]); }
    });
    g.gid = 'sb-ring-' + (gidCounter++);
    return g;
  }

  // ---------------------------------------------------------------
  // Custom component from SVG.
  // Reads every drawable element (path, rect, circle, ellipse,
  // polygon, polyline), applies its transforms, splits compound
  // paths into separate outlines, drops a full-canvas background,
  // and offers the outlines largest-first.
  // ---------------------------------------------------------------
  let candidates = [];
  const SVGNS = 'http://www.w3.org/2000/svg';

  function shoelace(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  }
  function bbox(pts) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }

  function loadSVG(text, host) {
    text = (text || '').trim();
    if (!text) return { ok: false, msg: 'Paste SVG code or upload an .svg file first.' };
    // a bare path string is wrapped into an SVG
    if (!/<svg[\s>]/i.test(text)) {
      const m = text.match(/\sd\s*=\s*["']([^"']+)["']/i);
      const d = m ? m[1] : (/^[Mm]/.test(text) ? text : null);
      if (!d) return { ok: false, msg: 'No shape found. Paste a whole SVG file or a path like "M0 0 L…Z".' };
      text = `<svg xmlns="${SVGNS}"><path d="${d.replace(/"/g, '')}"/></svg>`;
    }
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const src = doc.querySelector('svg');
    if (!src || doc.querySelector('parsererror')) return { ok: false, msg: 'This SVG could not be parsed. Re-export it as plain SVG.' };

    // mount a live copy so the browser can measure lengths and transforms
    host.innerHTML = '';
    const live = document.importNode(src, true);
    live.setAttribute('width', '400'); live.setAttribute('height', '400');
    host.appendChild(live);

    const els = [...live.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')]
      .filter(el => !el.closest('defs,clipPath,mask,symbol,marker,pattern'));
    const found = [];
    for (const el of els) {
      let len = 0;
      try { len = el.getTotalLength(); } catch (e) { continue; }
      if (!len || !isFinite(len)) continue;
      const ctm = el.getCTM && el.getCTM();
      const M = Math.max(240, Math.min(4000, Math.round(len / 2)));
      const step = len / M;
      let cur = [], prev = null;
      const flush = () => { if (cur.length >= 12) found.push(cur); cur = []; };
      for (let k = 0; k <= M; k++) {
        const raw = el.getPointAtLength(Math.min(len, k * step));
        if (prev && Math.hypot(raw.x - prev.x, raw.y - prev.y) > step * 6) flush(); // new sub-path (compound path)
        prev = raw;
        const p = ctm ? new DOMPoint(raw.x, raw.y).matrixTransform(ctm) : raw;
        cur.push([p.x, p.y]);
      }
      flush();
    }
    host.innerHTML = '';
    if (!found.length) return { ok: false, msg: 'No closed outlines found. Convert strokes and text to outlines, then export again.' };

    // describe and rank
    const all = bbox([].concat(...found));
    let list = found.map(pts => {
      const b = bbox(pts), area = Math.abs(shoelace(pts));
      const isBg = b.w >= all.w * 0.97 && b.h >= all.h * 0.97 && area >= b.w * b.h * 0.9;
      return { pts, area, isBg };
    }).filter(c => c.area > all.w * all.h * 1e-5);
    if (list.length > 1) { const nonBg = list.filter(c => !c.isBg); if (nonBg.length) list = nonBg; }
    list.sort((a, b) => b.area - a.area);
    candidates = list.slice(0, 24);
    customPts = candidates[0].pts.map(p => p.slice());
    const skipped = found.length - list.length;
    return {
      ok: true,
      count: candidates.length,
      msg: `Found ${candidates.length} outline${candidates.length > 1 ? 's' : ''}` + (skipped > 0 ? ` (skipped background / tiny bits)` : '') + '. Using the largest.'
    };
  }
  function selectCandidate(i) { if (candidates[i]) customPts = candidates[i].pts.map(p => p.slice()); }
  function candidateInfo() {
    const top = candidates.length ? candidates[0].area : 1;
    return candidates.map((c, i) => `Outline ${i + 1} · ${Math.max(1, Math.round(c.area / top * 100))}% size`);
  }
  function currentOutline() { return customPts; }

  return { contour, tube, ring, loadSVG, selectCandidate, candidateInfo, currentOutline, hasCustom: () => !!customPts };
})();
