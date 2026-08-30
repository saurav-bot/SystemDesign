/**
 * StreamPulse Application Orchestrator
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Initializing StreamPulse Application...");

  // Elements
  const pubVideo = document.getElementById('publisherVideo');
  const subVideo = document.getElementById('subscriberVideo');
  const timestampCanvas = document.getElementById('timestampCanvas');

  // Initialize Modules
  const broadcaster = new BroadcasterStudio(pubVideo, timestampCanvas);
  const player = new PlayerStudio(subVideo);
  const latencyTester = new LatencyTester();
  const inspector = new ProtocolInspector();
  const lanManager = new LanManager();

  // Load Network Configuration
  await lanManager.fetchNetworkInfo();
  lanManager.initModalEvents();
  inspector.initListeners();
  latencyTester.startMonitoring(1000);

  // Broadcaster Source Tabs (Webcam, Screen, Pattern)
  document.querySelectorAll('.source-selector .btn-tab').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      document.querySelectorAll('.source-selector .btn-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sourceType = btn.getAttribute('data-source');
      await broadcaster.getMediaStream(sourceType);
    });
  });

  // Start Ingest Button
  const startPubBtn = document.getElementById('startPubBtn');
  const stopPubBtn = document.getElementById('stopPubBtn');
  const publisherProtocolSelect = document.getElementById('publisherProtocolSelect');

  if (startPubBtn) {
    startPubBtn.addEventListener('click', async () => {
      try {
        const selectedProtocol = publisherProtocolSelect.value;
        await broadcaster.startPublishing(selectedProtocol);
        startPubBtn.classList.add('hidden');
        if (stopPubBtn) stopPubBtn.classList.remove('hidden');
      } catch (err) {
        alert(`Broadcaster Ingest Error: ${err.message}`);
        console.error(err);
      }
    });
  }

  if (stopPubBtn) {
    stopPubBtn.addEventListener('click', async () => {
      await broadcaster.stopPublishing();
      stopPubBtn.classList.add('hidden');
      if (startPubBtn) startPubBtn.classList.remove('hidden');
    });
  }

  // Connect Player Button
  const connectSubBtn = document.getElementById('connectSubBtn');
  const subscriberProtocolSelect = document.getElementById('subscriberProtocolSelect');

  if (connectSubBtn) {
    connectSubBtn.addEventListener('click', async () => {
      try {
        const selectedProtocol = subscriberProtocolSelect.value;
        await player.connect(selectedProtocol);
      } catch (err) {
        alert(`Subscriber Player Error: ${err.message}`);
        console.error(err);
      }
    });
  }

  // Initial media stream pre-warm
  try {
    await broadcaster.getMediaStream('pattern');
  } catch (e) {
    console.log("Auto-preview media track pre-warm deferred:", e);
  }
});
