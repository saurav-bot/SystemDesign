import uvicorn
from twitch_server.server import app, PORT_HTTP

if __name__ == "__main__":
    print(f"===========================================================")
    print(f"  TWITCH REAL-TIME MEDIA SERVER & PROTOCOL TESTING LABORATORY ")
    print(f"  Single Module Entrypoint: python -m twitch_server          ")
    print(f"===========================================================")
    uvicorn.run("twitch_server.server:app", host="0.0.0.0", port=PORT_HTTP, reload=False)
