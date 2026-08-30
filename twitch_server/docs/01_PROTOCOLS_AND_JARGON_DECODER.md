# 01. Streaming Protocols & Technical Jargon Decoder

Welcome to the **StreamPulse Protocol & Jargon Encyclopedia**. This guide breaks down the technical mechanics of real-time streaming protocols, internal packet flows, decision frameworks, and deep technical jargon with code references and revision question banks.

---

## 1. Technical Jargon Decoder & Packet Structures

| Term / Abbreviation | Full Name | Technical Definition & Internal Role |
| :--- | :--- | :--- |
| **SDP** | Session Description Protocol | Text-based format describing media capabilities (codecs, IP addresses, ports, encryption keys) exchanged during WebRTC setup. |
| **HLS** | HTTP Live Streaming | Apple's protocol that breaks video into HTTP-accessible media segments (`.ts` or `.m4s`) indexed by `.m3u8` playlists. |
| **DASH** | Dynamic Adaptive Streaming over HTTP | ISO standard (`ISO/IEC 23009-1`) that delivers media via XML manifest files (`.mpd`) and MP4 fragments. |
| **ARQ** | Automatic Repeat reQuest | An error-control method (used in SRT) where the receiver detects lost UDP packets and explicitly requests retransmission. |
| **FEC** | Forward Error Correction | Adding redundant error-correction data into UDP packet streams so lost packets can be reconstructed without retransmission. |
| **NACK** | Negative Acknowledgment | A WebRTC control message sent from receiver to sender requesting immediate retransmission of specific missing RTP sequence numbers. |
| **PLI** | Picture Loss Indication | A WebRTC RTCP feedback message asking the broadcaster's video encoder to generate a full keyframe (I-Frame) immediately. |
| **SEI** | Supplemental Enhancement Information | Uncompressed metadata inserted inside video NAL units (H.264/HEVC) used to carry UTC timestamps for glass-to-glass clock sync. |
| **SSRC** | Synchronization Source | A 32-bit unique identifier in every RTP packet header distinguishing audio, video, and screen-share streams within one UDP socket. |
| **DTLS** | Datagram Transport Layer Security | TLS adapted for UDP datagrams. Provides key exchange and encryption for WebRTC media streams. |
| **SRTP** | Secure Real-Time Transport Protocol | Encrypted version of RTP providing confidentiality, message authentication, and replay protection for video/audio frames. |
| **ABR** | Adaptive Bitrate Streaming | Technique where the client player dynamically switches video resolutions (1080p, 720p, 480p) based on real-time bandwidth. |
| **GOP** | Group of Pictures | A sequence of video frames starting with a keyframe (I-frame) followed by P/B frames. Keyframes are required to seek or start stream playback. |
| **fMP4** | Fragmented MP4 | A movie container format divided into independent chunks (`moof` + `mdat` boxes) allowing live HTTP streaming without needing a final file length. |

---

### Real-World Example: SDP (Session Description Protocol) Payload
When a client sends a WHIP request to `/api/whip` in [whip_whep.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/whip_whep.py#L34-L35), the HTTP body contains an SDP payload that looks like this:

```sdp
v=0
o=- 482910482910 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
m=video 52010 UDP/TLS/RTP/SAVPF 96 97
a=rtpmap:96 H264/90000
a=rtpmap:97 VP8/90000
a=fmtp:96 profile-level-id=42e01f;packetization-mode=1
a=fingerprint:sha-256 4A:AD:B9:B1:3F:24:11:06:50...
a=setup:actpass
a=candidate:1 1 UDP 2122260223 192.168.1.15 52010 typ host
a=candidate:2 1 UDP 1686052863 103.21.4.5 43902 typ srflx raddr 192.168.1.15 rport 52010
```

#### What does each line mean?
* `m=video 52010 UDP/TLS/RTP/SAVPF`: Indicates a video stream negotiating encrypted SRTP over UDP.
* `a=rtpmap:96 H264/90000`: Video codec is **H.264** with a **90 kHz clock rate** standard for video RTP streams.
* `a=fingerprint:sha-256 ...`: The certificate hash for the **DTLS handshake** over UDP.
* `a=candidate:2 ... typ srflx`: The **STUN-discovered Public IP (`103.21.4.5:43902`)** of the broadcaster's router.

---

## 2. Ingestion Protocols (Contribution: Streamer ➔ Server)

Ingestion protocols transfer high-bitrate video from broadcaster hardware (OBS Studio, mobile apps, camera hardware) to the ingest edge server.

```
 Broadcaster                     Ingest Edge PoP
┌───────────┐  WHIP / RTMP / SRT ┌─────────────────┐
│ OBS /     │───────────────────►│ Ingest Gateway  │
│ Camera    │  (Port 1935/8000)  │ (DTLS/TCP/UDP)  │
└───────────┘                    └─────────────────┘
```

### A. WHIP (WebRTC HTTP Ingestion Protocol - RFC 9261)
* **Transport & Security:** UDP / DTLS 1.2+ / SRTP
* **Latency:** 50 – 200 milliseconds
* **Code Trace in Server:** In [whip_whep.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/whip_whep.py#L31-L78):
  1. `whip_ingest(request)` reads `sdp_offer` from body.
  2. Creates `pc = RTCPeerConnection()`.
  3. Registers `@pc.on("track")` to append tracks into `active_streams["main"]`.
  4. Returns `pc.localDescription.sdp` answer with `Location: /api/whip/sessions/{session_id}` header.
* **Best Used For:** Browser-based camera streaming, mobile apps, low-latency sub-second contribution.

### B. RTMP (Real-Time Messaging Protocol)
* **Transport & Security:** TCP (Port 1935) / RTMPS (TLS Port 443)
* **Latency:** 1.5 – 3.0 seconds
* **Code Trace in Server:** In [rtmp_server.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/rtmp_server.py#L31-L55):
  1. Listens on TCP port 1935.
  2. Performs raw binary handshake (`C0+C1` $\rightarrow$ `S0+S1+S2` $\rightarrow$ `C2`).
  3. Parses incoming FLV video tags containing H.264 NAL units over TCP.
* **Best Used For:** Legacy OBS Studio setups, hardware encoder compatibility, fixed desktop connections.

### C. SRT (Secure Reliable Transport)
* **Transport & Security:** UDP + ARQ Error Correction + AES-128/256 Encryption (Port 9000)
* **Latency:** 100 – 500 milliseconds
* **Internal Mechanics (ARQ vs. FEC):**
  * **ARQ (Automatic Repeat reQuest):** Receiver detects sequence gap `[101, 102, MISSING, 104]` and sends an instant NACK back to the sender asking to resend `#103`.
  * **FEC (Forward Error Correction):** Sender sends redundant parity packets (`Packet A + Packet B = Parity C`). If `Packet B` is lost, the receiver mathematically reconstructs `B = Parity C - Packet A` without needing to wait for a retransmission!
* **Best Used For:** **Noisy / Unstable Public Internet** (e.g. mobile news reporting over 4G/5G cellular).

---

## 3. Egress Protocols (Distribution: Server ➔ Viewers)

### A. WHEP (WebRTC HTTP Egress Protocol)
* **Transport:** UDP / SRTP
* **Latency:** 50 – 200 milliseconds
* **Code Trace in Server:** In [whip_whep.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/whip_whep.py#L80-L123):
  * Connects viewer via WHEP `POST /api/whep`.
  * Wraps active broadcaster tracks using `relay.subscribe(track, buffered=False)` to fan out media over UDP to N viewers without frame buffering.

### B. LL-HLS & HLS Example Manifest (`stream.m3u8`)
Generated by [hls_dash_packager.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/hls_dash_packager.py#L48-L60):

```m3u8
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:101
#EXT-X-INDEPENDENT-SEGMENTS

#EXT-X-PROGRAM-DATE-TIME:2026-08-30T22:00:00.000Z
#EXTINF:2.000,
segment_101.ts
#EXTINF:2.000,
segment_102.ts
#EXTINF:2.000,
segment_103.ts
```

* **Best Used For:** Mass viewer scalability across Apple iOS, Safari, and web via `Hls.js`.

---

## 4. Revision Question Bank (Click to Expand Answers) 🧠

<details>
<summary><strong>Q1: Why does WHIP use HTTP POST for signaling instead of WebSockets?</strong></summary>
<br>
<strong>Answer:</strong> 
HTTP POST standardizes signaling into a simple RESTful interface (RFC 9261). With WebSockets, every platform created proprietary JSON formats (`{"type": "offer"}`). With WHIP, any hardware encoder (like OBS Studio or mobile cameras) can ingest WebRTC to ANY server without custom WebSocket client logic. HTTP POST sends the SDP offer, receives the SDP answer, and finishes immediately while media flows over a separate background UDP connection.
</details>

<details>
<summary><strong>Q2: What is the difference between ARQ and FEC in UDP streaming?</strong></summary>
<br>
<strong>Answer:</strong> 
<ul>
  <li><strong>ARQ (Automatic Repeat reQuest):</strong> The receiver detects a missing packet sequence number and sends a negative acknowledgment (NACK) back to the sender asking to resend the missing packet. Requires round-trip time (RTT).</li>
  <li><strong>FEC (Forward Error Correction):</strong> The sender adds extra mathematical parity packets alongside the video data. If a packet is lost, the receiver reconstructs it instantly using the parity data without needing a back-and-forth round trip.</li>
</ul>
</details>

<details>
<summary><strong>Q3: Why can't a media server just read the client's IP from the HTTP POST request header instead of using STUN?</strong></summary>
<br>
<strong>Answer:</strong> 
<ol>
  <li><strong>TCP vs. UDP:</strong> The HTTP POST request travels over TCP (Port 80/443), while WebRTC video travels over UDP. NAT routers assign completely different public port mappings for TCP and UDP connections.</li>
  <li><strong>Proxies & CDNs:</strong> HTTP requests often pass through reverse proxies or CDNs (Cloudflare), so the incoming HTTP IP is the CDN's IP, not the client's home router IP. STUN allows the client to discover its true public UDP IP and port mapping.</li>
</ol>
</details>

<details>
<summary><strong>Q4: What is PLI (Picture Loss Indication) and when is it sent?</strong></summary>
<br>
<strong>Answer:</strong> 
PLI is an RTCP feedback message sent from a WebRTC receiver (or media server) back to the broadcaster's video encoder. It says: <em>"I lost video state/frames and cannot decode further P-frames. Send a full I-frame (Keyframe) immediately!"</em> It is triggered when a new subscriber joins via WHEP or when severe packet loss occurs.
</details>

<details>
<summary><strong>Q5: What is the role of SEI (Supplemental Enhancement Information) NAL units?</strong></summary>
<br>
<strong>Answer:</strong> 
SEI NAL units contain uncompressed metadata embedded inside video stream frames. In live streaming systems like Twitch, SEI carries UTC millisecond timestamps inserted by the transcoder. Frontend players read SEI timestamps from video frames to synchronize chat messages and reaction ticks perfectly with the visual video playback position.
</details>
