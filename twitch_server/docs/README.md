# StreamPulse / Twitch Server Architecture Documentation

Welcome to the comprehensive technical documentation and interactive revision system for the **StreamPulse Twitch-Scale Real-Time Streaming Server**.

---

## Documentation & Revision Modules

### 📖 [01. Streaming Protocols & Technical Jargon Decoder](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/docs/01_PROTOCOLS_AND_JARGON_DECODER.md)
* **Technical Jargon Dictionary:** SDP, HLS, DASH, ARQ, FEC, NACK, PLI, SEI, SSRC, DTLS, SRTP, ABR, GOP, fMP4.
* **Ingestion Protocols:** WHIP, RTMP, SRT, RTSP (Internal mechanics, flows, & scenario selection).
* **Egress Protocols:** WHEP, LL-HLS, LL-DASH, HTTP-FLV.
* **Revision Question Bank:** Embedded `<details>` questions on protocols & networking.

### 🏗️ [02. Production Architecture for 1 Million Concurrent Users](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/docs/02_SYSTEM_ARCHITECTURE_1M_CONCURRENT.md)
* **High-Level Design (HLD):** Anycast Edge PoPs, Stateless Ingest Gateways, GPU Transcoding.
* **1M CCU Capacity Math:** Bandwidth calculations ($3.38\text{ Tbps}$) and origin offload strategies.
* **Transcoding & ABR Ladder:** NVIDIA NVENC GOP alignment & SEI NAL unit timestamping.
* **Multi-Tier CDN Caching:** Request collapsing, origin shielding, cache control headers.
* **Revision Question Bank:** Embedded `<details>` questions on system design & capacity planning.

### 💬 [03. Real-Time Chat & Likes/Reactions Engine at Scale](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/docs/03_REALTIME_CHAT_AND_REACTIONS_ENGINE.md)
* **Massive Scaling Challenge:** Solving the 250 Billion WebSocket frame explosion problem.
* **Connection & Event Tier:** Elixir Phoenix / Go WebSocket Gateways + Kafka Topic Partitioning.
* **100ms Micro-Batch Aggregator:** Redis pipeline commands, server-side message merging, and reaction windowing.
* **Glass-to-Glass SEI Sync:** JavaScript code (`requestVideoFrameCallback()`) for frame-accurate chat sync.
* **Revision Question Bank:** Embedded `<details>` questions on chat & reaction scaling.

### 🎯 [04. Interactive Revision Question Bank Masterclass](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/docs/04_INTERACTIVE_REVISION_QUESTION_BANK.md)
* **16 Comprehensive System Design & Networking Questions** with hidden clickable `<details><summary>` answers.
* **System Design Interview Prep:** Ingestion, WebRTC vs CDNs, NAT Traversal, STUN/TURN, Transcoding, ABR, Origin Shielding, Redis aggregation, and SEI clock sync.

---

## Implementation Map (Source Code Links)

* **WHIP / WHEP Endpoints:** [whip_whep.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/whip_whep.py)
* **RTMP Ingest Server:** [rtmp_server.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/rtmp_server.py)
* **HLS & DASH Packager:** [hls_dash_packager.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/hls_dash_packager.py)
* **WebRTC WebSocket Signaling:** [webrtc_signaling.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/webrtc_signaling.py)
* **Protocol Strategy Adapters (JS):** [protocolAdapters.js](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/static/js/modules/protocolAdapters.js)
