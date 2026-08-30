# 03. Real-Time Chat & Likes/Reactions Engine at Scale

This document specifies the system design for handling **Live Chat**, **Reactions (Likes/Emotes)**, and **Glass-to-Glass Video Synchronization** at a scale of **1 Million Concurrent Users** ($1,000,000\text{ CCU}$) and **100,000+ events per second**.

---

## 1. High-Level Chat & Reaction Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CHAT & REACTION PIPELINE                                 │
│                                                                                         │
│  Viewers (1M CCU)            WebSocket Edge Gateways           Pub/Sub & Processing     │
│ ┌──────────────────┐        ┌───────────────────────┐        ┌──────────────────────┐   │
│ │ WebSockets /     ├───────►│ Stateful WS Nodes     ├───────►│ Apache Kafka / NATS  │   │
│ │ WebTransport     │        │ (Go / Elixir Phoenix) │        │ (Partition: channel) │   │
│ └──────────────────┘        └───────────▲───────────┘        └──────────┬───────────┘   │
│                                         │                               │               │
│                                         │ Micro-Batch Broadcast         ▼               │
│                                         │ (Every 100ms)      ┌──────────────────────┐   │
│                                         └────────────────────┤ 100ms Aggregator     │   │
│                                                              │ (Redis / Rust Engine)│   │
│                                                              └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Solving the 250 Billion Frame Explosion Problem

If 500,000 viewers type a message or hit "Like" during a hype moment:
* **Naive Approach:** Broadcasting 500,000 individual WebSocket messages per second to 500,000 connected clients = **$250,000,000,000\text{ (250 Billion) WebSocket frames/sec}$**!
* **Solution (Server-Side 100ms Micro-Batching):** An Aggregator service buffers incoming events and produces **10 tick frames per second**:

```json
{
  "event": "channel_tick",
  "channel_id": "shroud",
  "server_utc_ms": 1772381200450,
  "chat_messages": [
    { "user": "alex", "text": "POG!", "badge": "subscriber" },
    { "user": "sarah", "text": "What a shot!", "badge": "vip" }
  ],
  "reaction_summary": {
    "total_likes_delta": 3450,
    "top_emotes": { "LUL": 820, "PogChamp": 650, "🔥": 410 }
  }
}
```

---

## 3. Concrete Redis Commands for 100ms Aggregation

When 100,000 viewers click "Like" or send emotes:
1. **Edge Gateway Pipeline:** Instead of writing to database, gateways send pipeline updates to Redis:
   ```redis
   # Increment total likes counter for channel 'shroud' in current 100ms window
   HINCRBY "reactions:shroud:1772381200400" "likes" 1540

   # Increment emote counters
   HINCRBY "reactions:shroud:1772381200400" "emote:LUL" 820
   HINCRBY "reactions:shroud:1772381200400" "emote:PogChamp" 650
   
   # Set TTL so temporary window keys expire automatically after 10 seconds
   EXPIRE "reactions:shroud:1772381200400" 10
   ```
2. **Aggregator Worker:** Every 100ms, the worker fetches `HGETALL "reactions:shroud:<window>"`, constructs the JSON payload tick, and publishes it to Kafka/NATS for WebSocket edge fan-out.

---

## 4. Glass-to-Glass SEI Video Synchronization (JavaScript Code)

To prevent chat spoilers, the frontend player uses HTML5 `requestVideoFrameCallback()` to extract embedded SEI timestamps and sync chat rendering with the exact video frame being drawn on screen:

```javascript
// Frontend Player Synchronization Engine
const chatQueue = []; // Incoming WebSocket messages buffer

videoElement.requestVideoFrameCallback(function syncFrame(now, metadata) {
  // Read SEI timestamp embedded in current video frame
  const currentVideoUtcMs = metadata.seiTimestamp || Date.now();

  // Render ONLY chat messages that occurred on or before this video frame's time
  while (chatQueue.length > 0 && chatQueue[0].server_utc_ms <= currentVideoUtcMs) {
    const msg = chatQueue.shift();
    renderChatMessageToDOM(msg);
  }

  // Register callback for next video frame
  videoElement.requestVideoFrameCallback(syncFrame);
});
```

---

## 5. Failure Modes & Resilience Architecture

1. **Redis Sentinel Failover:** If a primary Redis shard fails, Redis Sentinel promotes a replica in <2 seconds. Edge Gateways buffer likes locally in memory during failover.
2. **WebSocket Reconnect Storm Protection:** If an edge WS node crashes, 10,000 clients reconnect simultaneously. Clients use **Exponential Backoff with Random Jitter** (`delay = min(30s, (2^retry) * 1000 + random(0, 1000))`) to prevent DDOSing the auth service.

---

## 6. Revision Question Bank (Click to Expand Answers) 🧠

<details>
<summary><strong>Q1: Why is Kafka partitioned by channel_id in a live chat architecture?</strong></summary>
<br>
<strong>Answer:</strong> 
Kafka guarantees total message ordering <em>only within a single partition</em>. By setting the partition key to <code>channel_id</code>, all chat messages for a specific streamer (e.g. <code>shroud</code>) land on the exact same Kafka partition and are processed by the same worker instance in strict chronological order.
</details>

<details>
<summary><strong>Q2: How does 100ms micro-batching prevent browser crashes during viral live streams?</strong></summary>
<br>
<strong>Answer:</strong> 
Without batching, 50,000 chat messages/sec forces the browser to handle 50,000 individual WebSocket events, triggering 50,000 DOM re-renders/sec (crashing the UI thread). Micro-batching groups messages into 10 composite JSON updates per second. The browser renders 10 UI updates/sec, reducing CPU usage by 99.9%.
</details>

<details>
<summary><strong>Q3: How do we prevent chat spoilers when video latency varies across viewers?</strong></summary>
<br>
<strong>Answer:</strong> 
By using SEI (Supplemental Enhancement Information) NAL units. The transcoder embeds a UTC timestamp into the video frames. The frontend player holds incoming WebSocket chat messages in a buffer and only releases messages into the DOM when the video player's current SEI frame timestamp reaches or exceeds the message timestamp.
</details>

<details>
<summary><strong>Q4: What happens during a WebSocket Reconnect Storm and how is it mitigated?</strong></summary>
<br>
<strong>Answer:</strong> 
When a WebSocket server node crashes, thousands of connected clients lose their TCP sockets simultaneously and attempt to reconnect at the exact same instant, crushing the Authentication service. It is mitigated by enforcing <strong>Exponential Backoff with Random Jitter</strong> on the client reconnect loop so requests are evenly spread over time.
</details>
