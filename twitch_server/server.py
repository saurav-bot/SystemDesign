import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from twitch_server.config import PORT_HTTP, LOCAL_IP, STATIC_DIR, HLS_DIR, DASH_DIR
from twitch_server.whip_whep import router as whip_whep_router
from twitch_server.webrtc_signaling import router as signaling_router
from twitch_server.rtmp_server import rtmp_server
from twitch_server.hls_dash_packager import hls_dash_packager

logger = logging.getLogger("TwitchServer.Main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle context manager for background protocol servers."""
    logger.info("Initializing Twitch Media Server background services...")
    await rtmp_server.start()
    await hls_dash_packager.start()
    
    yield

    logger.info("Shutting down Twitch Media Server background services...")
    await rtmp_server.stop()
    await hls_dash_packager.stop()

app = FastAPI(
    title="Twitch Server - Real-Time Multi-Protocol Laboratory",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Location", "Content-Type"]
)

# Register API Routers
app.include_router(whip_whep_router, prefix="/api")
app.include_router(signaling_router)

# Serve Live Stream Segments (HLS & DASH)
app.mount("/live/hls", StaticFiles(directory=HLS_DIR), name="hls")
app.mount("/live/dash", StaticFiles(directory=DASH_DIR), name="dash")

@app.get("/api/network-info")
async def get_network_info():
    """Provides local IP, ports, and connection URLs for LAN devices & OBS Studio."""
    return {
        "lan_ip": LOCAL_IP,
        "http_port": PORT_HTTP,
        "rtmp_port": 1935,
        "web_dashboard_url": f"http://{LOCAL_IP}:{PORT_HTTP}",
        "whip_endpoint_url": f"http://{LOCAL_IP}:{PORT_HTTP}/api/whip",
        "whep_endpoint_url": f"http://{LOCAL_IP}:{PORT_HTTP}/api/whep",
        "rtmp_ingest_url": f"rtmp://{LOCAL_IP}:1935/live",
        "rtmp_stream_key": "test_stream",
        "hls_manifest_url": f"http://{LOCAL_IP}:{PORT_HTTP}/live/hls/stream.m3u8",
        "dash_manifest_url": f"http://{LOCAL_IP}:{PORT_HTTP}/live/dash/stream.mpd",
        "rtmp_active_connections": rtmp_server.active_connections
    }

# Mount Web Dashboard Frontend Static Files
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

def run_server():
    import uvicorn
    logger.info(f"Starting Twitch Media Server on http://0.0.0.0:{PORT_HTTP}")
    uvicorn.run(app, host="0.0.0.0", port=PORT_HTTP)
