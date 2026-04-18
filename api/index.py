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
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
TWILIO_TO = os.environ.get("TWILIO_TO_NUMBER", "").strip()

ZONE_ID = "Zone-4B"

# ── In-memory state for this request (stateless per invocation) ──
_cascade_log = []


# ═══════════════════════════════════════════════════════════════
# TELEGRAM SERVICE
# ═══════════════════════════════════════════════════════════════
async def send_telegram(message: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print(f"[TG] Missing credentials: token={bool(TELEGRAM_TOKEN)} chat_id={bool(TELEGRAM_CHAT_ID)}")
        return {"ok": False, "error": "Missing Telegram credentials"}

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML"
            })
            result = resp.json()
            print(f"[TG] sendMessage result: ok={result.get('ok')}")
            return result
    except Exception as e:
        print(f"[TG ERROR] {e}")
        return {"ok": False, "error": str(e)}


async def send_telegram_photo(photo_bytes: bytes, caption: str = ""):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return {"ok": False, "error": "Missing Telegram credentials"}

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, data={
                "chat_id": TELEGRAM_CHAT_ID,
                "caption": caption[:1024],
                "parse_mode": "HTML"
            }, files={
                "photo": ("aura_detection.jpg", photo_bytes, "image/jpeg")
            })
            result = resp.json()
            print(f"[TG] sendPhoto result: ok={result.get('ok')}")
            return result
    except Exception as e:
        print(f"[TG PHOTO ERROR] {e}")
        return {"ok": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════
# TWILIO VOICE CALL
# ═══════════════════════════════════════════════════════════════
async def make_twilio_call(label: str, severity: str, confidence: int, location: str):
    if not TWILIO_SID or not TWILIO_TOKEN or not TWILIO_FROM or not TWILIO_TO:
        print(f"[TWILIO] Missing credentials")
        return {"ok": False, "error": "Missing Twilio credentials"}

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


# ═══════════════════════════════════════════════════════════════
# CASCADE EVENT GENERATOR
# ═══════════════════════════════════════════════════════════════
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
        f"<b>🚨 AURA EMERGENCY ALERT</b>\n\n"
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
    cascade = generate_cascade(label, severity, int(conf * 100), ZONE_ID, "Anna Nagar, Chennai", f"Demo scenario: {scenario}")

    # Fire Telegram message + photo placeholder
    tg_result = await send_telegram(cascade["authority_message"])

    return {"success": True, "cascade": cascade, "telegram": tg_result}


# ═══════════════════════════════════════════════════════════════
# MAIN CASCADE TRIGGER (from Puter.js frontend)
# ═══════════════════════════════════════════════════════════════
@app.post("/api/cascade/trigger")
async def cascade_trigger(request: Request):
    """Receives Puter.js AI analysis result, fires Telegram + Twilio."""
    data = await request.json()

    label = data.get("label", "unknown")
    severity = data.get("severity", "medium")
    confidence = int(float(data.get("confidence", 0.85)) * 100)
    description = data.get("description", "")
    location = data.get("location", "Anna Nagar, Chennai")
    frame_b64 = data.get("frame", "")

    # Generate cascade event
    cascade = generate_cascade(label, severity, confidence, ZONE_ID, location, description)

    tg_msg_result = {"ok": False}
    tg_photo_result = {"ok": False}
    twilio_result = {"ok": False}

    # Fire Telegram for medium+ severity
    if severity in ["medium", "high", "critical"]:
        # Send text alert
        tg_msg_result = await send_telegram(cascade["authority_message"])

        # Send frame as photo if provided
        if frame_b64:
            try:
                frame_bytes = base64.b64decode(frame_b64)
                caption = (
                    f"🚨 <b>AURA DETECTION</b>\n\n"
                    f"<b>Label:</b> {label}\n"
                    f"<b>Severity:</b> {severity.upper()}\n"
                    f"<b>Confidence:</b> {confidence}%\n"
                    f"<b>Location:</b> {location}\n"
                    f"<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}\n\n"
                    f"<i>Frame captured by AURA Vision 3.0</i>"
                )
                tg_photo_result = await send_telegram_photo(frame_bytes, caption)
            except Exception as pe:
                print(f"[TG PHOTO] {pe}")

        # Fire Twilio call for high/critical
        if severity in ["high", "critical"]:
            twilio_result = await make_twilio_call(label, severity, confidence, location)

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
        },
        "services": {
            "telegram_message": tg_msg_result.get("ok", False),
            "telegram_photo": tg_photo_result.get("ok", False),
            "twilio_call": twilio_result.get("ok", False)
        }
    }


# ═══════════════════════════════════════════════════════════════
# TELEGRAM SEND (direct)
# ═══════════════════════════════════════════════════════════════
@app.post("/api/telegram/send")
async def telegram_send(request: Request):
    data = await request.json()
    msg = data.get("message", "")
    if msg:
        result = await send_telegram(msg)
        return {"success": result.get("ok", False), "result": result}
    return {"success": False, "error": "No message"}


# ═══════════════════════════════════════════════════════════════
# AUTHORITY PANEL ACTIONS
# ═══════════════════════════════════════════════════════════════

@app.post("/api/report/generate")
async def generate_report(request: Request):
    """Generate and send a full incident report to Telegram."""
    try:
        data = await request.json()
    except:
        data = {}

    pulse_score = data.get("pulse_score", random.randint(78, 96))
    health = data.get("health", random.randint(75, 95))
    mobility = data.get("mobility", random.randint(80, 98))
    security = data.get("security", random.randint(70, 95))
    environment = data.get("environment", random.randint(82, 98))
    total_events = data.get("total_events", 0)
    location = data.get("location", "Anna Nagar, Chennai")

    report = (
        f"📊 <b>AURA 3.0 — INCIDENT REPORT</b>\n"
        f"{'━' * 30}\n\n"
        f"📅 <b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"📍 <b>Location:</b> {location}\n"
        f"🏷️ <b>Zone:</b> {ZONE_ID}\n\n"
        f"<b>━━ COMMUNITY WELLNESS ━━</b>\n\n"
        f"🎯 <b>Overall Pulse Score:</b> {pulse_score}/100\n"
        f"🏥 <b>Health Index:</b> {health}/100\n"
        f"🚗 <b>Mobility Index:</b> {mobility}/100\n"
        f"🛡️ <b>Security Index:</b> {security}/100\n"
        f"🌿 <b>Environment Index:</b> {environment}/100\n\n"
        f"<b>━━ THREAT SUMMARY ━━</b>\n\n"
        f"⚡ <b>Total Cascade Events:</b> {total_events}\n"
        f"🤖 <b>AI Engine:</b> Puter.js (GPT-5.4 Nano)\n"
        f"📡 <b>Cascade Modules:</b> 6/6 Active\n"
        f"🔔 <b>Telegram Alerts:</b> Active\n"
        f"📞 <b>Twilio Voice:</b> Active\n\n"
        f"<b>━━ SYSTEM STATUS ━━</b>\n\n"
        f"✅ Hospital Dispatch — Online\n"
        f"✅ Police QRT — Online\n"
        f"✅ Smart Home Network — Online\n"
        f"✅ CCTV 4K Tracking — Online\n"
        f"✅ Telegram Bot — Online\n"
        f"✅ Infrastructure Control — Online\n\n"
        f"{'━' * 30}\n"
        f"<i>Report generated by AURA 3.0 Authority Panel</i>"
    )

    result = await send_telegram(report)
    return {"success": result.get("ok", False), "result": result, "report": report}


@app.post("/api/authority/lockdown")
async def initiate_lockdown(request: Request):
    """Send zone lockdown notification to Telegram."""
    try:
        data = await request.json()
    except:
        data = {}

    location = data.get("location", "Anna Nagar, Chennai")

    lockdown_msg = (
        f"🔒 <b>ZONE LOCKDOWN INITIATED</b>\n"
        f"{'━' * 30}\n\n"
        f"⚠️ <b>Authority Command has activated lockdown protocol.</b>\n\n"
        f"📍 <b>Zone:</b> {ZONE_ID}\n"
        f"📍 <b>Location:</b> {location}\n"
        f"🕐 <b>Initiated:</b> {datetime.now().strftime('%H:%M:%S')}\n\n"
        f"<b>━━ LOCKDOWN ACTIONS ━━</b>\n\n"
        f"🏘️ Society gates sealed — Access restricted\n"
        f"🚔 Police units deployed to all entry/exit points\n"
        f"📹 All CCTV cameras switched to 4K tracking mode\n"
        f"🚦 Traffic diverted around perimeter\n"
        f"💡 Street lights at 150% brightness\n"
        f"📱 Resident alerts sent via Smart Home system\n\n"
        f"<b>Status:</b> LOCKDOWN ACTIVE ✅\n\n"
        f"{'━' * 30}\n"
        f"<i>AURA 3.0 — Authority Command Panel</i>"
    )

    result = await send_telegram(lockdown_msg)
    return {"success": result.get("ok", False), "result": result}


@app.post("/api/authority/broadcast")
async def broadcast_alert(request: Request):
    """Send public broadcast alert to Telegram."""
    try:
        data = await request.json()
    except:
        data = {}

    location = data.get("location", "Anna Nagar, Chennai")
    message = data.get("message", "")

    broadcast_msg = (
        f"📡 <b>PUBLIC ALERT BROADCAST</b>\n"
        f"{'━' * 30}\n\n"
        f"🔊 <b>ATTENTION: Area-wide security alert issued.</b>\n\n"
        f"📍 <b>Zone:</b> {ZONE_ID}\n"
        f"📍 <b>Area:</b> {location}\n"
        f"🕐 <b>Time:</b> {datetime.now().strftime('%H:%M:%S')}\n\n"
    )

    if message:
        broadcast_msg += f"📋 <b>Message:</b> {message}\n\n"

    broadcast_msg += (
        f"<b>━━ ADVISORY ━━</b>\n\n"
        f"⚠️ Residents are advised to stay indoors\n"
        f"⚠️ Avoid the flagged area until further notice\n"
        f"⚠️ Emergency services have been dispatched\n"
        f"⚠️ Follow instructions from local authorities\n\n"
        f"📞 <b>Emergency Helpline:</b> 112\n"
        f"📱 <b>AURA Citizen Bot:</b> @AURA_CITIZEN_BOT\n\n"
        f"{'━' * 30}\n"
        f"<i>AURA 3.0 — Public Safety Broadcast System</i>"
    )

    result = await send_telegram(broadcast_msg)
    return {"success": result.get("ok", False), "result": result}


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK / DEBUG
# ═══════════════════════════════════════════════════════════════
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": "3.0",
        "telegram_configured": bool(TELEGRAM_TOKEN and TELEGRAM_CHAT_ID),
        "twilio_configured": bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM and TWILIO_TO),
        "telegram_token_length": len(TELEGRAM_TOKEN),
        "telegram_chat_id_length": len(TELEGRAM_CHAT_ID),
        "twilio_sid_length": len(TWILIO_SID),
        "timestamp": datetime.now().isoformat()
    }
