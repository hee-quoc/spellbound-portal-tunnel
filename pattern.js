// =============================================================
// pattern.js — Element / Motif, same structure as the reference,
// but each Element is an extruded tube of any SB shape instead of
// cylinder(…, 4). Motif lays the tubes along Z, sorts far→near and
// can "fly" them toward the camera for a seamless pull-in loop.
// =============================================================

function sbShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(random(i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

////////////////////////////////////////////////
class Element {
  constructor(props = {}) {
    this.id = props.id ?? 0;
    this.slot = props.slot ?? 0;
    this.colors = sbShuffle((props.colors ?? palette.colors).slice());
    this.gradientShader = new LightingGradientShader();
    this.gradientShader.setColors(this.colors);
    this.gradientSpeed = random(0.15, 1);      // scaled by PARAMS.gradSpeed each frame
    this.timeOffset = random(100);
    this.amplitudeSize = random(50, 500);      // reference "mount" breathing
    this.geo = null;
  }

  // the brush strokes of this layer, rebuilt when skeleton / brush rules change
  buildGeo(spine, P) {
    if (this.geo && typeof freeGeometry === 'function') freeGeometry(this.geo);
    this.geo = BR.layerGeometry(spine, P, this.slot, this.id + 1);
  }

  run(pos, P, t, geo) {
    const z = pos.z;
    push();
    // reference behaviour: oscillate in z and stretch the tube with it
    const chained = this.geo && this.geo.worldZ;
    const mount = chained ? 0 : sin(t * 0.6 + this.id * 0.5) * this.amplitudeSize * P.breathe;   // breathing would break the chain
    if (Math.abs(mount) <= 0.5 * Math.max(P.breathe, 0.0001)) this.amplitudeSize = random(50, 500);
    const zz = z + mount;
    const dz = P.camZ - zz;                     // distance in front of the camera
    // bend the tunnel: offset grows with depth (vanishing point drift)
    translate(pos.x + P.curveX * dz * dz * 1e-4, pos.y + P.curveY * dz * dz * 1e-4, zz);
    rotateZ(P.twist * PI / 180 * (pos.tw !== null && pos.tw !== undefined ? pos.tw : dz / 500) + P.spin * TWO_PI * t + this.slot * P.breakDrift * TWO_PI + pos.irot);
    const len = Math.max(10, P.length + mount * P.breatheLength);
    scale(P.radius * pos.iscale, P.radius * pos.iscale, chained ? 1 : len);

    const gs = this.gradientShader, c = gs.config;
    c.gradientType = P.gradType;
    c.animationType = P.animType;
    c.speed = this.gradientSpeed * P.gradSpeed;
    c.timeOffset = this.timeOffset * (P.gradSpeed > 0 ? 1 : 0);
    c.angle = P.angle * PI / 180;
    c.scale = P.gScale;
    c.stripeCount = P.stripes;
    c.twist = P.stripeTwist;
    c.steps = P.steps;
    c.ambientStrength = P.ambient;
    c.diffuseStrength = P.diffuse;
    c.fogColor = P.fogRGB;
    c.fogAmount = P.fog;
    c.fogNear = P.fogNear;
    c.fogFar = P.fogFar;
    // brush texture
    // stamped / scattered tips keep their own silhouette: no bristle or dry-brush breakup on them
    const tipCopies = P.brush === 'custom' && (P.tipMode === 'scatter' || P.tipMode === 'stamp');
    c.bristles = tipCopies ? 0 : P.bristles; c.dry = tipCopies ? 0 : P.dry; c.rough = tipCopies ? 0 : P.rough; c.streak = tipCopies ? 0 : P.streak;
    c.reveal = pos.reveal; c.fade = pos.ifade; c.seed = this.id * 1.37 + P.seed * .01; c.wallShade = P.wallShade;
    c.mask = (P.brush === 'custom' && BR.tipMask()) ? BR.tipMask() : null;
    gs.apply();
    model(this.geo);
    resetShader();
    pop();
  }
}

////////////////////////////////////////////////
class Motif {
  constructor(P) {
    this.elements = [];
    for (let i = 0; i < P.count; i++) {
      this.elements.push(new Element({ id: i, slot: i, colors: P.wallColors }));
    }
  }

  // Layout = where each tube sits along the path. Every layout scrolls with
  // the same "fly" travel, so all of them loop seamlessly.
  //   tunnel   – straight line toward the camera (pull-in)
  //   corridor – same line, tilted by axisYaw / axisPitch, seen from outside
  //   row      – frames marching sideways across the screen (linear)
  //   helix    – line wound around a circle (vortex)
  //   wave     – line bent into a travelling snake
  place(P, t) {
    const n = this.elements.length, total = n * P.spacing;
    const travel = t * P.fly * P.spacing;
    const yaw = P.axisYaw * PI / 180, pitch = P.axisPitch * PI / 180;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // portal opening: every layer starts pushed back toward the vanishing point and rushes forward to its place
    // (deepest first). Moving through depth keeps perspective intact, so nothing jumps in size.
    const it = (P.introStart === null || P.introStart === undefined) ? 1e9 : t - P.introStart;
    const dur = Math.max(.05, P.introDur), spread = P.introStagger * dur, run = Math.max(.05, dur - spread);
    const easeOut = x => 1 - Math.pow(1 - x, 3);
    return this.elements.map((el, i) => {
      let s = i * P.spacing + travel;
      s = ((s % total) + total) % total - total / 2 + P.spacing / 2;
      const depth01 = (s + total / 2) / total;                          // 0 = deepest … 1 = front
      const q = Math.min(1, Math.max(0, (it - spread * depth01) / run));
      const push = (1 - easeOut(q)) * P.introDepth;                     // in layers
      s -= push * P.spacing;
      let x = 0, y = 0, z = s;
      let near = (s + total / 2) / total, tw = null;
      if (P.depthMode === 'geometric') {
        // every layer is `geoRatio` times the size of the one in front of it (graphic, evenly shrinking rhythm)
        const u = (((i + travel / P.spacing) % n) + n) % n - push;        // 0 = deepest … n = at the front
        const qq = 1 / Math.min(.97, Math.max(.2, P.geoRatio));
        z = P.camZ - P.geoNear * Math.pow(qq, n - u);
        s = z; near = Math.max(0, u / n); tw = n - u;   // twist turns evenly per layer in geometric mode
      }
      if (P.layout === 'row') {
        const a = P.rowAngle * PI / 180;
        x = s * Math.cos(a); y = s * Math.sin(a); z = P.rowDepth;
      } else if (P.layout === 'helix' || P.layout === 'wave') {
        const ph = TWO_PI * (P.pathFreq * s / 1000 + P.pathSpeed * t);
        const round = P.layout === 'helix' ? 1 : P.pathRound;
        x = P.pathAmp * round * Math.cos(ph); y = P.pathAmp * Math.sin(ph);
      }
      // world position after the axis tilt, only for far-to-near ordering
      const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
      const x2 = x * cyw + z1 * syw, z2 = -x * syw + z1 * cyw;
      const dist = Math.hypot(x2, y1, P.camZ - z2);
      // paint-on: strokes are drawn in as they travel from the far end toward the camera
      const reveal = P.paintOn > 0 ? Math.min(1, Math.max(0, near / P.paintOn)) : 1;
      // loop seam: a layer is born at the back and leaves at the front — fade it in / out there so it never pops
      const life = P.depthMode === 'geometric' ? Math.max(0, Math.min(1, (((i + travel / P.spacing) % n) + n) % n / n)) : depth01;
      const sst = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / Math.max(1e-4, b - a))); return k * k * (3 - 2 * k); };
      const seam = sst(0, P.farFade, life) * (1 - sst(1 - P.nearFade, 1, life));
      return { el, x, y, z, dist, reveal, tw, iq: q, seam };
    });
  }

  buildGeo(P) {
    if (P.brush === 'custom' && P.tipSource && P.tipSource !== 'upload') BR.setBuiltinTip(P.tipSource);
    const spine = BR.buildSpine(P);
    for (const el of this.elements) el.buildGeo(spine, P);
  }

  // Portal opening (game-style): rings burst out of the centre one after another, deepest first,
  // whirl in from an extra spin and settle with a little overshoot; everything fades in from the background fast.
  intro(placed, P, t) {
    const n = placed.length, it = (P.introStart === null || P.introStart === undefined) ? 1e9 : t - P.introStart;
    const dur = Math.max(.05, P.introDur), spread = P.introStagger * dur;
    const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
    const easeOutBack = x => { const c1 = 1.70158 * P.introBounce, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    placed.forEach((p, k) => {                       // k: 0 = deepest
      const q = p.iq;                                // progress from place(): same stagger as the depth rush
      p.iscale = q >= 1 ? 1 : P.introScale + (1 - P.introScale) * easeOutBack(q);
      p.irot = q >= 1 ? 0 : P.introSpin * TWO_PI * (1 - easeOutCubic(q)) * (k % 2 && P.introAlternate ? -1 : 1);
      // each layer stays hidden until its turn, then fades in fast while it is still deep (no ghost copies)
      p.ifade = Math.min(1, Math.max(0, it / Math.max(.01, P.introFade))) * Math.min(1, q * 5) * p.seam;
    });
  }

  run(P, t) {
    const placed = this.place(P, t);
    placed.sort((a, b) => (b.dist - a.dist) || (a.el.id - b.el.id)); // far first (depth test off)
    this.intro(placed, P, t);
    push();
    rotateY(P.axisYaw * PI / 180);
    rotateX(P.axisPitch * PI / 180);
    for (const p of placed) if (p.dist > P.nearClip && p.ifade > 0) p.el.run(p, P, t, P.geo);   // skip layers that would fill the lens
    pop();
  }
}
