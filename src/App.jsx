import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'

// ── Environment Detection ──
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API = IS_LOCAL ? 'http://localhost:8001' : ''

// ═══════════════════════════════════════════════════════════════
// PUTER.JS AI VISION SERVICE (used when deployed on Vercel)
// ═══════════════════════════════════════════════════════════════
const AURA_VISION_PROMPT = `You are AURA, a real-time city security AI watching a CCTV feed.

Analyze this image and respond with ONLY a JSON object (no other text):

{
  "description": "<what is physically happening in the image - 1-2 sentences>",
  "is_emergency": <true or false>,
  "severity": "<safe, low, medium, high, or critical>",
  "alert_type": "<generate a short natural 2-4 word label representing exactly what you see>"
}

Rules:
- Generate your own natural alert_type. Do NOT rely on any prefixed tags.
- If you see ANY weapon like a scissors, knife, or sharp object being held aggressively - emergency, critical.
- If you see a man punching another person, fighting, or physical assault - emergency, critical.
- If vehicles are damaged or crashed - emergency, high.
- If there is fire or smoke - emergency, critical.
- If the scene looks normal and safe -> not emergency, safe.
- Evaluate the absolute truth of the frame and report exactly what you see.`

async function analyzeWithPuter(imageDataUrl) {
  if (typeof window.puter === 'undefined') {
    throw new Error('Puter.js not loaded')
  }
  
  try {
    const response = await window.puter.ai.chat(
      AURA_VISION_PROMPT,
      imageDataUrl,
      { model: 'gpt-5.4-nano' }
    )
    
    // Parse the response text as JSON
    let text = typeof response === 'string' ? response : (response?.message?.content || response?.text || JSON.stringify(response))
    
    // Clean markdown fences if present
    if (text.includes('```')) {
      text = text.includes('```json') 
        ? text.split('```json')[1].split('```')[0].trim()
        : text.split('```')[1].split('```')[0].trim()
    }
    
    const result = JSON.parse(text)
    
    const isEmergency = result.is_emergency === true
    const severity = result.severity || 'safe'
    const alertType = result.alert_type || 'safe / normal'
    
    if (!isEmergency || severity === 'safe') {
      return {
        label: 'safe / normal',
        description: result.description || 'Scene appears safe.',
        confidence: 0.99,
        severity: 'safe',
        engine: 'puter.js (gpt-5.4-nano)'
      }
    }
    
    const confMap = { critical: 0.95, high: 0.90, medium: 0.80, low: 0.65, safe: 0.99 }
    return {
      label: alertType,
      description: result.description || '',
      confidence: confMap[severity] || 0.85,
      severity: severity,
      engine: 'puter.js (gpt-5.4-nano)'
    }
  } catch (err) {
    console.error('[Puter.js] Analysis error:', err)
    throw err
  }
}


// ═══════════════════════════════════════════════════════════════
// STARFIELD CANVAS
// ═══════════════════════════════════════════════════════════════
function StarfieldCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let stars = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COUNT = 300
    for (let i = 0; i < COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        isGreen: Math.random() > 0.85,
      })
    }

    let time = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.016

      stars.forEach(s => {
        s.y -= s.speed
        s.x += s.speed * 0.15
        if (s.y < -5) { s.y = canvas.height + 5; s.x = Math.random() * canvas.width }
        if (s.x > canvas.width + 5) s.x = -5

        const twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed * 60 + s.twinklePhase)
        const alpha = s.opacity * twinkle

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.isGreen ? `rgba(34, 197, 94, ${alpha})` : `rgba(255, 255, 255, ${alpha})`
        ctx.fill()

        if (s.r > 1) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = s.isGreen ? `rgba(34, 197, 94, ${alpha * 0.15})` : `rgba(255, 255, 255, ${alpha * 0.1})`
          ctx.fill()
        }
      })

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />
}


// ═══════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════
function AnimatedCounter({ end, duration = 1500 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true
        const startTime = Date.now()
        const numEnd = typeof end === 'number' ? end : parseFloat(String(end))
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.round(numEnd * eased))
          if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count}</span>
}


// ═══════════════════════════════════════════════════════════════
// PULSE GAUGE
// ═══════════════════════════════════════════════════════════════
function PulseGauge({ score, size = 220 }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (circumference * score / 100)
  const color = score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="pulse-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.5s ease-out, stroke 0.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: size * 0.3, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
          <AnimatedCounter end={score} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 2, marginTop: 6, textTransform: 'uppercase' }}>
          {score >= 80 ? 'Optimal' : score >= 60 ? 'Degraded' : 'Critical'}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
function Sidebar({ activeSection, onNavigate }) {
  const sections = [
    { id: 'dashboard', label: 'Bento Dashboard', icon: '🏠' },
    { id: 'cascade', label: 'Cascade Engine', icon: '⚡' },
    { id: 'vision', label: 'AURA Vision', icon: '👁️' },
    { id: 'authority', label: 'Authority Panel', icon: '🛡️' },
    { id: 'guide', label: 'Setup Guide', icon: '📖' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">A</div>
        <div>
          <h1>AURA</h1>
          <span className="version-tag">v3.0 {IS_LOCAL ? '• Local' : '• Cloud'}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {sections.map(s => (
          <button
            key={s.id}
            className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => onNavigate(s.id)}
          >
            <span className="nav-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="status">
          <div className="status-dot"></div>
          <span>System Online • {IS_LOCAL ? 'Ollama' : 'Puter.js'} • Zone-4B</span>
        </div>
      </div>
    </aside>
  )
}


// ═══════════════════════════════════════════════════════════════
// BENTO DASHBOARD
// ═══════════════════════════════════════════════════════════════
function BentoDashboard({ pulse, onDemo }) {
  const dims = [
    { key: 'health', icon: '🏥', label: 'Health', color: '#ef4444' },
    { key: 'mobility', icon: '🚗', label: 'Mobility', color: 'var(--accent)' },
    { key: 'security', icon: '🛡️', label: 'Security', color: '#8b5cf6' },
    { key: 'environment', icon: '🌿', label: 'Environment', color: '#06b6d4' },
  ]

  const heatmapData = Array.from({ length: 24 }, () => ({
    opacity: Math.random() * 0.8 + 0.2,
    glow: Math.random() > 0.8
  }))

  return (
    <section className="section" id="dashboard">
      <div className="section-header">
        <div className="section-badge"><div className="dot"></div> LIVE SYSTEM CORE</div>
        <h2 className="section-title">
          Community <em>Pulse</em> Intelligence
        </h2>
        <p className="section-subtitle">
          Real-time systemic wellness monitoring for high-density urban ecosystems.
          Bio-inspired dimensional analysis across Health, Mobility, Security, and Living Environment.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 0.7fr', gap: 20, minHeight: 560 }}>
        
        {/* Pulse Score */}
        <div className="glass-card" style={{ gridRow: '1 / 3', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div className="status-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'pulse-dot 2s infinite' }}></div>
            <span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase' }}>Community Pulse</span>
          </div>
          <PulseGauge score={Math.round(pulse.score)} size={200} />
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>RESILIENCE INDEX</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {pulse.score >= 80 ? 'Stable Ecosystem' : pulse.score >= 60 ? 'Elevated Alert' : 'Critical Level'}
            </div>
          </div>
        </div>

        {/* Dimensional Cards */}
        {dims.map(d => (
          <div key={d.key} className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{d.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{d.label}</span>
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, fontFamily: 'var(--font-mono)', color: d.color }}>
              <AnimatedCounter end={pulse[d.key] || 0} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {(pulse[d.key] || 0) >= 85 ? '● Optimal' : (pulse[d.key] || 0) >= 70 ? '● Moderate' : '● Alert'}
            </div>
          </div>
        ))}

        {/* Activity Heatmap */}
        <div className="glass-card" style={{ gridColumn: '1 / 4', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
            24H Activity Heatmap
          </div>
          <div style={{ display: 'flex', gap: 4, height: 32, alignItems: 'end' }}>
            {heatmapData.map((cell, i) => (
              <div key={i} style={{
                flex: 1, height: `${cell.opacity * 100}%`, borderRadius: 3,
                background: cell.glow ? 'var(--accent)' : 'rgba(34, 197, 94, 0.3)',
                boxShadow: cell.glow ? '0 0 8px var(--accent)' : 'none',
                transition: 'height 0.5s ease'
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>00:00</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>12:00</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>23:59</span>
          </div>
        </div>
      </div>

      {/* Demo Buttons */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Quick Scenario Triggers
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[['violence', '👊', '#ef4444'], ['fire', '🔥', '#f97316'], ['crash', '🚗', '#eab308'], ['crowd', '👥', '#8b5cf6'], ['knife', '🔪', '#dc2626']].map(([s, icon, col]) => (
            <button key={s} className="btn btn-outline" style={{ borderColor: col, color: col }} onClick={() => onDemo(s)}>
              {icon} {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}


// ═══════════════════════════════════════════════════════════════
// CASCADE ENGINE
// ═══════════════════════════════════════════════════════════════
function CascadeEngine({ cascadeEvents, alertStream, onDemo, onReset }) {
  const severityColor = (sev) => {
    const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', safe: '#6b7280' }
    return colors[sev] || '#6b7280'
  }

  return (
    <section className="section" id="cascade">
      <div className="section-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="section-badge"><div className="dot" style={{ background: '#f97316' }}></div> CASCADE ENGINE</div>
            <h2 className="section-title">Causal <em>Cascade</em> Engine</h2>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={onReset}>Reset All Scores</button>
          </div>
        </div>
        <p className="section-subtitle">Multi-module reactive event processor. When AURA Vision detects an incident, the 6-module cascade fires simultaneously.</p>
      </div>

      {/* 6 Module Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: '🏥', title: 'Hospital Dispatch', desc: 'Nearest trauma centers alerted' },
          { icon: '🚔', title: 'Police Units', desc: 'QRT & PCR units dispatched' },
          { icon: '🏘️', title: 'Smart Homes', desc: 'Society lockdown protocols' },
          { icon: '📹', title: 'CCTV Network', desc: '4K tracking activated' },
          { icon: '📱', title: 'Telegram Alerts', desc: 'Authority channels notified' },
          { icon: '🔧', title: 'Infrastructure', desc: 'Street lights & traffic control' },
        ].map((mod, i) => (
          <div key={i} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{mod.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{mod.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mod.desc}</div>
          </div>
        ))}
      </div>

      {/* Cascade Event Log */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>EVENT LOG</h3>
        {cascadeEvents.length > 0 ? cascadeEvents.slice(-10).reverse().map((ev, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: severityColor(ev.severity), fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>{ev.severity}</span>
              <span style={{ marginLeft: 12, fontSize: 13 }}>{ev.label}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>
        )) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No cascade events recorded</div>
        )}
      </div>
    </section>
  )
}


// ═══════════════════════════════════════════════════════════════
// AURA VISION (DUAL MODE: Local=Ollama, Cloud=Puter.js)
// ═══════════════════════════════════════════════════════════════
function AuraVision({ detections, lastDetection, setLastDetection, onDetect, userLocation, onSetLocation, onTelegram, onReset, addCascadeEvent }) {
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const [streamStatus, setStreamStatus] = useState('disconnected')
  const [cameraUrl, setCameraUrl] = useState('')
  const [frameCount, setFrameCount] = useState(0)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [analysisLog, setAnalysisLog] = useState('')
  const [tunnelUrl, setTunnelUrl] = useState(() => localStorage.getItem('aura_tunnel_url') || 'https://aura-vision-demo.loca.lt')
  const [tunnelConnected, setTunnelConnected] = useState(false)
  const reconnectTimerRef = useRef(null)

  useEffect(() => {
    if (!lastDetection && detections.length > 0) {
      const latest = [...detections].reverse().find(d => d.severity !== 'safe' || d.hud)
      if (latest) setLastDetection(latest)
    }
  }, [detections, lastDetection, setLastDetection])

  const [locInput, setLocInput] = useState(userLocation)
  const fileRef = useRef(null)

  // ── Handle incoming WS message (shared by both local and tunnel modes) ──
  const handleWsMessage = useCallback((e) => {
    try {
      const data = JSON.parse(e.data)
      if (!data.frame) {
        if (data.cascade?.hud_extra) { setLastDetection({ ...data.detection, hud: data.cascade.hud_extra }); onDetect && onDetect() }
        return
      }
      setStreamStatus('live'); setFrameCount(c => c + 1)
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d'); const img = new Image()
      img.onload = () => {
        canvas.width = img.width || 640; canvas.height = img.height || 480; ctx.drawImage(img, 0, 0)
        if (data.detection?.bbox?.length === 4) {
          const [x1, y1, x2, y2] = data.detection.bbox
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.strokeRect(x1*(canvas.width/640), y1*(canvas.height/480), (x2-x1)*(canvas.width/640), (y2-y1)*(canvas.height/480))
        }
      }
      img.src = 'data:image/jpeg;base64,' + data.frame
      if (data.detection) {
        setLastDetection(prev => {
          const now = Date.now()
          const lastWasCritical = prev && prev.severity !== 'safe'
          const justHappened = prev?.lastUpdate && (now - prev.lastUpdate < 5000)
          if (data.detection.severity === 'safe' && lastWasCritical && justHappened) return prev
          const newHud = data.cascade?.hud_extra || (data.detection.severity === 'safe' ? prev?.hud : undefined)
          return { ...data.detection, hud: newHud, lastUpdate: now }
        })
        if (data.detection.severity !== 'safe') onDetect && onDetect()
      }
    } catch (err) {
      console.log('[AURA WS] Parse error:', err)
    }
  }, [onDetect, setLastDetection])

  // ── Connect to tunnel (used in cloud mode) ──
  const connectToTunnel = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) { try { wsRef.current.close() } catch {} }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)

    const cleanUrl = tunnelUrl.replace(/\/+$/, '') // strip trailing slash
    localStorage.setItem('aura_tunnel_url', cleanUrl)

    // Convert http(s) URL to ws(s) URL
    const wsUrl = cleanUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/dashboard'
    console.log('[AURA] Connecting to tunnel WS:', wsUrl)
    setStreamStatus('connecting')
    setAnalysisLog(`Connecting to ${cleanUrl}...`)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStreamStatus('no_phone')
      setTunnelConnected(true)
      setAnalysisLog(`✅ Connected to backend via tunnel! Waiting for phone camera feed...`)
      console.log('[AURA] Tunnel WS connected')
    }
    ws.onmessage = handleWsMessage
    ws.onerror = (err) => {
      console.log('[AURA] Tunnel WS error:', err)
      setAnalysisLog(`❌ Connection failed. Make sure backend + localtunnel are running, and you've clicked "Continue" on the localtunnel page.`)
    }
    ws.onclose = () => {
      console.log('[AURA] Tunnel WS closed')
      if (tunnelConnected) {
        setStreamStatus('disconnected')
        setAnalysisLog('⚠️ Tunnel disconnected. Attempting reconnect in 5s...')
        reconnectTimerRef.current = setTimeout(() => {
          if (tunnelConnected) connectToTunnel()
        }, 5000)
      }
    }
  }, [tunnelUrl, tunnelConnected, handleWsMessage])

  const disconnectTunnel = useCallback(() => {
    setTunnelConnected(false)
    if (wsRef.current) { try { wsRef.current.close() } catch {} wsRef.current = null }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    setStreamStatus('cloud')
    setAnalysisLog('')
    setFrameCount(0)
  }, [])

  // WebSocket for live stream
  useEffect(() => {
    if (IS_LOCAL) {
      // Local mode — connect directly to localhost:8001
      let ws; let reconnectTimer
      const connect = () => {
        setStreamStatus('connecting')
        ws = new WebSocket(`ws://${window.location.hostname}:8001/ws/dashboard`)
        wsRef.current = ws
        ws.onopen = () => setStreamStatus('no_phone')
        ws.onmessage = handleWsMessage
        ws.onclose = () => { setStreamStatus('disconnected'); reconnectTimer = setTimeout(connect, 3000) }
      }
      connect()
      return () => { clearTimeout(reconnectTimer); ws?.close() }
    } else {
      // Cloud mode — wait for manual tunnel connection
      setStreamStatus('cloud')
      setCameraUrl('Connect to your local backend tunnel below, or upload images for Puter.js analysis')
    }
  }, [handleWsMessage])

  // ── Upload Handler: Dual Mode ──
  const handleUpload = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    e.target.value = ''
    setUploading(true)
    setUploadResult(null)
    setAnalysisLog('Analyzing image...')

    if (IS_LOCAL) {
      // LOCAL MODE: Send to backend (Ollama path)
      const formData = new FormData()
      formData.append('file', f)
      try {
        const resp = await fetch(`${API}/api/vision/upload`, { method: 'POST', body: formData })
        const data = await resp.json()
        setUploadResult(data)
        setAnalysisLog(`[Ollama/Gemma4] ${data.detection?.description || 'Analysis complete'}`)
        if (data.detection) {
          const det = data.detection
          const hudData = data.cascade?.hud_extra || det.hud
          setLastDetection({ ...det, hud: hudData, lastUpdate: Date.now() })
          if (det.severity !== 'safe') onDetect && onDetect()
          if (data.cascade) addCascadeEvent && addCascadeEvent(data.cascade)
        }
      } catch (err) {
        setAnalysisLog(`Error: ${err.message}`)
      } finally {
        setUploading(false)
      }
    } else {
      // CLOUD MODE: Use Puter.js for analysis, then trigger backend cascade
      try {
        setAnalysisLog('Puter.js AI analyzing image...')
        
        // Convert file to data URL for Puter.js
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(f)
        })
        
        // Also get base64 for Telegram photo
        const b64 = dataUrl.split(',')[1]
        
        // Analyze with Puter.js
        const aiResult = await analyzeWithPuter(dataUrl)
        setAnalysisLog(`[Puter.js] ${aiResult.description} | Severity: ${aiResult.severity}`)
        
        // Draw image on canvas for visual
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          const img = new Image()
          img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0) }
          img.src = dataUrl
        }
        
        // If emergency, trigger backend cascade (Telegram + Twilio)
        if (aiResult.severity !== 'safe') {
          const cascadeResp = await fetch(`${API}/api/cascade/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label: aiResult.label,
              severity: aiResult.severity,
              confidence: aiResult.confidence,
              description: aiResult.description,
              location: userLocation,
              frame: b64
            })
          })
          const cascadeData = await cascadeResp.json()
          setUploadResult(cascadeData)
          
          if (cascadeData.detection) {
            setLastDetection({ ...cascadeData.detection, lastUpdate: Date.now() })
            onDetect && onDetect()
            if (cascadeData.cascade) addCascadeEvent && addCascadeEvent(cascadeData.cascade)
          }
          setAnalysisLog(`[CASCADE] Telegram + AI Call fired for: ${aiResult.label}`)
        } else {
          // Safe — just show the result
          const det = {
            id: Math.random().toString(36).slice(2, 10),
            label: aiResult.label,
            severity: 'safe',
            confidence: aiResult.confidence,
            description: aiResult.description,
            engine: aiResult.engine,
            created_at: new Date().toISOString()
          }
          setUploadResult({ success: true, detection: det })
          setLastDetection({ ...det, lastUpdate: Date.now() })
        }
      } catch (err) {
        console.error('[Puter Vision] Error:', err)
        setAnalysisLog(`Error: ${err.message}`)
      } finally {
        setUploading(false)
      }
    }
  }

  const isEmergency = lastDetection && lastDetection.severity !== 'safe'
  const hud = lastDetection?.hud

  return (
    <section className="section" id="vision" style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="section-badge"><div className="dot" style={{ background: '#8b5cf6' }}></div> VISION COMMAND</div>
            <h2 className="section-title">AURA <em>Vision 3.0</em></h2>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={onReset}>Reset All Scores</button>
            <button className="btn btn-outline" onClick={() => setShowLocationModal(true)}>
              📍 {userLocation}
            </button>
          </div>
        </div>
        {!IS_LOCAL && (
          <div style={{ marginTop: 8, padding: '8px 16px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: 8, fontSize: 12, color: '#a78bfa' }}>
            🧠 AI Engine: <strong>Puter.js (gpt-5.4-nano)</strong> — runs entirely in your browser, no API keys needed
          </div>
        )}
      </div>

      {showLocationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: 32, width: 400 }}>
             <h3 style={{ marginBottom: 16 }}>Set Monitoring Location</h3>
             <input className="input" value={locInput} onChange={e => setLocInput(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
             <div style={{ display: 'flex', gap: 12 }}>
               <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { onSetLocation(locInput); setShowLocationModal(false); }}>Update</button>
               <button className="btn btn-outline" onClick={() => setShowLocationModal(false)}>Cancel</button>
             </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 3fr)', gap: 24 }}>
        {/* Main Feed Column */}
        <div>
          <div className="stream-panel">
            <div className="stream-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`status-dot ${streamStatus === 'live' ? 'online' : (tunnelConnected ? 'online' : '')}`}></div>
                <span style={{ fontWeight: 800 }}>{streamStatus === 'live' ? 'LIVE_VIDEO_FEED' : (tunnelConnected ? 'TUNNEL_CONNECTED' : (IS_LOCAL ? 'LIVE_VIDEO_FEED' : 'CLOUD_VISION'))}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {frameCount} FRAMES · {tunnelConnected ? 'GEMMA4' : (IS_LOCAL ? 'G4' : 'PUTER.JS')} · {streamStatus.toUpperCase()}
              </div>
            </div>
            <div style={{ background: '#000', borderRadius: '0 0 12px 12px', overflow: 'hidden', aspectRatio: '16/9', position: 'relative' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {streamStatus !== 'live' && !IS_LOCAL && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                   <div style={{ fontSize: 40, marginBottom: 16 }}>{tunnelConnected ? '📡' : '🧠'}</div>
                   <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                     {tunnelConnected 
                       ? (streamStatus === 'connecting' ? 'Connecting to tunnel...' : 'Waiting for phone camera feed...')
                       : 'Connect to tunnel below for live feed, or upload an image'
                     }
                   </p>
                   <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>
                     {tunnelConnected ? 'Open /camera on your phone to start streaming' : 'Powered by Puter.js + Gemma 4 via tunnel'}
                   </p>
                </div>
              )}
              {streamStatus !== 'live' && IS_LOCAL && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                   <div style={{ fontSize: 40, marginBottom: 16 }}>📷</div>
                   <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Connect AURA Multi-Sensor or Phone Cam</p>
                </div>
              )}
            </div>
          </div>

          {/* Tunnel Connection Panel — Cloud Mode */}
          {!IS_LOCAL && (
            <div className="glass-card" style={{ padding: 20, marginTop: 16, borderColor: tunnelConnected ? 'var(--accent)' : 'rgba(139,92,246,0.3)', borderWidth: 1, borderStyle: 'solid' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📡</span>
                Live Feed Connection
                {tunnelConnected && <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: 99 }}>CONNECTED</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  className="input"
                  value={tunnelUrl}
                  onChange={e => setTunnelUrl(e.target.value)}
                  placeholder="https://aura-vision-demo.loca.lt"
                  style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  disabled={tunnelConnected}
                />
                {!tunnelConnected ? (
                  <button className="btn btn-primary" onClick={connectToTunnel} style={{ whiteSpace: 'nowrap' }}>
                    🔗 Connect
                  </button>
                ) : (
                  <button className="btn btn-outline" onClick={disconnectTunnel} style={{ whiteSpace: 'nowrap', borderColor: '#ef4444', color: '#ef4444' }}>
                    ✕ Disconnect
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {!tunnelConnected 
                  ? <>Enter your localtunnel or ngrok URL. Your local backend must be running on port 8001. Open <code style={{ color: '#a78bfa' }}>/camera</code> on your phone to stream.</>
                  : <>Live feed active. Frames from your phone are being analyzed by Gemma 4 on your local machine. Threats auto-trigger Telegram + Twilio alerts.</>
                }
              </div>
            </div>
          )}

          {/* Upload + Analysis Log */}
          <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <label className="btn btn-primary" style={{ cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
                {uploading ? 'Analyzing...' : '📤 Upload Image for Analysis'}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>
            {analysisLog && (
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                {analysisLog}
              </div>
            )}
          </div>
        </div>

        {/* Detection Panel */}
        <div>
          {isEmergency && lastDetection ? (
            <div className={`glass-card ${isEmergency ? 'emergency-active' : ''}`} style={{ padding: 20, borderColor: 'var(--danger)', borderWidth: 2, animation: 'pulse-border 1.5s infinite' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: 'var(--danger)', marginBottom: 12, textTransform: 'uppercase' }}>
                🚨 ACTIVE ALERT
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{lastDetection.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{lastDetection.description}</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div style={{ background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>SEVERITY</div>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>{lastDetection.severity}</div>
                </div>
                <div style={{ background: 'rgba(139,92,246,0.1)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>CONFIDENCE</div>
                  <div style={{ fontWeight: 700, color: '#a78bfa' }}>{Math.round((lastDetection.confidence || 0) * 100)}%</div>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.1)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>ENGINE</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{lastDetection.engine || (IS_LOCAL ? 'Gemma4' : 'Puter.js')}</div>
                </div>
                <div style={{ background: 'rgba(249,115,22,0.1)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>ZONE</div>
                  <div style={{ fontWeight: 700, color: '#f97316' }}>{lastDetection.zone_id || 'Zone-4B'}</div>
                </div>
              </div>

              {/* HUD Module Grid */}
              {hud && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {hud.hospitals && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>🏥 {hud.hospitals[0]?.name}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{hud.hospitals[0]?.distance} • ETA {hud.hospitals[0]?.eta}</div>
                    </div>
                  )}
                  {hud.police_units && (
                    <div style={{ background: 'rgba(59,130,246,0.08)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>🚔 {hud.police_units[0]?.unit}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{hud.police_units[0]?.status} • ETA {hud.police_units[0]?.eta}</div>
                    </div>
                  )}
                  {hud.smart_homes && (
                    <div style={{ background: 'rgba(168,85,247,0.08)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>🏘️ {hud.smart_homes.societies}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{hud.smart_homes.status}</div>
                    </div>
                  )}
                  {hud.cctv && (
                    <div style={{ background: 'rgba(234,179,8,0.08)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>📹 {hud.cctv.cam_id}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{hud.cctv.resolution} • {hud.cctv.tracking}</div>
                    </div>
                  )}
                  {hud.telegram && (
                    <div style={{ background: 'rgba(34,197,94,0.08)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>📱 Telegram</div>
                      <div style={{ color: 'var(--text-muted)' }}>{hud.telegram.alert_status} • {hud.telegram.messages_sent} msgs</div>
                    </div>
                  )}
                  {hud.infrastructure && (
                    <div style={{ background: 'rgba(6,182,212,0.08)', padding: 10, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>🔧 Infrastructure</div>
                      <div style={{ color: 'var(--text-muted)' }}>{hud.infrastructure.street_lights}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>All Clear</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                No active threats detected. Upload an image or connect a camera to begin monitoring.
              </div>
              {lastDetection && (
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Last: {lastDetection.label} ({lastDetection.engine})
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}


// ═══════════════════════════════════════════════════════════════
// AUTHORITY PANEL
// ═══════════════════════════════════════════════════════════════
function AuthorityPanel({ pulse, cascadeEvents, onReport, onLockdown, onBroadcast }) {
  const [actionStatus, setActionStatus] = useState('')
  const [loading, setLoading] = useState('')

  const handleAction = async (action, handler) => {
    setLoading(action)
    setActionStatus('')
    try {
      const result = await handler()
      setActionStatus(result?.success ? `✅ ${action} — sent to Telegram!` : `❌ ${action} failed`)
    } catch (e) {
      setActionStatus(`❌ ${action} error: ${e.message}`)
    } finally {
      setLoading('')
    }
  }

  return (
    <section className="section" id="authority">
      <div className="section-header">
        <div className="section-badge"><div className="dot" style={{ background: '#22c55e' }}></div> AUTHORITY ACCESS</div>
        <h2 className="section-title">Authority <em>Command</em> Panel</h2>
        <p className="section-subtitle">Restricted interface for government and law enforcement coordination.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>System Status</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              ['AI Engine', IS_LOCAL ? 'Ollama Gemma4 (Local)' : 'Puter.js GPT-5.4-nano (Cloud)', 'var(--accent)'],
              ['Cascade Engine', 'Active — 6 modules', '#8b5cf6'],
              ['Telegram Bot', 'Connected — AURA_AUTH_ADMIN', '#3b82f6'],
              ['Twilio Voice', 'Active — Auto-call enabled', '#f97316'],
              ['Community Score', `${pulse.score}/100`, pulse.score >= 80 ? 'var(--accent)' : 'var(--danger)'],
            ].map(([label, value, color], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => handleAction('Report', onReport)} style={{ width: '100%' }} disabled={loading === 'Report'}>
              {loading === 'Report' ? '⏳ Sending...' : '📊 Generate Incident Report'}
            </button>
            <button className="btn btn-outline" onClick={() => handleAction('Lockdown', onLockdown)} style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444' }} disabled={loading === 'Lockdown'}>
              {loading === 'Lockdown' ? '⏳ Sending...' : '🔒 Initiate Zone Lockdown'}
            </button>
            <button className="btn btn-outline" onClick={() => handleAction('Broadcast', onBroadcast)} style={{ width: '100%', borderColor: '#f97316', color: '#f97316' }} disabled={loading === 'Broadcast'}>
              {loading === 'Broadcast' ? '⏳ Sending...' : '📡 Broadcast Public Alert'}
            </button>
          </div>
          {actionStatus && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: actionStatus.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: actionStatus.startsWith('✅') ? 'var(--accent)' : 'var(--danger)' }}>
              {actionStatus}
            </div>
          )}
          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            Recent cascade events: {cascadeEvents.length}
          </div>
        </div>
      </div>
    </section>
  )
}


// ═══════════════════════════════════════════════════════════════
// SETUP GUIDE
// ═══════════════════════════════════════════════════════════════
function SetupGuide() {
  return (
    <section className="section" id="guide">
      <div className="section-header">
        <div className="section-badge"><div className="dot" style={{ background: '#06b6d4' }}></div> DOCUMENTATION</div>
        <h2 className="section-title">Setup <em>Guide</em></h2>
        <p className="section-subtitle">How to connect your phone camera for live detection and use all AURA features.</p>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        {/* How it works */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🧠 How AURA Vision Works</h3>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 12 }}>AURA uses <strong>dual AI engines</strong> depending on your environment:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'rgba(34,197,94,0.08)', padding: 16, borderRadius: 12 }}>
                <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>🏠 Local Mode</div>
                <div style={{ fontSize: 12 }}>Uses <strong>Ollama Gemma 4</strong> running on your machine. Requires local backend on port 8001.</div>
              </div>
              <div style={{ background: 'rgba(139,92,246,0.08)', padding: 16, borderRadius: 12 }}>
                <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>☁️ Cloud Mode (This Site)</div>
                <div style={{ fontSize: 12 }}>Uses <strong>Puter.js (GPT-5.4 Nano)</strong> running entirely in your browser. Zero cost, no API keys.</div>
              </div>
            </div>
            <p>When an emergency is detected, the <strong>Cascade Engine</strong> automatically:</p>
            <ol style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>Sends a detailed <strong>Telegram alert</strong> with photo to the authority channel</li>
              <li>Places an <strong>automated AI voice call</strong> via Twilio to the registered number</li>
              <li>Activates all 6 response modules (Hospital, Police, CCTV, Smart Homes, Infrastructure, Telegram)</li>
            </ol>
          </div>
        </div>

        {/* Image Upload Guide */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📤 Quick Test: Upload an Image</h3>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <ol style={{ paddingLeft: 20 }}>
              <li>Go to the <strong>AURA Vision</strong> section from the sidebar</li>
              <li>Click <strong>"Upload Image for Analysis"</strong></li>
              <li>Select any image (e.g., a photo showing fire, a fight, weapons, or a car crash)</li>
              <li>The AI will analyze it in real-time and display the results</li>
              <li>If a threat is detected, the Cascade Engine fires automatically</li>
            </ol>
          </div>
        </div>

        {/* ngrok Guide */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📱 Live Camera Feed via Tunnel</h3>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 12 }}>To stream your phone's camera to AURA for real-time Gemma 4 AI analysis:</p>
            
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 16 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}># Step 1: Clone and start the local backend</div>
              <div style={{ color: '#22c55e' }}>git clone https://github.com/shlokDS16/AURA.git</div>
              <div style={{ color: '#22c55e' }}>cd aura3.0/backend</div>
              <div style={{ color: '#22c55e' }}>pip install -r requirements.txt</div>
              <br />
              <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}># On Windows (fix unicode):</div>
              <div style={{ color: '#22c55e' }}>$env:PYTHONIOENCODING="utf-8"; python -m uvicorn main:app --host 0.0.0.0 --port 8001</div>
              <br />
              <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}># Step 2: Open a tunnel (pick one)</div>
              <div style={{ color: '#f97316' }}># Option A — localtunnel (free, no signup)</div>
              <div style={{ color: '#22c55e' }}>npx localtunnel --port 8001 --subdomain aura-vision-demo</div>
              <br />
              <div style={{ color: '#f97316' }}># Option B — ngrok (faster, requires free account)</div>
              <div style={{ color: '#22c55e' }}>ngrok http 8001</div>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.1)', padding: 14, borderRadius: 8, marginBottom: 16, borderLeft: '3px solid #ef4444' }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>⚠️ Important: localtunnel Confirmation Page</div>
              <div style={{ fontSize: 12 }}>
                When you first open a localtunnel URL, it shows a <strong>"Click to Continue"</strong> page. 
                You must click the button on that page before the tunnel becomes functional. 
                This only needs to be done once per session.
              </div>
            </div>

            <p style={{ marginBottom: 8, fontWeight: 700 }}>Step 3: Open the camera on your phone</p>
            
            <div style={{ background: 'rgba(139,92,246,0.1)', padding: 12, borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
              <a href="https://aura-vision-demo.loca.lt/camera" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>
                https://aura-vision-demo.loca.lt<strong>/camera</strong>
              </a>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.08)', padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              <strong style={{ color: 'var(--accent)' }}>How it works:</strong> Your phone camera streams frames → localtunnel routes to your PC → 
              Ollama Gemma 4 analyzes each frame → threats auto-trigger Telegram alerts + AI voice calls via Twilio.
            </div>

            <p style={{ marginTop: 12 }}>
              <strong>Dashboard:</strong> Open <a href="https://aura-vision-demo.loca.lt/ws/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>the dashboard WebSocket</a> in your browser to see the live detection feed. 
              Or use this Vercel-hosted site locally at <code>localhost:5173</code> while the backend runs on <code>:8001</code>.
            </p>
          </div>
        </div>

        {/* Architecture */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🏗️ Architecture</h3>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                ['Frontend', 'React + Vite', 'Vercel Static'],
                ['AI Vision', 'Puter.js / Ollama', 'Browser / Local'],
                ['Backend API', 'FastAPI (Python)', 'Vercel Serverless'],
                ['Alerts', 'Telegram Bot API', 'Text + Photo'],
                ['Voice Call', 'Twilio TwiML', 'AI Voice (Polly.Aditi)'],
                ['Cascade', '6-Module Engine', '< 2s Response'],
              ].map(([title, tech, deploy], i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)' }}>{tech}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{deploy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
function App() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [pulse, setPulse] = useState({
    score: 92, health: 88, mobility: 94, security: 91, environment: 95,
    trend: 'stable', updated_at: new Date().toISOString()
  })
  const [cascadeEvents, setCascadeEvents] = useState([])
  const [alertStream, setAlertStream] = useState([])
  const [detections, setDetections] = useState([])
  const [lastDetection, setLastDetection] = useState(null)
  const [userLocation, setUserLocation] = useState('Anna Nagar, Chennai')

  const addCascadeEvent = useCallback((event) => {
    setCascadeEvents(prev => [...prev, event])
  }, [])

  const updateBackendLocation = async (loc) => {
    try {
      await fetch(`${API}/api/vision/set-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: loc })
      })
    } catch (e) { console.log('Location update failed') }
  }

  const refreshData = useCallback(async () => {
    try {
      const [pulseRes, cascadeRes, streamRes, detectRes] = await Promise.all([
        fetch(`${API}/api/pulse`).then(r => r.json()),
        fetch(`${API}/api/cascade/events`).then(r => r.json()),
        fetch(`${API}/api/cascade/stream`).then(r => r.json()),
        fetch(`${API}/api/vision/detections`).then(r => r.json()),
      ])
      if (pulseRes.success) setPulse(pulseRes.data)
      if (cascadeRes.success && cascadeRes.data.length > 0) setCascadeEvents(prev => [...prev, ...cascadeRes.data])
      if (streamRes.success && streamRes.data.length > 0) setAlertStream(streamRes.data)
      if (detectRes.success && detectRes.data.length > 0) setDetections(detectRes.data)
    } catch (e) {
      console.log('[AURA] Backend polling skipped')
    }
  }, [])

  useEffect(() => {
    refreshData()
    const interval = setInterval(refreshData, IS_LOCAL ? 3000 : 8000)
    return () => clearInterval(interval)
  }, [refreshData])

  const navigate = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    const sections = ['dashboard', 'cascade', 'vision', 'authority', 'guide']
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveSection(entry.target.id)
      })
    }, { threshold: 0.3 })

    sections.forEach(id => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const fireDemo = async (scenario) => {
    try {
      const resp = await fetch(`${API}/api/demo/${scenario}`, { method: 'POST' })
      const data = await resp.json()
      if (data.cascade) addCascadeEvent(data.cascade)
      setTimeout(refreshData, 500)
    } catch { console.log('[AURA] Demo fire failed') }
  }

  const resetDemo = async () => {
    try {
      await fetch(`${API}/api/demo/reset`, { method: 'POST' })
      setDetections([])
      setCascadeEvents([])
      setAlertStream([])
      setLastDetection(null)
      setTimeout(refreshData, 500)
    } catch { console.log('[AURA] Reset failed') }
  }

  const sendToTelegram = async (msg) => {
    try {
      await fetch(`${API}/api/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
      alert('Sent to Telegram Authority Bot')
    } catch (e) { alert('Telegram failed') }
  }

  const generateReport = async () => {
    try {
      const resp = await fetch(`${API}/api/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pulse_score: pulse.score,
          health: pulse.health,
          mobility: pulse.mobility,
          security: pulse.security,
          environment: pulse.environment,
          total_events: cascadeEvents.length,
          location: userLocation
        })
      })
      return await resp.json()
    } catch (e) {
      console.error('[AURA] Report failed:', e)
      return { success: false }
    }
  }

  const initiateLockdown = async () => {
    try {
      const resp = await fetch(`${API}/api/authority/lockdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: userLocation })
      })
      return await resp.json()
    } catch (e) {
      console.error('[AURA] Lockdown failed:', e)
      return { success: false }
    }
  }

  const broadcastAlert = async () => {
    try {
      const resp = await fetch(`${API}/api/authority/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: userLocation })
      })
      return await resp.json()
    } catch (e) {
      console.error('[AURA] Broadcast failed:', e)
      return { success: false }
    }
  }

  return (
    <>
      <StarfieldCanvas />
      <div className="nebula-glow nebula-1"></div>
      <div className="nebula-glow nebula-2"></div>
      <div className="nebula-glow nebula-3"></div>
      <div className="grid-overlay"></div>

      <div className="app-layout">
        <Sidebar activeSection={activeSection} onNavigate={navigate} />
        <main className="main-content">
          {activeSection === 'dashboard' && <BentoDashboard pulse={pulse} onDemo={fireDemo} />}
          {activeSection === 'cascade' && <CascadeEngine cascadeEvents={cascadeEvents} alertStream={alertStream} onDemo={fireDemo} onReset={resetDemo} />}
          {activeSection === 'vision' && (
            <AuraVision
              detections={detections}
              lastDetection={lastDetection}
              setLastDetection={setLastDetection}
              onDetect={refreshData}
              userLocation={userLocation}
              onSetLocation={(loc) => { setUserLocation(loc); updateBackendLocation(loc); }}
              onTelegram={sendToTelegram}
              onReset={resetDemo}
              addCascadeEvent={addCascadeEvent}
            />
          )}
          {activeSection === 'authority' && <AuthorityPanel pulse={pulse} cascadeEvents={cascadeEvents} onReport={generateReport} onLockdown={initiateLockdown} onBroadcast={broadcastAlert} />}
          {activeSection === 'guide' && <SetupGuide />}
        </main>
      </div>
    </>
  )
}

export default App
