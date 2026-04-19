"""
AURA 3.0 — Vercel Serverless Backend
Multi-User Telegram + Twilio Cascade Engine
Subscribers stored in Supabase
"""

import os
import json
import time
import uuid
import random
import base64
import asyncio
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

# ── Config from Vercel Environment Variables (Admin / Owner) ──
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
TWILIO_TO = os.environ.get("TWILIO_TO_NUMBER", "").strip()

# ── Supabase Config ──
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fkzdxruztqnfxiovhheg.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZremR4cnV6dHFuZnhpb3ZoaGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTc2MjQsImV4cCI6MjA5MjA5MzYyNH0.FvR87FigboPviGur2aa88f0LiSDS8d7XgzOMua7V82A"))

ZONE_ID = "Zone-4B"

# ── In-memory subscriber fallback ──
_mem_subscribers = []


# ═══════════════════════════════════════════════════════════════
# SUPABASE HELPERS
# ═══════════════════════════════════════════════════════════════
def _sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

async def get_all_subscribers():
    """Get all subscribers from Supabase, fallback to memory."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/aura_subscribers?is_active=eq.true&select=*",
                headers=_sb_headers()
            )
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        print(f"[Supabase] Read error: {e}")
    return [s for s in _mem_subscribers if s.get("is_active", True)]

async def add_subscriber(data: dict):
    """Add subscriber to Supabase, fallback to memory."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                f"{SUPABASE_URL}/rest/v1/aura_subscribers",
                headers=_sb_headers(),
                json=data
            )
            if r.status_code in [200, 201]:
                result = r.json()
                return result[0] if isinstance(result, list) else result
    except Exception as e:
        print(f"[Supabase] Write error: {e}, using memory fallback")
    
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now().isoformat()
    _mem_subscribers.append(data)
    return data

async def remove_subscriber(sub_id: str):
    """Remove subscriber."""
    global _mem_subscribers
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.delete(
                f"{SUPABASE_URL}/rest/v1/aura_subscribers?id=eq.{sub_id}",
                headers=_sb_headers()
            )
            if r.status_code in [200, 204]:
                return True
    except Exception:
        pass
    _mem_subscribers = [s for s in _mem_subscribers if s.get("id") != sub_id]
    return True


# ═══════════════════════════════════════════════════════════════
# TELEGRAM SERVICE (supports any bot token + chat ID)
# ═══════════════════════════════════════════════════════════════
async def send_telegram_to(token: str, chat_id: str, message: str):
    if not token or not chat_id:
        return {"ok": False, "error": "Missing credentials"}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={
                "chat_id": chat_id, "text": message, "parse_mode": "HTML"
            })
            return resp.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}

async def send_telegram_photo_to(token: str, chat_id: str, photo_bytes: bytes, caption: str = ""):
    if not token or not chat_id:
        return {"ok": False, "error": "Missing credentials"}
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, data={
                "chat_id": chat_id, "caption": caption[:1024], "parse_mode": "HTML"
            }, files={"photo": ("aura_detection.jpg", photo_bytes, "image/jpeg")})
            return resp.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════
# TWILIO VOICE CALL (supports any credentials)
# ═══════════════════════════════════════════════════════════════
async def make_twilio_call_to(sid: str, token: str, from_num: str, to_num: str,
                               label: str, severity: str, confidence: int, location: str):
    if not all([sid, token, from_num, to_num]):
        return {"ok": False, "error": "Missing Twilio credentials"}
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        twiml = f"""<Response>
            <Pause length="1"/>
            <Say voice="Polly.Aditi" language="en-IN">
                Alert! This is AURA, Ambient Urban Resilience Architecture.
                A {severity} severity incident detected. Type: {label.replace('_', ' ')}.
                Confidence: {confidence} percent. Location: {location}.
                Immediate action required. Emergency services notified.
            </Say>
        </Response>""".strip()
        call = client.calls.create(twiml=twiml, to=to_num, from_=from_num)
        return {"ok": True, "sid": call.sid}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════
# MULTI-USER DISPATCH — notify ALL subscribers
# ═══════════════════════════════════════════════════════════════
async def dispatch_to_all(message: str, photo_bytes: bytes, caption: str,
                          label: str, severity: str, confidence: int, location: str):
    """Send Telegram + Twilio to the admin AND all registered subscribers."""
    results = {"telegram": [], "twilio": [], "total_notified": 0}

    # Build list of all notification targets
    targets = []

    # 1. Admin (from env vars) — always included
    if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
        targets.append({
            "name": "Admin (Owner)",
            "telegram_bot_token": TELEGRAM_TOKEN,
            "telegram_chat_id": TELEGRAM_CHAT_ID,
            "twilio_sid": TWILIO_SID,
            "twilio_auth": TWILIO_TOKEN,
            "twilio_from_number": TWILIO_FROM,
            "twilio_to_number": TWILIO_TO,
        })

    # 2. All registered subscribers from Supabase
    subscribers = await get_all_subscribers()
    for sub in subscribers:
        targets.append(sub)

    # 3. Dispatch to all targets concurrently
    async def notify_one(target):
        tg_ok = False
        tw_ok = False
        name = target.get("name", "Unknown")

        # Telegram
        t_token = target.get("telegram_bot_token", "")
        t_chat = target.get("telegram_chat_id", "")
        if t_token and t_chat:
            r = await send_telegram_to(t_token, t_chat, message)
            tg_ok = r.get("ok", False)
            if photo_bytes and tg_ok:
                await send_telegram_photo_to(t_token, t_chat, photo_bytes, caption)

        # Twilio (only for high/critical)
        if severity in ["high", "critical"]:
            t_sid = target.get("twilio_sid", "")
            t_auth = target.get("twilio_auth", "")
            t_from = target.get("twilio_from_number", "")
            t_to = target.get("twilio_to_number", "")
            if all([t_sid, t_auth, t_from, t_to]):
                r = await make_twilio_call_to(t_sid, t_auth, t_from, t_to,
                                               label, severity, confidence, location)
                tw_ok = r.get("ok", False)

        return {"name": name, "telegram": tg_ok, "twilio": tw_ok}

    if targets:
        notify_results = await asyncio.gather(*[notify_one(t) for t in targets])
        for nr in notify_results:
            results["telegram"].append({"name": nr["name"], "ok": nr["telegram"]})
            results["twilio"].append({"name": nr["name"], "ok": nr["twilio"]})
        results["total_notified"] = len(targets)

    return results


# ═══════════════════════════════════════════════════════════════
# CASCADE EVENT GENERATOR
# ═══════════════════════════════════════════════════════════════
def generate_cascade(label, severity, confidence, zone, location, description=""):
    hospitals = [
        {"name": "Apollo Hospital, Greams Road", "distance": "2.3 km", "eta": "6 min"},
        {"name": "MIOT International", "distance": "4.1 km", "eta": "12 min"},
    ]
    police_units = [
        {"unit": f"PCR-{random.randint(100,999)}", "status": "Dispatched", "eta": f"{random.randint(3,8)} min"},
        {"unit": f"QRT-{random.randint(100,999)}", "status": "En Route", "eta": f"{random.randint(5,12)} min"},
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
        "label": label, "severity": severity, "zone": zone,
        "timestamp": datetime.now().isoformat(),
        "authority_message": authority_msg,
        "hud_extra": {
            "hospitals": hospitals, "police_units": police_units,
            "smart_homes": {"societies": random.choice(["Eldorado Apts", "Green Meadows", "Skyline Towers"]),
                            "status": "Lockdown Active", "residents_notified": random.randint(150, 600)},
            "cctv": {"cam_id": f"CAM-{random.randint(1001,9999)}", "zoom": "4.2x", "tracking": "Active"},
            "telegram": {"messages_sent": 0, "alert_status": "Broadcasting"},
            "infrastructure": {"street_lights": "150% Brightness", "traffic_signals": "Diverting"}
        }
    }


# ═══════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/api/pulse")
async def get_pulse():
    score = random.randint(78, 96)
    return {"success": True, "data": {
        "score": score, "health": random.randint(75,95), "mobility": random.randint(80,98),
        "security": random.randint(70,95), "environment": random.randint(82,98),
        "trend": "stable" if score > 80 else "declining", "updated_at": datetime.now().isoformat()
    }}

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
        "violence": ("physical assault", "critical", 0.93),
        "fire": ("fire / smoke detected", "critical", 0.97),
        "crash": ("vehicle collision", "high", 0.89),
        "crowd": ("crowd anomaly", "high", 0.82),
        "knife": ("weapon detected", "critical", 0.94),
    }
    label, severity, conf = scenarios.get(scenario, ("unknown", "medium", 0.75))
    cascade = generate_cascade(label, severity, int(conf*100), ZONE_ID, "Anna Nagar, Chennai")
    results = await dispatch_to_all(cascade["authority_message"], None, "", label, severity, int(conf*100), "Anna Nagar, Chennai")
    return {"success": True, "cascade": cascade, "dispatch": results}


# ═══════════════════════════════════════════════════════════════
# MAIN CASCADE TRIGGER (from Puter.js frontend)
# ═══════════════════════════════════════════════════════════════
@app.post("/api/cascade/trigger")
async def cascade_trigger(request: Request):
    data = await request.json()
    label = data.get("label", "unknown")
    severity = data.get("severity", "medium")
    confidence = int(float(data.get("confidence", 0.85)) * 100)
    description = data.get("description", "")
    location = data.get("location", "Anna Nagar, Chennai")
    frame_b64 = data.get("frame", "")

    cascade = generate_cascade(label, severity, confidence, ZONE_ID, location, description)

    # Decode frame for photo
    photo_bytes = None
    caption = ""
    if frame_b64:
        try:
            photo_bytes = base64.b64decode(frame_b64)
            caption = (f"🚨 <b>AURA DETECTION</b>\n\n<b>Label:</b> {label}\n"
                       f"<b>Severity:</b> {severity.upper()}\n<b>Confidence:</b> {confidence}%\n"
                       f"<b>Location:</b> {location}\n<b>Time:</b> {datetime.now().strftime('%H:%M:%S')}")
        except Exception:
            pass

    # Dispatch to ALL subscribers + admin
    dispatch = await dispatch_to_all(
        cascade["authority_message"], photo_bytes, caption,
        label, severity, confidence, location
    )

    return {
        "success": True,
        "cascade": cascade,
        "detection": {
            "id": str(uuid.uuid4())[:8], "label": label, "severity": severity,
            "confidence": confidence / 100, "description": description,
            "engine": "puter.js (gpt-5.4-nano)", "zone_id": ZONE_ID,
            "created_at": datetime.now().isoformat(), "hud": cascade.get("hud_extra")
        },
        "dispatch": dispatch,
        "services": {
            "telegram_message": any(t["ok"] for t in dispatch["telegram"]),
            "telegram_photo": bool(photo_bytes),
            "twilio_call": any(t["ok"] for t in dispatch["twilio"]),
            "total_notified": dispatch["total_notified"]
        }
    }


# ═══════════════════════════════════════════════════════════════
# SUBSCRIBER MANAGEMENT
# ═══════════════════════════════════════════════════════════════
@app.get("/api/subscribers")
async def list_subscribers():
    subs = await get_all_subscribers()
    # Mask sensitive fields
    safe = []
    for s in subs:
        safe.append({
            "id": s.get("id"), "name": s.get("name"),
            "has_telegram": bool(s.get("telegram_bot_token") and s.get("telegram_chat_id")),
            "has_twilio": bool(s.get("twilio_sid") and s.get("twilio_to_number")),
            "created_at": s.get("created_at"), "is_active": s.get("is_active", True)
        })
    return {"success": True, "subscribers": safe, "admin_configured": bool(TELEGRAM_TOKEN)}

@app.post("/api/subscribers/register")
async def register_subscriber(request: Request):
    data = await request.json()
    name = data.get("name", "").strip()
    if not name:
        return JSONResponse({"success": False, "error": "Name is required"}, status_code=400)

    sub = {
        "name": name,
        "telegram_bot_token": data.get("telegram_bot_token", "").strip(),
        "telegram_chat_id": data.get("telegram_chat_id", "").strip(),
        "twilio_sid": data.get("twilio_sid", "").strip(),
        "twilio_auth": data.get("twilio_auth", "").strip(),
        "twilio_from_number": data.get("twilio_from_number", "").strip(),
        "twilio_to_number": data.get("twilio_to_number", "").strip(),
        "is_active": True,
    }

    result = await add_subscriber(sub)
    return {"success": True, "subscriber": {"id": result.get("id"), "name": name}}

@app.post("/api/subscribers/test")
async def test_subscriber(request: Request):
    """Test a subscriber's credentials before saving."""
    data = await request.json()
    results = {"telegram": False, "twilio": False}

    t_token = data.get("telegram_bot_token", "").strip()
    t_chat = data.get("telegram_chat_id", "").strip()
    if t_token and t_chat:
        r = await send_telegram_to(t_token, t_chat, "✅ <b>AURA 3.0 Test</b>\n\nYour Telegram bot is connected!")
        results["telegram"] = r.get("ok", False)

    t_sid = data.get("twilio_sid", "").strip()
    t_auth = data.get("twilio_auth", "").strip()
    t_from = data.get("twilio_from_number", "").strip()
    t_to = data.get("twilio_to_number", "").strip()
    if all([t_sid, t_auth, t_from, t_to]):
        r = await make_twilio_call_to(t_sid, t_auth, t_from, t_to, "test", "low", 100, "Test Location")
        results["twilio"] = r.get("ok", False)

    return {"success": True, "results": results}

@app.delete("/api/subscribers/{sub_id}")
async def delete_subscriber(sub_id: str):
    await remove_subscriber(sub_id)
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# TELEGRAM DIRECT SEND
# ═══════════════════════════════════════════════════════════════
@app.post("/api/telegram/send")
async def telegram_send(request: Request):
    data = await request.json()
    msg = data.get("message", "")
    if msg:
        result = await send_telegram_to(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, msg)
        return {"success": result.get("ok", False), "result": result}
    return {"success": False, "error": "No message"}


# ═══════════════════════════════════════════════════════════════
# AUTHORITY PANEL ACTIONS — now multi-user
# ═══════════════════════════════════════════════════════════════
@app.post("/api/report/generate")
async def generate_report(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    location = data.get("location", "Anna Nagar, Chennai")
    report = (
        f"📊 <b>AURA 3.0 — INCIDENT REPORT</b>\n{'━'*30}\n\n"
        f"📅 <b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"📍 <b>Location:</b> {location}\n🏷️ <b>Zone:</b> {ZONE_ID}\n\n"
        f"<b>━━ COMMUNITY WELLNESS ━━</b>\n\n"
        f"🎯 <b>Pulse Score:</b> {data.get('pulse_score', random.randint(78,96))}/100\n"
        f"🏥 <b>Health:</b> {data.get('health', random.randint(75,95))}/100\n"
        f"🚗 <b>Mobility:</b> {data.get('mobility', random.randint(80,98))}/100\n"
        f"🛡️ <b>Security:</b> {data.get('security', random.randint(70,95))}/100\n"
        f"🌿 <b>Environment:</b> {data.get('environment', random.randint(82,98))}/100\n\n"
        f"<b>━━ SYSTEM STATUS ━━</b>\n\n"
        f"✅ All 6 cascade modules active\n"
        f"✅ Puter.js AI Engine — Online\n"
        f"✅ Multi-user notifications — Active\n\n"
        f"{'━'*30}\n<i>AURA 3.0 Authority Panel</i>"
    )
    results = await dispatch_to_all(report, None, "", "report", "low", 100, location)
    return {"success": True, "dispatch": results, "report": report}

@app.post("/api/authority/lockdown")
async def initiate_lockdown(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    location = data.get("location", "Anna Nagar, Chennai")
    msg = (
        f"🔒 <b>ZONE LOCKDOWN INITIATED</b>\n{'━'*30}\n\n"
        f"⚠️ <b>Authority Command has activated lockdown.</b>\n\n"
        f"📍 <b>Zone:</b> {ZONE_ID}\n📍 <b>Location:</b> {location}\n"
        f"🕐 <b>Time:</b> {datetime.now().strftime('%H:%M:%S')}\n\n"
        f"🏘️ Society gates sealed\n🚔 Police units deployed\n"
        f"📹 CCTV 4K tracking active\n🚦 Traffic diverted\n\n"
        f"<b>Status:</b> LOCKDOWN ACTIVE ✅\n\n{'━'*30}\n<i>AURA 3.0</i>"
    )
    results = await dispatch_to_all(msg, None, "", "lockdown", "critical", 100, location)
    return {"success": True, "dispatch": results}

@app.post("/api/authority/broadcast")
async def broadcast_alert(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    location = data.get("location", "Anna Nagar, Chennai")
    msg = (
        f"📡 <b>PUBLIC ALERT BROADCAST</b>\n{'━'*30}\n\n"
        f"🔊 <b>Area-wide security alert issued.</b>\n\n"
        f"📍 <b>Zone:</b> {ZONE_ID}\n📍 <b>Area:</b> {location}\n\n"
        f"⚠️ Stay indoors\n⚠️ Avoid flagged area\n"
        f"⚠️ Emergency services dispatched\n\n"
        f"📞 <b>Emergency:</b> 112\n\n{'━'*30}\n<i>AURA 3.0</i>"
    )
    results = await dispatch_to_all(msg, None, "", "broadcast", "high", 100, location)
    return {"success": True, "dispatch": results}


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════
@app.get("/api/health")
async def health_check():
    subs = await get_all_subscribers()
    return {
        "status": "ok", "version": "3.0",
        "admin_telegram": bool(TELEGRAM_TOKEN and TELEGRAM_CHAT_ID),
        "admin_twilio": bool(TWILIO_SID and TWILIO_TOKEN),
        "registered_subscribers": len(subs),
        "supabase_configured": bool(SUPABASE_URL),
        "timestamp": datetime.now().isoformat()
    }
