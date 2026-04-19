# AURA 3.0 — Community Pulse Intelligence & Cascade Engine

![AURA 3.0](https://img.shields.io/badge/AURA-v3.0-10b981?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Live-success?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)

AURA 3.0 is a next-generation Smart City and Community Security platform. Designed to process live CCTV feeds in real-time, AURA leverages edge AI models (via Puter.js) to detect anomalies and trigger an immediate **Incident Response Cascade** across multiple communication channels.

🌐 **Live Demo:** [https://aura-vision-3.vercel.app](https://aura-vision-3.vercel.app)

---

## ✨ Key Features

- 👁️ **AURA Vision 3.0 (Edge AI Detection)**: Real-time video analysis utilizing `Puter.js` (gpt-5.4-nano) directly in the browser, capable of detecting threats, overcrowding, accidents, and security breaches with zero backend inference latency.
- ⚡ **Causal Cascade Engine**: A multi-module reactive event processor that acts simultaneously upon threat detection (alerts, logs, dispatch, telemetry).
- 🔔 **Multi-User Notification Hub**: Dynamic subscriber system allowing individuals and law enforcement to register via the frontend and receive simultaneous notifications.
  - **Telegram Integration**: Instant image-attached text alerts sent to Telegram bots.
  - **Twilio Voice Integration**: AI-synthesized emergency voice calls placed instantly to authorities on high/critical severity threats.
- 🏠 **Bento Dashboard**: A "Community Pulse" overview measuring city metrics: Health, Mobility, Security, and Environment.
- 🛡️ **Authority Command Panel**: Restricted interface allowing operators to broadcast alerts, request lockdown protocols, and generate comprehensive threat reports.

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite), HTML5/CSS3 (Neo-brutalism/Glassmorphism design)
- **Backend:** Python (FastAPI deployed as Vercel Serverless Functions)
- **AI/Vision:** Puter.js (`gpt-5.4-nano` multimodal vision)
- **Database/Storage:** Supabase (PostgreSQL for Multi-user Subscriber data)
- **Integrations:** Telegram Bot API, Twilio Voice API, Vercel Blob/Vercel functions.

---

## ⚙️ Architecture

1. **Client-Side (React)** 
   Captures video frames at an interval and sends them to the Puter.js AI vision model. It parses the JSON output to determine the threat severity.
2. **Alert Dispatch (FastAPI)**
   When a high severity threat is detected, the frontend pings the `/api/demo/detect` or `/api/dispatch` endpoints on the Vercel backend.
3. **Multi-User Broadcasting (Supabase + Python `asyncio`)**
   The backend fetches all registered subscribers from Supabase (`aura_subscribers` table) and concurrently dispatches Telegram messages (with photos) and Twilio voice calls to all users using asynchronous gathering (`asyncio.gather`).

---

## 🚀 Quick Setup (Development)

### Prerequisites
- Node.js & npm
- Python 3.9+
- [Vercel CLI](https://vercel.com/docs/cli) (Recommended for local API testing)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/aura-vision.git
cd aura-vision
```

### 2. Install Dependencies
**Frontend:**
```bash
npm install
```
**Backend (Python):**
```bash
pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your credentials:
```ini
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_admin_chat_id
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth
TWILIO_FROM_NUMBER=your_twilio_phone
TWILIO_TO_NUMBER=your_personal_phone

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### 4. Run Locally
To run both the Vite frontend and FastAPI backend seamlessly, use the Vercel Dev command:
```bash
npx vercel dev
```
The app will be available at `http://localhost:3000`.

---

## 🗄️ Database Schema (Supabase)

If setting up your own Supabase project, run the following SQL to create the subscriber table:

```sql
CREATE TABLE IF NOT EXISTS public.aura_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  twilio_sid TEXT,
  twilio_auth TEXT,
  twilio_from_number TEXT,
  twilio_to_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.aura_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_aura ON public.aura_subscribers FOR ALL USING (true) WITH CHECK (true);
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📄 License
This project is built for the Equinox Robotics Hackathon.
