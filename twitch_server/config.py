import os
import socket
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("TwitchServer.Config")

PORT_HTTP = 8000
PORT_RTMP = 1935

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
MEDIA_DIR = os.path.join(BASE_DIR, "media")
HLS_DIR = os.path.join(MEDIA_DIR, "hls")
DASH_DIR = os.path.join(MEDIA_DIR, "dash")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(HLS_DIR, exist_ok=True)
os.makedirs(DASH_DIR, exist_ok=True)

def get_local_ip() -> str:
    """Finds the local network IPv4 address (LAN IP) accessible by other devices on Wi-Fi/Ethernet."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception as e:
        logger.warning(f"Could not automatically determine LAN IP via UDP socket: {e}")
        try:
            hostname = socket.gethostname()
            return socket.gethostbyname(hostname)
        except Exception:
            return "127.0.0.1"

LOCAL_IP = get_local_ip()
logger.info(f"Twitch Media Server configured on LAN IP: {LOCAL_IP}")
