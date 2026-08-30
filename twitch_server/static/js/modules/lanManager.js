/**
 * LAN Network & QR Code Manager Module
 * Discovers server's local IPv4 network address and generates QR codes for smartphone testing
 */

class LanManager {
  constructor() {
    this.networkInfo = null;
  }

  async fetchNetworkInfo() {
    try {
      const res = await fetch('/api/network-info');
      if (!res.ok) throw new Error('Failed to fetch network info');
      this.networkInfo = await res.json();
      this.updateLanUI();
    } catch (err) {
      console.warn('Network info fetch failed, fallback to window.location:', err);
      const host = window.location.hostname;
      const port = window.location.port || 8000;
      this.networkInfo = {
        lan_ip: host,
        web_dashboard_url: `http://${host}:${port}`,
        rtmp_ingest_url: `rtmp://${host}:1935/live`
      };
      this.updateLanUI();
    }
  }

  updateLanUI() {
    if (!this.networkInfo) return;

    const lanIpDisplay = document.getElementById('lanIpDisplay');
    const lanFullUrl = document.getElementById('lanFullUrl');
    const obsServerUrl = document.getElementById('obsServerUrl');
    const modalLanUrl = document.getElementById('modalLanUrl');

    if (lanIpDisplay) lanIpDisplay.innerText = `LAN: ${this.networkInfo.lan_ip}`;
    if (lanFullUrl) lanFullUrl.innerText = this.networkInfo.web_dashboard_url;
    if (obsServerUrl) obsServerUrl.innerText = this.networkInfo.rtmp_ingest_url;
    if (modalLanUrl) modalLanUrl.innerText = this.networkInfo.web_dashboard_url;

    // Generate Inline QR Code
    const qrcodeContainer = document.getElementById('qrcodeContainer');
    if (qrcodeContainer && typeof QRCode !== 'undefined') {
      qrcodeContainer.innerHTML = '';
      new QRCode(qrcodeContainer, {
        text: this.networkInfo.web_dashboard_url,
        width: 140,
        height: 140,
        colorDark: "#0b0f19",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    }

    // Generate Modal QR Code
    const modalQrcode = document.getElementById('modalQrcode');
    if (modalQrcode && typeof QRCode !== 'undefined') {
      modalQrcode.innerHTML = '';
      new QRCode(modalQrcode, {
        text: this.networkInfo.web_dashboard_url,
        width: 200,
        height: 200,
        colorDark: "#0b0f19",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }

  initModalEvents() {
    const qrBtn = document.getElementById('qrBtn');
    const qrModal = document.getElementById('qrModal');
    const closeQrModal = document.getElementById('closeQrModal');

    if (qrBtn && qrModal) {
      qrBtn.addEventListener('click', () => {
        qrModal.classList.remove('hidden');
      });
    }

    if (closeQrModal && qrModal) {
      closeQrModal.addEventListener('click', () => {
        qrModal.classList.add('hidden');
      });
    }

    const lanPill = document.getElementById('lanPill');
    if (lanPill) {
      lanPill.addEventListener('click', () => {
        if (this.networkInfo) {
          navigator.clipboard.writeText(this.networkInfo.web_dashboard_url);
          alert(`Copied LAN URL to clipboard: ${this.networkInfo.web_dashboard_url}`);
        }
      });
    }
  }
}
