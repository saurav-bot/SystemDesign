import uuid
import logging
from typing import Dict
from fastapi import APIRouter, Request, Response, HTTPException, status
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from twitch_server.test_signal import TimestampedTestPatternTrack

logger = logging.getLogger("TwitchServer.WHIP_WHEP")
router = APIRouter()

# Active media sessions, publisher tracks, and MediaRelay
sessions: Dict[str, RTCPeerConnection] = {}
active_streams: Dict[str, list] = {}
relay = MediaRelay()

@router.options("/whip")
@router.options("/whep")
async def whip_whep_options():
    """CORS preflight and WHIP/WHEP options inquiry."""
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS, DELETE",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Accept-Post": "application/sdp"
        }
    )

@router.post("/whip", status_code=status.HTTP_201_CREATED)
async def whip_ingest(request: Request):
    """WHIP (WebRTC HTTP Ingestion Protocol) Endpoint."""
    body = await request.body()
    sdp_offer = body.decode("utf-8")
    
    if not sdp_offer:
        raise HTTPException(status_code=400, detail="Missing SDP offer body")
    
    session_id = str(uuid.uuid4())
    pc = RTCPeerConnection()
    sessions[session_id] = pc

    @pc.on("track")
    def on_track(track):
        logger.info(f"[WHIP] Ingest track received: kind={track.kind}, id={track.id}")
        if "main" not in active_streams:
            active_streams["main"] = []
        active_streams["main"].append(track)

        @track.on("ended")
        async def on_ended():
            logger.info(f"[WHIP] Ingest track ended: kind={track.kind}")
            if "main" in active_streams and track in active_streams["main"]:
                active_streams["main"].remove(track)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logger.info(f"[WHIP Session {session_id[:8]}] State: {pc.connectionState}")
        if pc.connectionState in ["failed", "closed"]:
            await pc.close()
            sessions.pop(session_id, None)

    offer = RTCSessionDescription(sdp=sdp_offer, type="offer")
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return Response(
        content=pc.localDescription.sdp,
        media_type="application/sdp",
        status_code=201,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Location",
            "Location": f"/api/whip/sessions/{session_id}"
        }
    )

@router.post("/whep", status_code=status.HTTP_201_CREATED)
async def whep_egress(request: Request):
    """WHEP (WebRTC HTTP Egress Protocol) Endpoint."""
    body = await request.body()
    sdp_offer = body.decode("utf-8")

    if not sdp_offer:
        raise HTTPException(status_code=400, detail="Missing SDP offer body")

    session_id = str(uuid.uuid4())
    pc = RTCPeerConnection()
    sessions[session_id] = pc

    tracks_to_send = active_streams.get("main", [])
    if not tracks_to_send:
        logger.info("[WHEP] No active live publisher, serving dedicated Timestamped Test Pattern Track.")
        pc.addTrack(TimestampedTestPatternTrack())
    else:
        logger.info(f"[WHEP] Relaying {len(tracks_to_send)} live publisher track(s) via MediaRelay (buffered=False for zero lag).")
        for track in tracks_to_send:
            pc.addTrack(relay.subscribe(track, buffered=False))

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logger.info(f"[WHEP Session {session_id[:8]}] State: {pc.connectionState}")
        if pc.connectionState in ["failed", "closed"]:
            await pc.close()
            sessions.pop(session_id, None)

    offer = RTCSessionDescription(sdp=sdp_offer, type="offer")
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return Response(
        content=pc.localDescription.sdp,
        media_type="application/sdp",
        status_code=201,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Location",
            "Location": f"/api/whep/sessions/{session_id}"
        }
    )

@router.delete("/whip/sessions/{session_id}")
@router.delete("/whep/sessions/{session_id}")
async def close_session(session_id: str):
    """Terminates a WHIP or WHEP WebRTC session."""
    pc = sessions.pop(session_id, None)
    if pc:
        await pc.close()
        return Response(status_code=204, headers={"Access-Control-Allow-Origin": "*"})
    raise HTTPException(status_code=404, detail="Session not found")
