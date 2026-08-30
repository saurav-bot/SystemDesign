/**
 * Broadcaster Studio Module
 * Handles local media capture (Webcam, Screen Share, Canvas Timestamp Burner)
 */

class BroadcasterStudio {
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.currentStream = null;
    this.activeSource = 'webcam';
    this.adapter = null;
    this.animFrameId = null;
  }

  async getMediaStream(sourceType = 'webcam') {
    this.stopMediaStream();
    this.activeSource = sourceType;

    if (sourceType === 'webcam') {
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: true
      });
    } else if (sourceType === 'screen') {
      this.currentStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
    } else if (sourceType === 'pattern') {
      this.currentStream = this.createSyntheticCanvasStream();
    }

    if (this.videoElement) {
      this.videoElement.srcObject = this.currentStream;
    }

    return this.currentStream;
  }

  createSyntheticCanvasStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    
    let frameCount = 0;
    let ballX = 100, ballY = 100, dx = 8, dy = 5;

    const draw = () => {
      frameCount++;
      
      // Dark background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bouncing ball
      ballX += dx;
      ballY += dy;
      if (ballX <= 40 || ballX >= canvas.width - 40) dx *= -1;
      if (ballY <= 40 || ballY >= canvas.height - 40) dy *= -1;

      ctx.beginPath();
      ctx.arc(ballX, ballY, 35, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Burn Timestamp Box for Glass-to-Glass Latency Testing
      const nowMs = Date.now();
      const dateStr = new Date(nowMs).toISOString().split('T')[1].replace('Z', '');
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 40, 700, 100);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(40, 40, 700, 100);

      ctx.font = 'bold 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`SERVER TIME: ${dateStr}`, 60, 105);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`STREAMPULSE TEST SIGNAL | Frame: ${frameCount}`, 40, 180);

      this.animFrameId = requestAnimationFrame(draw);
    };

    draw();
    return canvas.captureStream(30);
  }

  stopMediaStream() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  async startPublishing(protocolType) {
    if (!this.currentStream) {
      await this.getMediaStream(this.activeSource);
    }

    if (protocolType === 'WHIP') {
      this.adapter = new WHIPPublisherAdapter();
    } else {
      this.adapter = new WHIPPublisherAdapter();
    }

    await this.adapter.publish(this.currentStream);
  }

  async stopPublishing() {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
  }
}
