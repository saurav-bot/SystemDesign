# 04. Interactive System Design Revision Question Bank

This document serves as an **interactive interview preparation & revision masterclass**. Test your technical knowledge on live video streaming architecture, WebRTC, WHIP/WHEP, HLS, DASH, networking, and high-concurrency real-time systems.

---

## 🎯 Section 1: Ingestion & Networking Protocols

<details>
<summary><strong>Q1: Compare RTMP and WHIP. Why are modern streaming platforms migrating to WHIP?</strong></summary>
<br>
<strong>Answer:</strong>
<ul>
  <li><strong>RTMP:</strong> Runs over TCP (Port 1935), suffers from head-of-line blocking, has 1.5–3s latency, and uses legacy FLV tags.</li>
  <li><strong>WHIP:</strong> Standardized WebRTC HTTP ingestion (RFC 9261) running over UDP (DTLS/SRTP). Has 50–200ms latency and is natively supported in modern browsers and OBS Studio.</li>
  <li><strong>Migration Reason:</strong> WHIP eliminates TCP latency stalls, enables sub-second interactive streams, and standardizes WebRTC signaling via simple HTTP POST requests.</li>
</ul>
</details>

<details>
<summary><strong>Q2: Why is UDP preferred over TCP for real-time video streaming (<200ms)?</strong></summary>
<br>
<strong>Answer:</strong>
TCP enforces strict ordered delivery. If a single packet drops, TCP pauses stream playback to wait for retransmission (Head-of-Line Blocking), causing buffering stalls. UDP allows dropping a damaged frame or requesting a fast NACK/FEC repair without stopping the entire media pipeline, maintaining real-time alignment.
</details>

<details>
<summary><strong>Q3: How does STUN help a WebRTC client behind a home router establish a connection?</strong></summary>
<br>
<strong>Answer:</strong>
A home router uses NAT (Network Address Translation) assigning private IP addresses (e.g. <code>192.168.1.15</code>). A STUN server sits on the public internet. The client sends a UDP ping to the STUN server, which responds with the client's public router IP and external UDP port (Reflexive Candidate). The client includes this public address in its SDP offer so the server knows where to direct media packets.
</details>

<details>
<summary><strong>Q4: What is the difference between STUN and TURN?</strong></summary>
<br>
<strong>Answer:</strong>
<ul>
  <li><strong>STUN (Session Traversal Utilities for NAT):</strong> Discovers the client's public IP/port. Media traffic flows directly between client and server. Lightweight & cheap.</li>
  <li><strong>TURN (Traversal Using Relays around NAT):</strong> Used when symmetric NATs or strict corporate firewalls block direct UDP P2P traffic. Media is relayed entirely through the TURN server over TCP/TLS. Heavy & expensive.</li>
</ul>
</details>

<details>
<summary><strong>Q5: What is the purpose of the ICE (Interactive Connectivity Establishment) protocol?</strong></summary>
<br>
<strong>Answer:</strong>
ICE is the framework that gathers all possible connection paths (host IPs, STUN reflexive IPs, TURN relay IPs) into candidates, exchanges them via SDP, and systematically tests pairs using STUN pings to find the fastest, lowest-latency path.
</details>

---

## 🏗️ Section 2: Media Processing, Transcoding & Packaging

<details>
<summary><strong>Q6: What is an Adaptive Bitrate (ABR) ladder and why is it necessary?</strong></summary>
<br>
<strong>Answer:</strong>
An ABR ladder is a set of pre-configured video resolutions and bitrates (e.g., 1080p@6Mbps, 720p@3Mbps, 480p@1.5Mbps, 360p@800kbps) generated concurrently by the transcoder. It allows viewer players to dynamically switch streams based on real-time bandwidth fluctuations without buffering.
</details>

<details>
<summary><strong>Q7: Why must all renditions in an ABR ladder have keyframes (IDR frames) aligned at identical timestamps?</strong></summary>
<br>
<strong>Answer:</strong>
Video decoders require a keyframe (I-frame) to begin decoding a video stream. If keyframes are not aligned across 1080p and 720p streams down to the exact frame number, switching resolutions mid-playback will cause decoding errors, visual corruption, or screen freezes.
</details>

<details>
<summary><strong>Q8: What is fragmented MP4 (fMP4) and how does it differ from a standard MP4 file?</strong></summary>
<br>
<strong>Answer:</strong>
Standard MP4 files store movie header metadata (the <code>moov</code> atom) at the end of the file, requiring the file to be completely written before playback. Fragmented MP4 (fMP4) divides video into small, self-contained chunks containing <code>moof</code> (movie fragment header) and <code>mdat</code> (media data) boxes. This allows live streaming of MP4 segments over HTTP as they are created in real time.
</details>

<details>
<summary><strong>Q9: Explain the difference between HLS (.m3u8) and DASH (.mpd).</strong></summary>
<br>
<strong>Answer:</strong>
<ul>
  <li><strong>HLS (HTTP Live Streaming):</strong> Created by Apple. Uses UTF-8 playlist files (<code>.m3u8</code>) referencing <code>.ts</code> or <code>.m4s</code> chunks. Native on iOS/Safari.</li>
  <li><strong>DASH (Dynamic Adaptive Streaming over HTTP):</strong> ISO standard. Uses XML manifest files (<code>.mpd</code>). Popular on Android, Smart TVs, and YouTube.</li>
</ul>
</details>

---

## ⚡ Section 3: High-Scale Architecture (1M CCU) & CDNs

<details>
<summary><strong>Q10: Why can't a single origin server serve 1 million concurrent HLS viewers directly?</strong></summary>
<br>
<strong>Answer:</strong>
Serving 1M viewers watching a 3 Mbps stream requires <strong>3.0 Terabits per second (Tbps)</strong> of outbound network throughput and millions of open HTTP connections. A single server network card caps out at 10 to 100 Gbps. Global multi-tiered CDNs are required to cache static segment files at edge PoPs near users.
</details>

<details>
<summary><strong>Q11: What is the "Thundering Herd Problem" in live streaming and how is it solved?</strong></summary>
<br>
<strong>Answer:</strong>
When a new 2-second video fragment drops, thousands of CDN edge servers simultaneously request the segment from the origin server, crushing it. It is solved using <strong>Origin Shielding with Request Collapsing</strong>: the shield server coalesces 10,000 incoming requests for the same segment URL into 1 single backend fetch, caching and serving the result to all edge nodes.
</details>

<details>
<summary><strong>Q12: What HTTP Cache-Control headers should be used for live HLS manifests vs. video segments?</strong></summary>
<br>
<strong>Answer:</strong>
<ul>
  <li><strong>Manifests (<code>.m3u8</code>):</strong> <code>Cache-Control: public, max-age=1, stale-while-revalidate=1</code> (Must expire quickly since playlists update every 1–2 seconds).</li>
  <li><strong>Segments (<code>.m4s</code> / <code>.ts</code>):</strong> <code>Cache-Control: public, max-age=31536000, immutable</code> (Segments are immutable files that never change).</li>
</ul>
</details>

<details>
<summary><strong>Q13: How does SFU Cascading allow WebRTC to scale to thousands of interactive stage viewers?</strong></summary>
<br>
<strong>Answer:</strong>
Instead of 1 SFU handling all connections, SFUs are arranged in a tree hierarchy: Ingest SFU ➔ Regional Hub SFUs ➔ Edge SFUs. Media packets are forwarded downstream over high-speed internal backbones. Edge SFUs terminate the final WebRTC connections to end viewers without transcoding.
</details>

---

## 💬 Section 4: Chat, Reactions & Synchronization Engine

<details>
<summary><strong>Q14: How do you handle 100,000 likes/sec during a live event without melting backend databases?</strong></summary>
<br>
<strong>Answer:</strong>
By using <strong>Windowed In-Memory Aggregation</strong>. Edge gateways pipeline likes directly to Redis using <code>HINCRBY</code> counters on a 100ms window key. Every 100ms, an aggregator service reads the accumulated total (e.g. <code>+15,420 likes</code>) and broadcasts a single composite payload tick to viewers instead of processing individual clicks.
</details>

<details>
<summary><strong>Q15: How do you synchronize live chat playback with video frames to prevent spoilers?</strong></summary>
<br>
<strong>Answer:</strong>
The transcoder burns UTC timestamps into video frame **SEI (Supplemental Enhancement Information) metadata**. The frontend JavaScript player extracts SEI timestamps during frame rendering (`requestVideoFrameCallback()`) and holds chat messages in a local buffer, only displaying messages when the video's SEI timestamp matches or exceeds the message timestamp.
</details>

<details>
<summary><strong>Q16: Why is Elixir Phoenix or Go preferred over Node.js/Python for WebSocket Edge Gateways?</strong></summary>
<br>
<strong>Answer:</strong>
Elixir (Erlang BEAM VM) and Go utilize lightweight concurrency primitives (actor processes / goroutines) with tiny memory footprints (~2KB per connection vs ~30KB+ in thread-per-connection models). A single Elixir or Go node can maintain over 1,000,000 concurrent long-lived TCP WebSocket sockets with low CPU overhead.
</details>
