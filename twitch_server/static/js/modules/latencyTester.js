/**
 * Latency & Stream Health Metrics Module
 * Calculates glass-to-glass latency and tracks throughput & frame drops
 */

class LatencyTester {
  constructor() {
    this.pubTimestamp = 0;
    this.subTimestamp = 0;
    this.latencyMs = 75; // Default baseline estimate
    this.bitrateKbps = 2450;
    this.fps = 60.0;
    this.droppedFrames = 0;
  }

  calculateGlassToGlassLatency() {
    const now = Date.now();
    // Simulate high-precision timestamp check
    const variance = (Math.random() * 20) - 10;
    
    // Protocol-based baseline latency estimates
    const pubProto = document.getElementById('publisherProtocolSelect')?.value;
    const subProto = document.getElementById('subscriberProtocolSelect')?.value;

    let baseLatency = 75;
    if (subProto === 'WHEP' || subProto === 'WEBRTC_DIRECT') {
      baseLatency = 65 + Math.random() * 30; // Sub-100ms
    } else if (subProto === 'LL_HLS') {
      baseLatency = 1800 + Math.random() * 400; // ~1.8s
    } else if (subProto === 'HLS') {
      baseLatency = 5500 + Math.random() * 1000; // ~5.5s
    } else if (subProto === 'DASH') {
      baseLatency = 2200 + Math.random() * 500; // ~2.2s
    }

    this.latencyMs = Math.max(20, Math.round(baseLatency + variance));
    return this.latencyMs;
  }

  updateMetricsDisplay() {
    const latency = this.calculateGlassToGlassLatency();
    
    // Update Latency Value in UI
    const latencyElem = document.getElementById('latencyValue');
    const gaugeValueElem = document.getElementById('gaugeValue');
    const gaugeFillElem = document.getElementById('gaugeFill');
    const estLatencyPill = document.getElementById('estLatencyPill');

    if (latencyElem) latencyElem.innerText = latency;
    if (gaugeValueElem) gaugeValueElem.innerHTML = `${latency} <small>ms</small>`;
    
    if (estLatencyPill) {
      if (latency < 300) {
        estLatencyPill.innerText = `~${latency} ms`;
        estLatencyPill.className = 'pill-value neon-green';
      } else {
        estLatencyPill.innerText = `~${(latency / 1000).toFixed(1)} s`;
        estLatencyPill.className = 'pill-value neon-yellow';
      }
    }

    if (gaugeFillElem) {
      const percentage = Math.min(100, (latency / 6000) * 100);
      gaugeFillElem.style.width = `${Math.max(5, percentage)}%`;
    }

    // Dynamic Bitrate simulation
    this.bitrateKbps = Math.round(2400 + (Math.random() * 150 - 75));
    const bitrateElem = document.getElementById('bitrateDisplay');
    if (bitrateElem) bitrateElem.innerHTML = `${this.bitrateKbps.toLocaleString()} <small>kbps</small>`;

    // FPS simulation
    this.fps = (59.2 + Math.random() * 0.8).toFixed(1);
    const fpsElem = document.getElementById('fpsDisplay');
    if (fpsElem) fpsElem.innerHTML = `${this.fps} <small>FPS</small>`;
  }

  startMonitoring(intervalMs = 1000) {
    setInterval(() => this.updateMetricsDisplay(), intervalMs);
  }
}
