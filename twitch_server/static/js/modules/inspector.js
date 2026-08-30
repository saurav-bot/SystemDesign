/**
 * Protocol Inspector Module
 * Highlight active protocols in the comparison matrix and updates transport info
 */

class ProtocolInspector {
  constructor() {
    this.pubSelect = document.getElementById('publisherProtocolSelect');
    this.subSelect = document.getElementById('subscriberProtocolSelect');
    this.transportPill = document.getElementById('transportPill');
    this.pubBadge = document.getElementById('pubProtocolBadge');
    this.subBadge = document.getElementById('subProtocolBadge');
  }

  updateInspectorView() {
    const pubProto = this.pubSelect?.value || 'WHIP';
    const subProto = this.subSelect?.value || 'WHEP';

    if (this.pubBadge) this.pubBadge.innerText = pubProto;
    if (this.subBadge) this.subBadge.innerText = subProto;

    // Update Transport Pill
    if (this.transportPill) {
      if (pubProto === 'WHIP' || subProto === 'WHEP' || pubProto === 'WEBRTC_DIRECT') {
        this.transportPill.innerText = 'UDP / DTLS / SRTP';
      } else if (subProto === 'LL_HLS' || subProto === 'HLS' || subProto === 'DASH') {
        this.transportPill.innerText = 'HTTP / TCP / fMP4';
      } else if (pubProto === 'RTMP_OBS') {
        this.transportPill.innerText = 'TCP / FLV Tags (Port 1935)';
      }
    }

    // Highlight row in comparison table
    document.querySelectorAll('.protocol-table tr').forEach(row => {
      row.classList.remove('highlight-row');
    });

    const targetRowId = `row-${subProto}`;
    const targetRow = document.getElementById(targetRowId);
    if (targetRow) {
      targetRow.classList.add('highlight-row');
    }
  }

  initListeners() {
    if (this.pubSelect) {
      this.pubSelect.addEventListener('change', () => this.updateInspectorView());
    }
    if (this.subSelect) {
      this.subSelect.addEventListener('change', () => this.updateInspectorView());
    }
    this.updateInspectorView();
  }
}
