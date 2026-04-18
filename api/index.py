"""
AURA 3.0 — Vercel Serverless Backend
Telegram + Twilio Cascade Engine (stateless)
"""

import os
import json
import time
import uuid
import random
import base64
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config from Vercel Environment Variables ──
# Set these in Vercel Dashboard → Project Settings → Environment Variables
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "")
TWILIO_TO = os.environ.get("TWILIO_TO_NUMBER", "")

ZONE_ID = "Zone-4B"

# ── Telegram Service ──
async def send_telegram(message: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML"
            })
            return resp.json()
    except Exception as e:
        print(f"[TG ERROR] {e}")
        return {"ok": False}


async def send_telegram_photo(photo_bytes: bytes, caption: str = ""):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, data={
                "chat_id": TELEGRAM_CHAT_ID,
                "caption": caption[:1024],
                "parse_mode": "HTML"
            }, files={
                "photo": ("aura_detection.jpg", photo_bytes, "image/jpeg")
            })
            return resp.json()
    except Exception as e:
        print(f"[TG PHOTO ERROR] {e}")
        return {"ok": False}


# ── Twilio Voice Call ──
def make_twilio_call(label: str, severity: str, confidence: int, location: str):
    try:
        from twilio.rest import Client
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        
        twiml = f"""
        <Response>
            <Pause length="1"/>
            <Say voice="Polly.Aditi" language="en-IN">
                Alert! Alert! This is AURA, your Ambient Urban Resilience Architecture.
            </Say>
            <Pause length="0.5"/>
            <Say voice="Polly.Aditi" language="en-IN">
                A {severity} severity incident has been detected.
                Incident type: {label.replace('_', ' ')}.
                Confidence level: {confidence} percent.
                Location: {location}.
            </Say>
            <Pause length="0.5"/>
            <Say voice="Polly.Aditi" language="en-IN">
                Immediate action is required. Emergency services and local patrol units have been notified.
                Nearest hospital and police units are being dispatched to the location.
                Please take immediate action and coordinate with your team.
            </Say>
            <Pause length="0.5"/>
            <Say voice="Polly.Aditi" language="en-IN">
                This is an automated call from AURA Vision Command. Stay safe. Over and out.
            </Say>
        </Response>
        """.strip()
        
        call = client.calls.create(twiml=twiml, to=TWILIO_TO, from_=TWILIO_FROM)
        print(f"[TWILIO] Call placed: {call.sid}")
        return {"ok": True, "sid": call.sid}
    except Exception as e:
        print(f"[TWILIO ERROR] {e}")
        return {"ok": False, "error": str(e)}


# ── Generate Cascade Event Data ──
def generate_cascade(label, severity, confidence, zone, location, description=""):
    hospitals = [
        {"name": "Apollo Hospital, Greams Road", "distance": "2.3 km", "eta": "6 min"},
        {"name": "MIOT International", "distance": "4.1 km", "eta": "12 min"},
        {"name": "Fortis Malar Hospital", "distance": "3.5 km", "eta": "9 min"},
    ]
    police_units = [
        {"unit": "PCR-" + str(random.randint(100, 999)), "status": "Dispatched", "eta": f"{random.randint(3, 8)} min"},
        {"unit": "QRT-" + str(random.randint(100, 999)), "status": "En Route", "eta": f"{random.randint(5, 12)} min"},
    ]
    
    authority_msg = (
        f"<b>AURA EMERGENCY ALERT</b>\n\n"
        f"<b>Incident:</b> {label}\n"
        f"<b>Severity:</b> {severity.upper()}\n"
        f"<b>Confidence:</b> {confidence}%\n"
        f"<b>Zone:</b> {zone}\n"
        f"<b>Location:</b> {location}\n"
        f"<b>Description:</b> {description}\n"
        f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}\n\n"
        f"<b>Nearest Hospital:</b> {hospitals[0]['name']} ({hospitals[0]['eta']})\n"
        f"<b>Police Unit:</b> {police_units[0]['unit']} ({police_units[0]['status']})\n\n"
        f"<i>Automated via AURA 3.0 Cascade Engine</i>"
    )
    
    return {
        "id": str(uuid.uuid4())[:8],
        "label": label,
        "severity": severity,
        "zone": zone,
        "timestamp": datetime.now().isoformat(),
        "authority_message": authority_msg,
        "hud_extra": {
            "hospitals": hospitals,
            "police_units": police_units,
            "smart_homes": {
                "societies": random.choice(["Eldorado Apts", "Green Meadows", "Skyline Towers"]),
                "status": "Lockdown Active",
                "residents_notified": random.randint(150, 600),
                "security": "Level-2 Armed"
            },
            "cctv": {
                "cam_id": f"CAM-{random.randint(1001, 9999)}",
                "zoom": "4.2x (Auto-Focus)",
                "resolution": "4K HDR",
                "tracking": "Active (Humanoid)"
            },
            "telegram": {
                "authority_channel": "AURA_AUTH_ADMIN",
                "citizen_bot": "AURA_CITIZEN_BOT",
                "messages_sent": random.randint(5, 20),
                "alert_status": "Broadcasted"
            },
            "infrastructure": {
                "street_lights": "150% Brightness Forced",
                "traffic_signals": "Diverting Traffic",
                "power_grid": "Priority Mode",
                "node_status": "Online/Secure"
            }
        }
    }


# ═══════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/api/pulse")
async def get_pulse():
    score = random.randint(78, 96)
    return {
        "success": True,
        "data": {
            "score": score,
            "health": random.randint(75, 95),
            "mobility": random.randint(80, 98),
            "security": random.randint(70, 95),
            "environment": random.randint(82, 98),
            "trend": "stable" if score > 80 else "declining",
            "updated_at": datetime.now().isoformat()
        }
    }


@app.get("/api/cascade/events")
async def get_cascade_events():
    return {"success": True, "data": []}


@app.get("/api/cascade/stream")
async def get_cascade_stream():
    return {"success": True, "data": []}


@app.get("/api/vision/detections")
async def get_detections():
    return {"success": True, "data": []}


@app.get("/api/vision/stream-status")
async def stream_status():
    return {"streaming": False, "mode": "cloud-puter"}


@app.post("/api/vision/set-location")
async def set_location(request: Request):
    data = await request.json()
    return {"success": True, "location": data.get("address", "Anna Nagar, Chennai")}


@app.post("/api/demo/reset")
async def demo_reset():
    return {"success": True, "message": "State reset"}


@app.post("/api/demo/{scenario}")
async def demo_scenario(scenario: str):
    scenarios = {
        "violence": ("physical assault / fighting", "critical", 0.93),
        "fire": ("fire / smoke detected", "critical", 0.97),
        "crash": ("vehicle collision", "high", 0.89),
        "crowd": ("crowd anomaly", "high", 0.82),
        "knife": ("weapon detected", "critical", 0.94),
    }
    label, severity, conf = scenarios.get(scenario, ("unknown incident", "medium", 0.75))
    cascade = generate_cascade(label, severity, conf, ZONE_ID, "Anna Nagar, Chennai", f"Demo scenario: {scenario}")
    
    # Fire Telegram
    try:
        await send_telegram(cascade["authority_message"])
    except:
        pass
    
    return {"success": True, "cascade": cascade}


@app.post("/api/cascade/trigger")
async def cascade_trigger(request: Request):
    """Main endpoint: receives Puter.js AI analysis result, fires Telegram + Twilio."""
    data = await request.json()
    
    label = data.get("label", "unknown")
    severity = data.get("severity", "medium")
    confidence = int(data.get("confidence", 0.85) * 100)
    description = data.get("description", "")
    location = data.get("location", "Anna Nagar, Chennai")
    frame_b64 = data.get("frame", "")  # Optional: base64 frame for Telegram photo
    
    # Generate cascade event
    cascade = generate_cascade(label, severity, confidence, ZONE_ID, location, description)
    
    # Fire Telegram message
    if severity in ["high", "critical"]:
        try:
            await send_telegram(cascade["authority_message"])
        except Exception as e:
            print(f"[TG] Failed: {e}")
        
        # Send frame as photo if provided
        if frame_b64:
            try:
                frame_bytes = base64.b64decode(frame_b64)
                caption = (
                    f"AURA DETECTION\n\n"
                    f"Label: {label}\n"
                    f"Severity: {severity.upper()}\n"
                    f"Confidence: {confidence}%\n"
                    f"Location: {location}"
                )
                await send_telegram_photo(frame_bytes, caption)
            except Exception as pe:
                print(f"[TG PHOTO] {pe}")
        
        # Fire Twilio call
        try:
            make_twilio_call(label, severity, confidence, location)
        except Exception as ce:
            print(f"[TWILIO] {ce}")
    
    return {
        "success": True,
        "cascade": cascade,
        "detection": {
            "id": str(uuid.uuid4())[:8],
            "label": label,
            "severity": severity,
            "confidence": confidence / 100,
            "description": description,
            "engine": "puter.js (gpt-5.4-nano)",
            "zone_id": ZONE_ID,
            "created_at": datetime.now().isoformat(),
            "hud": cascade.get("hud_extra")
        }
    }


@app.post("/api/telegram/send")
async def telegram_send(request: Request):
    data = await request.json()
    msg = data.get("message", "")
    if msg:
        result = await send_telegram(msg)
        return {"success": True, "result": result}
    return {"success": False, "error": "No message"}


@app.post("/api/report/generate")
async def generate_report():
    return {"success": True, "message": "Report generated"}
