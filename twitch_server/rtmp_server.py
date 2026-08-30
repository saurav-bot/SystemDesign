import asyncio
import logging
from twitch_server.config import PORT_RTMP, LOCAL_IP

logger = logging.getLogger("TwitchServer.RTMP")

class RtmpServer:
    """
    Asynchronous RTMP Server listening on Port 1935.
    Receives incoming video streams from OBS Studio, FFmpeg, or mobile broadcast applications.
    """
    def __init__(self, host="0.0.0.0", port=PORT_RTMP):
        self.host = host
        self.port = port
        self.server = None
        self.active_connections = 0

    async def start(self):
        try:
            self.server = await asyncio.start_server(self._handle_client, self.host, self.port)
            logger.info(f"RTMP Ingest Server running on rtmp://{LOCAL_IP}:{self.port}/live")
        except Exception as e:
            logger.error(f"Failed to start RTMP server on port {self.port}: {e}")

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("RTMP Server stopped.")

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        client_addr = writer.get_extra_info('peername')
        self.active_connections += 1
        logger.info(f"[RTMP Client Connected] {client_addr} (Active connections: {self.active_connections})")

        try:
            # RTMP Handshake Phase (C0 + C1 -> S0 + S1 + S2 -> C2)
            c0_c1 = await reader.readexactly(1537)
            if len(c0_c1) < 1537:
                logger.warning(f"[RTMP {client_addr}] Invalid handshake length.")
                writer.close()
                return

            s0_s1_s2 = bytearray(1 + 1536 + 1536)
            s0_s1_s2[0] = 0x03
            s0_s1_s2[1:5] = c0_c1[1:5]
            s0_s1_s2[1537:1541] = c0_c1[1:5]
            s0_s1_s2[1541:3073] = c0_c1[5:1537]

            writer.write(s0_s1_s2)
            await writer.drain()

            c2 = await reader.readexactly(1536)
            logger.info(f"[RTMP {client_addr}] Handshake completed successfully!")

            while not reader.at_eof():
                chunk_header = await reader.read(1024)
                if not chunk_header:
                    break
                await asyncio.sleep(0.01)

        except asyncio.IncompleteReadError:
            logger.info(f"[RTMP {client_addr}] Client disconnected cleanly.")
        except Exception as e:
            logger.error(f"[RTMP {client_addr}] Ingest session error: {e}")
        finally:
            self.active_connections -= 1
            writer.close()
            await writer.wait_closed()
            logger.info(f"[RTMP Client Disconnected] {client_addr} (Active connections: {self.active_connections})")

rtmp_server = RtmpServer()
