// =============================================================
// recorder.js — MP4 export.
// Main path: render frame-by-frame on a fixed clock, encode with
// WebCodecs (H.264) and mux with mp4-muxer. Every frame is exact,
// so slow machines take longer but never drop frames.
// Fallback (browsers without WebCodecs): real-time MediaRecorder.
// =============================================================
const Recorder = (() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let cancelled = false;

  async function pickCodec(W, H, fps, bitrate) {
    if (!('VideoEncoder' in window)) return null;
    // H.264 first (plays everywhere, incl. QuickTime/Premiere); VP9-in-MP4 when the browser has no H.264 encoder
    const list = [['avc1.640033', 'avc'], ['avc1.640032', 'avc'], ['avc1.4d0033', 'avc'], ['avc1.42003e', 'avc'],
                  ['vp09.00.50.08', 'vp9'], ['vp09.00.40.08', 'vp9'], ['vp09.00.10.08', 'vp9']];
    for (const [codec, mux] of list) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate, framerate: fps });
        if (s.supported) return { codec, mux };
      } catch (e) { /* try next */ }
    }
    return null;
  }

  async function recordExact({ seconds, fps, onProgress }) {
    const el = cnv.elt, W = el.width - (el.width % 2), H = el.height - (el.height % 2);
    const bitrate = Math.round(Math.min(40e6, W * H * fps * 0.12));
    const pick = typeof Mp4Muxer !== 'undefined' ? await pickCodec(W, H, fps, bitrate) : null;
    if (!pick) return null;
    const codec = pick.codec;

    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({ target, video: { codec: pick.mux, width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
    let failure = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
    enc.configure({ codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality' });

    const wasPlaying = playing, t0 = clock, N = Math.round(seconds * fps);
    playing = false; noLoop(); cancelled = false;
    try {
      for (let i = 0; i < N; i++) {
        if (cancelled || failure) break;
        clock = t0 + i / fps;
        redraw();
        const frame = new VideoFrame(el, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        while (enc.encodeQueueSize > 6) await sleep(4);
        if (i % 3 === 0) { onProgress((i + 1) / N); await sleep(0); }
      }
      if (!cancelled && !failure) { await enc.flush(); muxer.finalize(); }
    } finally {
      try { enc.close(); } catch (e) { }
      clock = t0 + N / fps; playing = wasPlaying; loop();
    }
    if (failure) throw failure;
    if (cancelled) return 'cancelled';
    onProgress(1);
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', note: `${W}×${H} · ${fps} fps · ${pick.mux === 'avc' ? 'H.264' : 'VP9 (this browser has no H.264 encoder; use Chrome/Edge/Safari for H.264)'}` };
  }

  async function recordRealtime({ seconds, fps, onProgress }) {
    if (!('MediaRecorder' in window) || !cnv.elt.captureStream) throw new Error('This browser cannot record video. Try Chrome or Edge.');
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const stream = cnv.elt.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16e6 });
    const parts = []; rec.ondataavailable = e => e.data.size && parts.push(e.data);
    const done = new Promise(r => rec.onstop = r);
    const wasPlaying = playing; playing = true; cancelled = false;
    rec.start(250);
    const start = performance.now();
    while (performance.now() - start < seconds * 1000 && !cancelled) { onProgress((performance.now() - start) / (seconds * 1000)); await sleep(100); }
    rec.stop(); await done; playing = wasPlaying;
    if (cancelled) return 'cancelled';
    const isMp4 = mimeType.startsWith('video/mp4');
    return { blob: new Blob(parts, { type: isMp4 ? 'video/mp4' : 'video/webm' }), ext: isMp4 ? 'mp4' : 'webm', note: isMp4 ? 'real-time capture' : 'WebM (this browser cannot write MP4)' };
  }

  async function record(opts) {
    const exact = await recordExact(opts);
    if (exact) return exact;
    return recordRealtime(opts);
  }

  return { record, cancel: () => { cancelled = true; } };
})();
