import os
import shutil
import asyncio
import logging
from twitch_server.config import HLS_DIR, DASH_DIR

logger = logging.getLogger("TwitchServer.Packager")

class HLSDashPackager:
    """Manages packaging of live video streams into HLS (.m3u8 + .ts) and DASH (.mpd + .m4s)."""
    def __init__(self):
        self.is_packaging = False
        self._hls_process = None
        self._dash_process = None
        self._ffmpeg_path = shutil.which("ffmpeg") or "/snap/bin/ffmpeg"

    async def start(self):
        if not self.is_packaging:
            self.is_packaging = True
            if os.path.exists(self._ffmpeg_path):
                logger.info(f"FFmpeg found at {self._ffmpeg_path}. Initializing real-time HLS & DASH packaging...")
                await self._start_ffmpeg_packagers()
            else:
                logger.warning("FFmpeg binary not found. Falling back to synthetic manifest generator.")
                asyncio.create_task(self._fallback_manifest_loop())

    async def stop(self):
        self.is_packaging = False
        if self._hls_process:
            try:
                self._hls_process.terminate()
                await self._hls_process.wait()
            except Exception:
                pass
            logger.info("HLS FFmpeg Packager stopped.")
        if self._dash_process:
            try:
                self._dash_process.terminate()
                await self._dash_process.wait()
            except Exception:
                pass
            logger.info("DASH FFmpeg Packager stopped.")

    async def _start_ffmpeg_packagers(self):
        hls_playlist = os.path.join(HLS_DIR, "stream.m3u8")
        dash_manifest = os.path.join(DASH_DIR, "stream.mpd")

        # FFmpeg command for live HLS packaging
        hls_cmd = [
            self._ffmpeg_path, "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-g", "60", "-sc_threshold", "0",
            "-c:a", "aac", "-b:a", "128k",
            "-f", "hls",
            "-hls_time", "2",
            "-hls_list_size", "5",
            "-hls_flags", "delete_segments",
            hls_playlist
        ]

        # FFmpeg command for live DASH packaging
        dash_cmd = [
            self._ffmpeg_path, "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-g", "60", "-sc_threshold", "0",
            "-c:a", "aac", "-b:a", "128k",
            "-f", "dash",
            "-seg_duration", "2",
            "-window_size", "5",
            dash_manifest
        ]

        try:
            self._hls_process = await asyncio.create_subprocess_exec(
                *hls_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            self._dash_process = await asyncio.create_subprocess_exec(
                *dash_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            logger.info("HLS and DASH FFmpeg packaging subprocesses running.")
        except Exception as e:
            logger.error(f"Failed to start FFmpeg packaging processes: {e}")

    async def _fallback_manifest_loop(self):
        segment_id = 0
        hls_playlist_file = os.path.join(HLS_DIR, "stream.m3u8")
        dash_manifest_file = os.path.join(DASH_DIR, "stream.mpd")

        while self.is_packaging:
            try:
                segment_id += 1
                segment_duration = 2.0
                
                hls_content = (
                    "#EXTM3U\n"
                    "#EXT-X-VERSION:6\n"
                    f"#EXT-X-TARGETDURATION:{int(segment_duration)+1}\n"
                    f"#EXT-X-MEDIA-SEQUENCE:{max(0, segment_id - 5)}\n"
                    "#EXT-X-INDEPENDENT-SEGMENTS\n\n"
                )
                
                for seq in range(max(1, segment_id - 4), segment_id + 1):
                    hls_content += f"#EXTINF:{segment_duration:.3f},\n"
                    hls_content += f"segment_{seq}.ts\n"
                
                with open(hls_playlist_file, "w") as f:
                    f.write(hls_content)

                dash_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     profiles="urn:mpeg:dash:profile:isoff-live:2011"
     type="dynamic"
     minimumUpdatePeriod="PT2S"
     timeShiftBufferDepth="PT30S">
    <Period id="0" start="PT0S">
        <AdaptationSet mimeType="video/mp4" codecs="avc1.42c01e" startWithSAP="1">
            <SegmentTemplate duration="2000" timescale="1000" media="segment_$Number$.m4s" startNumber="1"/>
            <Representation id="1" bandwidth="1500000" width="640" height="360"/>
        </AdaptationSet>
    </Period>
</MPD>"""

                with open(dash_manifest_file, "w") as f:
                    f.write(dash_content)

                await asyncio.sleep(segment_duration)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error updating HLS/DASH manifest: {e}")
                await asyncio.sleep(1.0)

hls_dash_packager = HLSDashPackager()

