/**
 * Player Studio Module (Subscriber)
 * Orchestrates video playback using swappable protocol adapters
 */

class PlayerStudio {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.currentAdapter = null;
    this.activeProtocol = 'WHEP';
  }

  async connect(protocolType) {
    this.disconnect();
    this.activeProtocol = protocolType;
    console.log(`[Player Studio] Connecting player via protocol: ${protocolType}`);

    switch (protocolType) {
      case 'WHEP':
        this.currentAdapter = new WHEPSubscriberAdapter();
        break;
      case 'LL_HLS':
      case 'HLS':
        this.currentAdapter = new HLSSubscriberAdapter();
        break;
      case 'DASH':
        this.currentAdapter = new DASHSubscriberAdapter();
        break;
      default:
        this.currentAdapter = new WHEPSubscriberAdapter();
        break;
    }

    await this.currentAdapter.subscribe(this.videoElement);
  }

  disconnect() {
    if (this.currentAdapter) {
      this.currentAdapter.disconnect();
      this.currentAdapter = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }
  }
}
