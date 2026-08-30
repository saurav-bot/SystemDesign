import asyncio
import time
import numpy as np
import cv2
import av
from fractions import Fraction
from aiortc import MediaStreamTrack

VIDEO_CLOCK = 90000  # 90 kHz timebase standard for video RTP streams

class TimestampedTestPatternTrack(MediaStreamTrack):
    """
    Generates a synthetic live video stream track with:
    - Burned UTC timestamp (millisecond precision) for glass-to-glass latency testing
    - Animated test patterns (moving ball, color bars)
    - Frame counter and stream statistics overlay
    """
    kind = "video"

    def __init__(self, fps=30, width=640, height=360):
        super().__init__()
        self.fps = fps
        self.width = width
        self.height = height
        self.frame_count = 0
        self.ball_x = 50
        self.ball_y = 50
        self.ball_dx = 6
        self.ball_dy = 4
        self._start_time = time.time()

    async def recv(self):
        # Precise frame pacing drift compensation (30 fps)
        target_time = self._start_time + (self.frame_count + 1) * (1.0 / self.fps)
        sleep_duration = target_time - time.time()
        if sleep_duration > 0:
            await asyncio.sleep(sleep_duration)

        self.frame_count += 1
        pts = self.frame_count * int(VIDEO_CLOCK / self.fps)
        time_base = Fraction(1, VIDEO_CLOCK)

        # Build base frame (Dark gradient background)
        img = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Header banner
        img[0:60, :] = [30, 20, 20]
        
        # Color bar indicator at bottom
        bar_w = self.width // 6
        colors = [
            (255, 255, 255), (0, 255, 255), (255, 255, 0),
            (0, 255, 0), (255, 0, 255), (0, 0, 255)
        ]
        for i, col in enumerate(colors):
            img[self.height-40:self.height, i*bar_w:(i+1)*bar_w] = col

        # Update bouncing ball
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy
        if self.ball_x <= 30 or self.ball_x >= self.width - 30:
            self.ball_dx *= -1
        if self.ball_y <= 90 or self.ball_y >= self.height - 70:
            self.ball_dy *= -1

        cv2.circle(img, (self.ball_x, self.ball_y), 22, (0, 215, 255), -1)
        cv2.circle(img, (self.ball_x, self.ball_y), 22, (255, 255, 255), 2)

        # Timestamps for latency testing
        now_ms = int(time.time() * 1000)
        time_str = time.strftime("%H:%M:%S", time.localtime(now_ms / 1000.0)) + f".{now_ms % 1000:03d}"
        
        # Text Overlays
        cv2.putText(img, "TWITCH SERVER TEST SIGNAL GENERATOR", (15, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 200), 2)
        
        # Burn timestamp in bold green box for high visibility
        cv2.rectangle(img, (15, 75), (420, 125), (20, 20, 20), -1)
        cv2.rectangle(img, (15, 75), (420, 125), (0, 255, 128), 2)
        cv2.putText(img, f"SERVER TIME: {time_str}", (25, 108),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 128), 2)

        # Stats Overlay
        uptime = int(time.time() - self._start_time)
        cv2.putText(img, f"Frame: {self.frame_count} | Uptime: {uptime}s | FPS: {self.fps}", (15, 160),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        # Convert OpenCV BGR to PyAV VideoFrame
        frame = av.VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame
