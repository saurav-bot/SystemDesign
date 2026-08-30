# Comprehensive Guide: Real-Time Streaming Protocols & Twitch-Scale Architecture

Welcome to **StreamPulse Laboratory Guide**! This document provides a complete conceptual and architectural deep dive into modern real-time streaming protocols (**RTMP, WebRTC, WHIP, WHEP, DASH, LL-DASH, HLS, LL-HLS, SRT, RTSP**).

---

## 1. Protocol Matrix & Technical Comparison

| Protocol | Primary Purpose | Transport Protocol | Typical Glass-to-Glass Latency | Browser Native Support | Standard Port(s) | Key Advantage |
|---|---|---|---|---|---|---|
| **WHIP** (WebRTC HTTP Ingestion) | Ingest / Contribution | UDP / DTLS / SRTP | **50 - 200 ms** | Yes (`fetch` + SDP) | 8000 (HTTP) + UDP Ephemeral | Sub-second browser/OBS ingest without Flash/RTMP. |
| **WHEP** (WebRTC HTTP Egress) | Egress / Playback | UDP / DTLS / SRTP | **50 - 200 ms** | Yes (`PeerConnection`) | 8000 (HTTP) + UDP Ephemeral | Zero-latency interactive video viewing. |
| **RTMP** (Real-Time Messaging) | Legacy Ingest | TCP | **1.5 - 3.0 s** | No (Deprecated Flash) | 1935 (TCP) | Universal compatibility with older encoders & OBS. |
| **LL-HLS** (Low-Latency HLS) | Egress / Distribution | HTTP / TCP / HTTP/2 | **1.0 - 2.5 s** | Yes (Safari / Hls.js) | 80/443 (HTTP/S) | Scale to millions of concurrent viewers via standard CDNs. |
| **LL-DASH** (Low-Latency DASH) | Egress / Distribution | HTTP / Chunked-Transfer | **1.0 - 3.0 s** | Yes (Dash.js) | 80/443 (HTTP/S) | ISO standard adaptive bitrate distribution (YouTube style). |
| **SRT** (Secure Reliable Transport) | Contribution | UDP / ARQ Error Correction | **100 - 500 ms** | No (Requires WASM) | 9000 (UDP) | Packet loss resilience over unpredictable public internet. |
| **RTSP** (Real-Time Streaming) | IP Camera Ingest | TCP / UDP (RTP/RTCP) | **100 - 500 ms** | No | 554 (TCP/UDP) | Surveillance & hardware camera streams. |

---

## 2. Transport Protocol Comparison: UDP vs TCP vs QUIC

### **UDP (User Datagram Protocol)**
- **Used by**: WebRTC, WHIP, WHEP, SRT.
- **Why**: No TCP head-of-line blocking! If a single frame packet drops, UDP does NOT pause the entire stream playback to wait for retransmission; it drops the frame or uses FEC/NACKs to maintain real-time sub-second alignment.

### **TCP (Transmission Control Protocol)**
- **Used by**: RTMP, HLS, DASH.
- **Why**: Guarantees lossless, ordered delivery. Great for chunked video file downloads (HLS `.ts` files), but packet drops cause buffering stalls and increase latency.

### **QUIC / HTTP/3**
- **Used by**: Modern LL-HLS & WebTransport.
- **Why**: Runs over UDP, eliminating head-of-line blocking while offering multiplexed streams and quick connection setup.

---

## 3. Twitch Media Pipeline System Architecture

```
 Broadcaster                     Edge PoP                      Transcode Origin               CDN Edge                Subscribers
┌───────────┐                 ┌─────────────┐                ┌──────────────────┐          ┌────────────┐           ┌─────────────┐
│ OBS /     │  RTMP / WHIP    │ Ingest PoP  │  Internal IP   │ Transcode Cluster│  LL-HLS  │ Edge Cache │  HTTP / TS │ Viewer      │
│ Smartphone│───────────────> │  Gateway    │───────────────>│ (ABR Ladder:     │─────────>│ (Fastly /  │───────────>│ (Hls.js /   │
│ Camera    │ (Port 1935/8000)│ (TLS/SRTP)  │                │ 1080p60 -> 360p) │ (.m3u8)  │ Cloudflare)│  (fMP4)    │ Player)     │
└───────────┘                 └─────────────┘                └──────────────────┘          └────────────┘           └─────────────┘
```

1. **Ingest Stage**: The stream enters via RTMP (Port 1935) or WHIP (`POST /api/whip`).
2. **Transcoding Cluster**: GPU worker instances parse video elementary streams and generate an Adaptive Bitrate (ABR) ladder (e.g. 1080p 60fps @ 6Mbps down to 160p @ 300kbps).
3. **Packaging & Origin**: The packager outputs fMP4 chunks (1-second duration) and updates `.m3u8` index playlists.
4. **CDN Edge Delivery**: Multi-tiered CDN caches HLS fragments. Viewers fetch fragments over standard HTTP/2.
5. **Player Sync**: Twitch Chat runs over WebSockets, synchronized using UTC timestamps embedded inside video SEI (Supplemental Enhancement Information) NAL units.

---

## 4. Multi-Device Local Area Network (LAN) Instructions

1. **Find LAN IP**: The server automatically prints your LAN IPv4 address on startup (e.g., `http://192.168.1.15:8000`).
2. **Connect Mobile Phone**:
   - Ensure your phone is connected to the **same Wi-Fi router**.
   - Open mobile camera and scan the QR code displayed on the top right of the dashboard.
   - You can publish mobile camera video via WHIP directly to your desktop!
3. **OBS Studio Configuration**:
   - Go to **Settings -> Stream -> Custom...**
   - **Server**: `rtmp://<your-lan-ip>:1935/live`
   - **Stream Key**: `test_stream`
   - Click **Start Streaming** in OBS.

---

## 5. Running the Media Server

Run the unified Twitch Media Server using python:
```bash
python -m twitch_server
```
This initializes:
- HTTP API & Dashboard on `http://0.0.0.0:8000`
- RTMP Ingest Server on `rtmp://0.0.0.0:1935/live`
- WebRTC WHIP (`/api/whip`) & WHEP (`/api/whep`) Endpoints
- WebRTC WebSocket Signaling Hub (`/ws/signaling`)
- Live HLS (`/live/hls`) & DASH (`/live/dash`) Packaging

