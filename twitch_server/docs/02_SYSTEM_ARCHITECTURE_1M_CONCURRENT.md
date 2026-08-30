# 02. Production System Architecture for 1 Million Concurrent Users

This document outlines the **production-grade System Design Blueprint** for scaling a real-time live streaming platform to **1 Million Concurrent Viewers** ($1,000,000\text{ CCU}$) with sub-2-second latency, high availability ($99.99\%$), and adaptive bitrate streaming.

---

## 1. End-to-End High Level Architecture (HLD)

```
                                      ANYCAST BGP EDGE POPs
                                ┌──────────────────────────────┐
                                │ Geo-DNS / Anycast Load Balancer│
                                └──────────────┬───────────────┘
                                               │
                                ┌──────────────┴───────────────┐
                                │  Ingest Gateways (Go / Rust) │
                                │  (WHIP / RTMP / SRT Ingest)  │
                                └──────────────┬───────────────┘
                                               │
                                ┌──────────────▼───────────────┐
                                │  Transcoding Cluster (GPUs)  │
                                │  (NVIDIA NVENC ABR Ladder)   │
                                └──────────────┬───────────────┘
                                               │
                                ┌──────────────▼───────────────┐
                                │   Origin Shield Packager     │
                                │ (fMP4 / HLS .m3u8 / DASH .mpd)│
                                └──────┬────────────────┬──────┘
                                       │                │
           ┌───────────────────────────┘                └──────────────────────────┐
           │ (Interactive <200ms)                                                  │ (Mass Distribution 1-2s)
           ▼                                                                       ▼
┌────────────────────────────┐                                  ┌────────────────────────────────────┐
│ SFU Cascade Cluster        │                                  │ Multi-Tier CDN Edge                │
│ (C++ / Rust Mediasoup Tree)│                                  │ (Cloudflare / Fastly Edge Caches)  │
└──────────┬─────────────────┘                                  └─────────────────┬──────────────────┘
           │                                                                      │
           ▼                                                                      ▼
┌────────────────────────────┐                                  ┌────────────────────────────────────┐
│ VIP / Stage Viewers (5,000)│                                  │ Mass Viewers (995,000 CCU)         │
│ (WHEP / WebRTC Egress)     │                                  │ (LL-HLS / LL-DASH Player)          │
└────────────────────────────┘                                  └────────────────────────────────────┘
```

---

## 2. Step-by-Step Flow: From Camera to 1M Viewers

### Step A: Stream Ingestion
1. Broadcaster opens OBS Studio or mobile app and clicks "Start Streaming".
2. BGP Anycast routes `ingest.streampulse.io` to the closest PoP (e.g. `ingest-iad.streampulse.io` in Virginia).
3. The broadcaster initiates WHIP via HTTP `POST /api/whip` (see implementation in [whip_whep.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/whip_whep.py#L31)).
4. Encrypted SRTP video packets begin flowing over UDP at 6,000 kbps (1080p 60fps).

### Step B: GPU Transcoding & ABR Ladder Generation
1. Ingest node passes raw elementary stream to a GPU worker instance equipped with NVIDIA A10G cards.
2. FFmpeg / NVENC hardware encoder generates 4 parallel renditions (the **ABR Ladder**):
   * `1080p60` @ 6,000 kbps (Source)
   * `720p60`  @ 3,000 kbps
   * `480p30`  @ 1,500 kbps
   * `360p30`  @ 800 kbps
3. **Strict GOP Alignment:** Keyframes (IDR frames) are forced every 60 frames (exactly 2.0 seconds).
4. **SEI Timestamp Insertion:** Transcoder burns UTC timestamp `1772381200450` into the SEI metadata header of each keyframe.

### Step C: Origin Packaging & Request Collapsing
1. Origin Packager receives transcoded frames and generates 2-second fragmented MP4 (`.m4s`) files + `.m3u8` playlists (see code pattern in [hls_dash_packager.py](file:///home/saurav/finalPreparations/SystemDesign/twitch_server/hls_dash_packager.py#L48-L73)).
2. **Origin Shield (Varnish / NGINX):** Sits in front of the packager. When 500 CDN edge nodes request `segment_500.m4s` simultaneously:
   * Origin Shield forwards **ONLY 1 request** to the Packager.
   * It holds the remaining 499 requests in memory and satisfies them all from the single response (**Request Collapsing / Thundering Herd Prevention**).

### Step D: CDN Edge Caching & Delivery
1. CDN Edge Nodes (Fastly / Cloudflare) cache `.m4s` video segments globally.
2. **Cache Headers:**
   * Manifests (`.m3u8`): `Cache-Control: public, max-age=1, stale-while-revalidate=1`
   * Segments (`.m4s`): `Cache-Control: public, max-age=31536000, immutable`
3. 995,000 public viewers download `.m4s` fragments over HTTP/2, achieving 1.5-second glass-to-glass latency with zero origin server load!

---

## 3. Bandwidth Math for 1 Million Viewers

$$\text{Outbound Bandwidth} = \sum (\text{Viewers in Tier} \times \text{Tier Bitrate})$$

* **1080p (30% viewers = 300,000):** $300,000 \times 6\text{ Mbps} = 1.80\text{ Tbps}$
* **720p (40% viewers = 400,000):** $400,000 \times 3\text{ Mbps} = 1.20\text{ Tbps}$
* **480p (20% viewers = 200,000):** $200,000 \times 1.5\text{ Mbps} = 0.30\text{ Tbps}$
* **360p (10% viewers = 100,000):** $100,000 \times 0.8\text{ Mbps} = 0.08\text{ Tbps}$

$$\text{Total Bandwidth} = 1.80 + 1.20 + 0.30 + 0.08 = \mathbf{3.38\text{ Terabits per Second (Tbps)}}$$

> **CDN Cache Efficiency:** With a $99.8\%$ CDN Cache Hit Ratio, origin egress is reduced from $3,380,000\text{ Mbps}$ down to just **$6,760\text{ Mbps}$ ($6.76\text{ Gbps}$)**!

---

## 4. Revision Question Bank (Click to Expand Answers) 🧠

<details>
<summary><strong>Q1: Why is exact GOP (Group of Pictures) alignment mandatory across all ABR renditions?</strong></summary>
<br>
<strong>Answer:</strong> 
If keyframes (I-frames) are not aligned down to the exact frame number across 1080p, 720p, and 480p profiles, switching streams when a viewer's network drops will cause screen blackouts, audio desynchronization, or decoding crashes. Keyframe alignment allows the player engine (`Hls.js`) to seamlessly swap segment URLs at keyframe boundaries mid-stream.
</details>

<details>
<summary><strong>Q2: What is "Origin Shielding" and what problem does it solve?</strong></summary>
<br>
<strong>Answer:</strong> 
Origin Shielding is an intermediate caching layer placed between public CDN edge servers and the origin packager. When a new 2-second video segment (`segment_100.m4s`) drops, thousands of CDN edge nodes around the world request it at the exact same millisecond. Without Origin Shielding, thousands of requests would slam the origin packager (Thundering Herd Problem). The Origin Shield collapses these requests into 1 single fetch from origin and broadcasts it to all CDN edges.
</details>

<details>
<summary><strong>Q3: Why can't we scale 1 million concurrent viewers using WebRTC (WHEP) alone?</strong></summary>
<br>
<strong>Answer:</strong> 
WebRTC requires a stateful, uncacheable UDP session for every single viewer. Serving 1 million WebRTC connections requires maintaining 1 million active UDP sockets, encryption contexts, and SFU server nodes. In contrast, LL-HLS video fragments are static HTTP files (`.m4s`) that can be cached on existing global CDN edge servers (Cloudflare/Fastly) at near-zero incremental server cost.
</details>

<details>
<summary><strong>Q4: How does dynamic multi-CDN routing work?</strong></summary>
<br>
<strong>Answer:</strong> 
The client-side video player runs a background probe measuring latency and packet loss to multiple CDN vendors (Fastly, Cloudflare, AWS CloudFront). If Fastly experiences a regional outage or high packet loss, the frontend player dynamically switches its segment base URL to Cloudflare without interrupting video playback.
</details>
