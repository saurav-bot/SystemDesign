/**
 * Swappable Strategy Design Pattern for Live Video Streaming Protocols
 * StreamPulse Protocol Adapters: WHIP, WHEP, WebRTC Direct, HLS, DASH, HTTP-FLV
 */

class IProtocolAdapter {
  constructor(options = {}) {
    this.options = options;
  }
  async connect() { throw new Error("Method connect() must be implemented"); }
  async publish(mediaStream) { throw new Error("Method publish() must be implemented"); }
  async subscribe(videoElement) { throw new Error("Method subscribe() must be implemented"); }
  async disconnect() { throw new Error("Method disconnect() must be implemented"); }
  getStats() { return { latency: 0, bitrate: 0, fps: 30 }; }
}

/**
 * WHIP (WebRTC HTTP Ingestion Protocol) Broadcaster Adapter
 */
class WHIPPublisherAdapter extends IProtocolAdapter {
  constructor(options = {}) {
    super(options);
    this.endpoint = options.endpoint || "/api/whip";
    this.pc = null;
    this.sessionLocation = null;
  }

  async publish(mediaStream) {
    console.log("[WHIP Adapter] Initializing WHIP Ingest to:", this.endpoint);
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // Add local media tracks to PeerConnection
    mediaStream.getTracks().forEach(track => {
      this.pc.addTrack(track, mediaStream);
    });

    // Create SDP Offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Send HTTP POST SDP offer to WHIP endpoint
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    if (!response.ok) {
      throw new Error(`WHIP Ingest error: ${response.status} ${response.statusText}`);
    }

    this.sessionLocation = response.headers.get("Location");
    const sdpAnswer = await response.text();
    await this.pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

    console.log("[WHIP Adapter] Ingest connected successfully! Session:", this.sessionLocation);
  }

  async disconnect() {
    if (this.sessionLocation) {
      fetch(this.sessionLocation, { method: "DELETE" }).catch(() => {});
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    console.log("[WHIP Adapter] Disconnected.");
  }
}

/**
 * WHEP (WebRTC HTTP Egress Protocol) Subscriber Adapter
 */
class WHEPSubscriberAdapter extends IProtocolAdapter {
  constructor(options = {}) {
    super(options);
    this.endpoint = options.endpoint || "/api/whep";
    this.pc = null;
    this.sessionLocation = null;
  }

  async subscribe(videoElement) {
    console.log("[WHEP Adapter] Connecting player to WHEP endpoint:", this.endpoint);
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // Add transceivers to indicate we want video and audio egress
    this.pc.addTransceiver("video", { direction: "recvonly" });
    this.pc.addTransceiver("audio", { direction: "recvonly" });

    this.pc.ontrack = (event) => {
      console.log("[WHEP Adapter] Received egress media track:", event.track.kind);
      if (videoElement.srcObject !== event.streams[0]) {
        videoElement.srcObject = event.streams[0];
        videoElement.play().catch(() => {});
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    if (!response.ok) {
      throw new Error(`WHEP Egress error: ${response.status} ${response.statusText}`);
    }

    this.sessionLocation = response.headers.get("Location");
    const sdpAnswer = await response.text();
    await this.pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

    console.log("[WHEP Adapter] Player connected successfully via WHEP!");
  }

  async disconnect() {
    if (this.sessionLocation) {
      fetch(this.sessionLocation, { method: "DELETE" }).catch(() => {});
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    console.log("[WHEP Adapter] Disconnected.");
  }
}

/**
 * HLS (HTTP Live Streaming) Subscriber Adapter (Hls.js Engine)
 */
class HLSSubscriberAdapter extends IProtocolAdapter {
  constructor(options = {}) {
    super(options);
    this.manifestUrl = options.manifestUrl || "/live/hls/stream.m3u8";
    this.hls = null;
  }

  async subscribe(videoElement) {
    console.log("[HLS Adapter] Initializing HLS.js player with manifest:", this.manifestUrl);
    if (Hls.isSupported()) {
      this.hls = new Hls({
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
        enableWorker: true
      });
      this.hls.loadSource(this.manifestUrl);
      this.hls.attachMedia(videoElement);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(() => {});
      });
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari HLS
      videoElement.src = this.manifestUrl;
      videoElement.play().catch(() => {});
    } else {
      throw new Error("HLS playback is not supported in this browser.");
    }
  }

  async disconnect() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    console.log("[HLS Adapter] Disconnected.");
  }
}

/**
 * DASH (Dynamic Adaptive Streaming over HTTP) Subscriber Adapter (Dash.js Engine)
 */
class DASHSubscriberAdapter extends IProtocolAdapter {
  constructor(options = {}) {
    super(options);
    this.manifestUrl = options.manifestUrl || "/live/dash/stream.mpd";
    this.player = null;
  }

  async subscribe(videoElement) {
    console.log("[DASH Adapter] Initializing Dash.js player with manifest:", this.manifestUrl);
    if (typeof dashjs !== "undefined") {
      this.player = dashjs.MediaPlayer().create();
      this.player.initialize(videoElement, this.manifestUrl, true);
    } else {
      throw new Error("Dash.js library not loaded.");
    }
  }

  async disconnect() {
    if (this.player) {
      this.player.reset();
      this.player = null;
    }
    console.log("[DASH Adapter] Disconnected.");
  }
}
