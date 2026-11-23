// =============================================================
// banner.js — motion banners: text (and a logo) animated over the portal.
// Everything is painted into one 2D layer and drawn on top of the WebGL
// frame, so PNG / MP4 exports carry it too. Timing starts with the portal
// opening (PARAMS.introStart), so "Open portal" replays the whole banner.
//
// Modes (PARAMS.bannerMode):
//   off   – no banner
//   drop  – the tunnel slides down, a solid panel drops in from the top
//           (chevron-cut bottom edge, like the brand banners), then the
//           lines rise in one by one
//   pop   – the text block pops in with a little overshoot, on a solid plate
//   rise  – each line slides up out of its own mask, no panel (clean type
//           straight on the portal)
// Colours come from the palette: panel / plate = background colour,
// type = the paint colour, so every palette stays on brand.
// =============================================================
const Banner = (() => {
  let pg = null, logo = null, logoTinted = null, logoTint = '';
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
  const easeInOut = x => { x = clamp01(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeBack = x => { x = clamp01(x); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const ENABLED = false;   // banner motion parked for now: flip to true to bring the Banner panel and overlay back
  const FONT = '"Anton", "Bebas Neue", Impact, "Arial Narrow", sans-serif';

  const PANEL_TIME = .8;      // panel drop (s)
  const LINE_TIME = .5;       // one line rising in (s)
  const LINE_GAP = .1;        // stagger between lines (s)

  function elapsed(P, t) { return (P.introStart === null || P.introStart === undefined) ? 1e9 : t - P.introStart; }

  // how far the tunnel has slid down (in vanishing-point units: frame heights) for the drop banner
  function vpShift(P, t) {
    if (!ENABLED) return 0;
    if (P.bannerMode !== 'drop') return 0;
    return (P.bannerShift || 0) * easeInOut((elapsed(P, t) - P.bannerDelay) / (PANEL_TIME * 1.1));
  }

  function lines(P) { return String(P.bannerText || '').toUpperCase().split(/\n/).map(s => s.trim()).filter(Boolean); }

  function setLogo(img) { logo = img; logoTinted = null; }
  function loadLogo(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { setLogo(im); resolve(true); };
      im.onerror = () => resolve(false);
      im.src = url;
    });
  }
  function clearLogo() { logo = null; logoTinted = null; }
  function hasLogo() { return !!logo; }
  // single-colour brand logo: repaint every opaque pixel in the type colour
  function tinted(col) {
    if (!logo) return null;
    if (logoTinted && logoTint === col) return logoTinted;
    const c = document.createElement('canvas'), w = logo.naturalWidth || logo.width || 512, h = logo.naturalHeight || logo.height || 512;
    c.width = w; c.height = h; const g = c.getContext('2d');
    g.drawImage(logo, 0, 0, w, h); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, w, h);
    logoTinted = c; logoTint = col; return c;
  }

  // fit every line to the same cap height, shrinking only lines that would run past the safe width
  function layout(g, P, W) {
    const L = lines(P), size = Math.max(8, P.bannerSize * W), maxW = W * .84, out = [];
    for (const s of L) {
      let px = size; g.font = `${px}px ${FONT}`;
      const w = g.measureText(s).width; if (w > maxW) px *= maxW / w;
      out.push({ s, px });
    }
    return out;
  }

  function drawBlock(g, P, W, cx, top, ink, tt, t0, rise) {
    const ls = layout(g, P, W), lh = k => ls[k].px * 1.02;
    let y = top;
    // logo first, popping in just before the lines
    if (logo && P.bannerLogo) {
      const lw = W * P.bannerLogoSize, im = P.bannerLogoTint ? tinted(ink) : logo, ar = (logo.naturalHeight || 1) / (logo.naturalWidth || 1), lhgt = lw * ar;
      const k = easeBack((tt - t0) / .5), a = clamp01((tt - t0) / .2);
      if (k > 0) { g.save(); g.globalAlpha = a; g.translate(cx, y + lhgt / 2); g.scale(k, k); g.drawImage(im, -lw / 2, -lhgt / 2, lw, lhgt); g.restore(); }
      y += lhgt + ls.length * 0 + W * .05; t0 += .25;
    }
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    ls.forEach((L, k) => {
      const h = lh(k), base = y + h * .88, b = (tt - t0 - k * LINE_GAP) / LINE_TIME;
      g.font = `${L.px}px ${FONT}`;
      if (rise) {
        // slides up out of its own line mask
        const e = easeOut(b);
        if (e > 0) { g.save(); g.beginPath(); g.rect(0, y - h * .1, W, h * 1.15); g.clip(); g.fillText(L.s, cx, base + (1 - e) * h * 1.1); g.restore(); }
      } else {
        const e = easeOut(b);
        if (e > 0) { g.save(); g.globalAlpha = e; g.fillText(L.s, cx, base + (1 - e) * h * .45); g.restore(); }
      }
      y += h;
    });
    return y;
  }

  function blockHeight(g, P, W) {
    const ls = layout(g, P, W); let h = ls.reduce((a, L) => a + L.px * 1.02, 0);
    if (logo && P.bannerLogo) h += W * P.bannerLogoSize * ((logo.naturalHeight || 1) / (logo.naturalWidth || 1)) + W * .05;
    return h;
  }

  // shrink the type (never grow it) so the whole block fits the room it has
  function fitted(g, P, W, room) {
    const bh = blockHeight(g, P, W);
    return bh > room ? Object.assign({}, P, { bannerSize: P.bannerSize * room / bh, bannerLogoSize: P.bannerLogoSize * room / bh }) : P;
  }

  // paint the banner layer for time t; returns false when there is nothing to show
  function paint(P, t, W, H) {
    if (!P.bannerMode || P.bannerMode === 'off') return false;
    if (!pg || pg.width !== W || pg.height !== H) { if (pg) pg.remove(); pg = createGraphics(W, H); pg.pixelDensity(pixelDensity()); }
    pg.clear();
    const g = pg.drawingContext, tt = elapsed(P, t), ink = (P.wallColors && P.wallColors[0]) || '#ffffff', ground = P.bgHex || '#000000';
    const d = P.bannerDelay;
    g.save();
    if (P.bannerMode === 'drop') {
      const ph = H * P.bannerPanel, notch = W * .16, e = easeOut((tt - d) / PANEL_TIME);
      const yb = -notch + e * (ph + notch);
      g.fillStyle = ground;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, yb); g.lineTo(W / 2, yb + notch); g.lineTo(0, yb); g.closePath(); g.fill();
      const Q = fitted(g, P, W, ph * .84), bh = blockHeight(g, Q, W);
      drawBlock(g, Q, W, W / 2, (ph - bh) / 2, ink, tt, d + PANEL_TIME * .7, false);
    } else if (P.bannerMode === 'pop') {
      P = fitted(g, P, W, H * .7);
      const bh = blockHeight(g, P, W), cy = Math.min(H - bh / 2 - H * .06, Math.max(bh / 2 + H * .06, H * ({ top: .22, center: .5, bottom: .78 }[P.bannerPos] || .5)));   // keep the block inside the frame
      const k = easeBack((tt - d) / .55), a = clamp01((tt - d) / .15);
      if (k > 0) {
        g.translate(W / 2, cy); g.scale(k, k); g.translate(-W / 2, -cy); g.globalAlpha = a;
        if (P.bannerPlate) {
          const pw = W * .9, pad = W * .06;
          g.fillStyle = ground; g.fillRect((W - pw) / 2, cy - bh / 2 - pad, pw, bh + pad * 2);
        }
        drawBlock(g, P, W, W / 2, cy - bh / 2, ink, 1e9, 0, false);
      }
    } else if (P.bannerMode === 'rise') {
      P = fitted(g, P, W, H * .7);
      const bh = blockHeight(g, P, W), cy = Math.min(H - bh / 2 - H * .06, Math.max(bh / 2 + H * .06, H * ({ top: .22, center: .5, bottom: .78 }[P.bannerPos] || .5)));   // keep the block inside the frame
      drawBlock(g, P, W, W / 2, cy - bh / 2, ink, tt, d, true);
    }
    g.restore();
    return true;
  }

  // draw the layer on top of the WebGL frame (screen-aligned, after the portal)
  function draw(P, t) {
    if (!ENABLED) return;
    if (!paint(P, t, width, height)) return;
    push();
    resetShader();
    // flat screen-space pass: orthographic camera straight down the axis, the layer exactly fills the frame
    ortho(-width / 2, width / 2, -height / 2, height / 2, 1, 4000);
    camera(0, 0, 1000, 0, 0, 0, 0, 1, 0);
    noStroke(); texture(pg); plane(width, height);
    pop();
  }

  // fonts are web fonts: make sure the canvas can use them before the first frame with text
  function ready() { return document.fonts && document.fonts.load ? document.fonts.load(`40px ${FONT}`).catch(() => {}) : Promise.resolve(); }

  return { ENABLED, draw, vpShift, loadLogo, clearLogo, hasLogo, setLogo, ready };
})();
