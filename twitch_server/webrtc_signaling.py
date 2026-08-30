import json
import logging
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("TwitchServer.Signaling")
router = APIRouter()

connected_clients: Set[WebSocket] = set()

@router.websocket("/ws/signaling")
async def websocket_signaling_endpoint(websocket: WebSocket):
    """WebSocket Signaling Endpoint for WebRTC P2P / SFU peer negotiation."""
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info(f"New WebSockets signaling peer connected. Total peers: {len(connected_clients)}")

    try:
        while True:
            data_text = await websocket.receive_text()
            message = json.loads(data_text)
            msg_type = message.get("type")
            
            logger.debug(f"Signaling message received: {msg_type}")

            for peer in connected_clients:
                if peer != websocket:
                    try:
                        await peer.send_text(json.dumps(message))
                    except Exception as e:
                        logger.error(f"Error forwarding signaling message: {e}")

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info(f"Signaling peer disconnected. Total peers: {len(connected_clients)}")
    except Exception as e:
        logger.error(f"WebSocket signaling error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)
