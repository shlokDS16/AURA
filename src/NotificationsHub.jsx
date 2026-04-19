import { useState, useEffect } from 'react'

const API = ''

export default function NotificationsHub() {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [tab, setTab] = useState('register') // register | list | telegram-guide | twilio-guide
  const [form, setForm] = useState({
    name: '', telegram_bot_token: '', telegram_chat_id: '',
    twilio_sid: '', twilio_auth: '', twilio_from_number: '', twilio_to_number: ''
  })

  const fetchSubs = async () => {
    try {
      const r = await fetch(`${API}/api/subscribers`)
      const d = await r.json()
      if (d.success) setSubscribers(d.subscribers || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchSubs() }, [])

  const handleRegister = async () => {
    if (!form.name.trim()) return alert('Name is required')
    if (!form.telegram_bot_token && !form.twilio_sid) return alert('Add at least Telegram or Twilio credentials')
    setSaving(true)
    try {
      const r = await fetch(`${API}/api/subscribers/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const d = await r.json()
      if (d.success) {
        setForm({ name: '', telegram_bot_token: '', telegram_chat_id: '', twilio_sid: '', twilio_auth: '', twilio_from_number: '', twilio_to_number: '' })
        fetchSubs()
        setTab('list')
        alert('✅ Registered! You will now receive alerts on all threats.')
      }
    } catch (e) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await fetch(`${API}/api/subscribers/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const d = await r.json()
      setTestResult(d.results)
    } catch (e) { setTestResult({ error: e.message }) }
    setTesting(false)
  }

  const handleRemove = async (id) => {
    if (!confirm('Remove this subscriber?')) return
    await fetch(`${API}/api/subscribers/${id}`, { method: 'DELETE' })
    fetchSubs()
  }

  const inputStyle = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, marginBottom: 10 }
  const labelStyle = { display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }
  const cardStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }

  return (
    <section className="section" id="notifications">
      <div className="section-header">
        <div className="section-badge"><div className="dot" style={{ background: '#f59e0b' }}></div> NOTIFICATION HUB</div>
        <h2 className="section-title">Multi-User <em>Alerts</em></h2>
        <p className="section-subtitle">Register your Telegram bot and Twilio credentials. All registered users receive simultaneous alerts when threats are detected.</p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'register', label: '➕ Register', color: '#22c55e' },
          { id: 'list', label: `👥 Subscribers (${subscribers.length})`, color: '#3b82f6' },
          { id: 'telegram-guide', label: '📱 Telegram Guide', color: '#0ea5e9' },
          { id: 'twilio-guide', label: '📞 Twilio Guide', color: '#8b5cf6' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 16px', borderRadius: 8, border: tab === t.id ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.1)',
              background: tab === t.id ? `${t.color}22` : 'rgba(255,255,255,0.04)', color: tab === t.id ? t.color : '#94a3b8',
              cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── REGISTER TAB ── */}
      {tab === 'register' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={cardStyle}>
            <h3 style={{ color: '#0ea5e9', marginBottom: 16, fontSize: 16 }}>📱 Telegram Setup</h3>
            <label style={labelStyle}>Your Name</label>
            <input style={inputStyle} placeholder="e.g. Officer Sharma" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <label style={labelStyle}>Bot Token</label>
            <input style={inputStyle} placeholder="123456:ABC-DEF..." value={form.telegram_bot_token} onChange={e => setForm({...form, telegram_bot_token: e.target.value})} />
            <label style={labelStyle}>Chat ID</label>
            <input style={inputStyle} placeholder="e.g. 987654321" value={form.telegram_chat_id} onChange={e => setForm({...form, telegram_chat_id: e.target.value})} />
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Don't have these? Click the <strong>Telegram Guide</strong> tab above.</p>
          </div>

          <div style={cardStyle}>
            <h3 style={{ color: '#8b5cf6', marginBottom: 16, fontSize: 16 }}>📞 Twilio Setup <span style={{ fontSize: 11, color: '#64748b' }}>(Optional)</span></h3>
            <label style={labelStyle}>Account SID</label>
            <input style={inputStyle} placeholder="AC..." value={form.twilio_sid} onChange={e => setForm({...form, twilio_sid: e.target.value})} />
            <label style={labelStyle}>Auth Token</label>
            <input style={{...inputStyle}} type="password" placeholder="••••••••" value={form.twilio_auth} onChange={e => setForm({...form, twilio_auth: e.target.value})} />
            <label style={labelStyle}>From Number (Twilio)</label>
            <input style={inputStyle} placeholder="+1..." value={form.twilio_from_number} onChange={e => setForm({...form, twilio_from_number: e.target.value})} />
            <label style={labelStyle}>To Number (Your Phone)</label>
            <input style={inputStyle} placeholder="+91..." value={form.twilio_to_number} onChange={e => setForm({...form, twilio_to_number: e.target.value})} />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleRegister} disabled={saving}
              style={{ flex: 1, padding: '12px 24px', fontSize: 15 }}>
              {saving ? '⏳ Registering...' : '✅ Register & Start Receiving Alerts'}
            </button>
            <button className="btn btn-outline" onClick={handleTest} disabled={testing}
              style={{ padding: '12px 24px' }}>
              {testing ? '⏳ Testing...' : '🧪 Test Credentials'}
            </button>
          </div>

          {testResult && (
            <div style={{ gridColumn: '1 / -1', ...cardStyle, background: 'rgba(34,197,94,0.08)' }}>
              <h4 style={{ marginBottom: 8 }}>Test Results:</h4>
              <p>📱 Telegram: {testResult.telegram ? '✅ Working!' : '❌ Failed — check token & chat ID'}</p>
              <p>📞 Twilio: {testResult.twilio ? '✅ Call placed!' : testResult.error ? `❌ ${testResult.error}` : '⚠️ Not configured or failed'}</p>
            </div>
          )}
        </div>
      )}

      {/* ── SUBSCRIBERS LIST TAB ── */}
      {tab === 'list' && (
        <div>
          <div style={{ ...cardStyle, background: 'rgba(34,197,94,0.06)', marginBottom: 20 }}>
            <p style={{ color: '#4ade80', fontSize: 13 }}>🔔 <strong>Admin (Owner)</strong> is always notified via environment variables. Subscribers below receive alerts <strong>simultaneously</strong>.</p>
          </div>
          {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : subscribers.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <p style={{ fontSize: 48, marginBottom: 8 }}>👥</p>
              <p style={{ color: '#94a3b8' }}>No subscribers yet. Click <strong>Register</strong> to add your first responder.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {subscribers.map(s => (
                <div key={s.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
                  <div>
                    <strong style={{ color: '#e2e8f0' }}>{s.name}</strong>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: s.has_telegram ? '#4ade80' : '#64748b' }}>
                        {s.has_telegram ? '📱 Telegram ✓' : '📱 No Telegram'}
                      </span>
                      <span style={{ fontSize: 11, color: s.has_twilio ? '#4ade80' : '#64748b' }}>
                        {s.has_twilio ? '📞 Twilio ✓' : '📞 No Twilio'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(s.id)}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TELEGRAM GUIDE TAB ── */}
      {tab === 'telegram-guide' && (
        <div style={cardStyle}>
          <h3 style={{ color: '#0ea5e9', marginBottom: 20 }}>📱 How to Create a Telegram Bot & Get Your Chat ID</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { step: 1, title: 'Open Telegram', desc: 'Search for @BotFather in Telegram (official bot creator by Telegram).' },
              { step: 2, title: 'Create a Bot', desc: 'Send /newbot to @BotFather. Follow the prompts — give it a name like "AURA Alert Bot".' },
              { step: 3, title: 'Get Your Bot Token', desc: 'BotFather will give you a token like 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11. Copy this.' },
              { step: 4, title: 'Start the Bot', desc: 'Search for YOUR new bot by its username and click START. This is required!' },
              { step: 5, title: 'Get Your Chat ID', desc: 'Send a message to your bot, then visit: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates — look for "chat":{"id": YOUR_CHAT_ID}' },
              { step: 6, title: 'Alternative: Use @userinfobot', desc: 'Send /start to @userinfobot on Telegram. It will reply with your Chat ID instantly.' },
              { step: 7, title: 'Paste Both Values', desc: 'Go to the Register tab and paste your Bot Token and Chat ID. Click Test to verify!' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 36, height: 36, borderRadius: '50%', background: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                  {s.step}
                </div>
                <div>
                  <strong style={{ color: '#e2e8f0' }}>{s.title}</strong>
                  <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(14,165,233,0.08)', borderRadius: 8, border: '1px solid rgba(14,165,233,0.2)' }}>
            <p style={{ color: '#0ea5e9', fontSize: 13 }}>💡 <strong>Tip:</strong> Each user needs their OWN bot. Multiple people can create different bots and register them here. When AURA detects a threat, ALL registered bots send alerts simultaneously!</p>
          </div>
        </div>
      )}

      {/* ── TWILIO GUIDE TAB ── */}
      {tab === 'twilio-guide' && (
        <div style={cardStyle}>
          <h3 style={{ color: '#8b5cf6', marginBottom: 20 }}>📞 How to Set Up Twilio for Emergency Calls</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { step: 1, title: 'Sign Up for Twilio', desc: 'Go to twilio.com and create a free account. You get free trial credits.' },
              { step: 2, title: 'Get a Phone Number', desc: 'In the Twilio Console, go to Phone Numbers → Buy a Number. Pick one with Voice capability.' },
              { step: 3, title: 'Find Your Credentials', desc: 'On the Twilio Console dashboard, copy your Account SID and Auth Token.' },
              { step: 4, title: 'Verify Your Phone', desc: 'On free trial, you must verify the phone number you want to call. Go to Verified Caller IDs and add your number.' },
              { step: 5, title: 'Register in AURA', desc: 'Go to the Register tab. Enter your SID, Auth Token, Twilio number (From), and your phone (To).' },
              { step: 6, title: 'Test It', desc: 'Click the Test button to receive a test call. If it works, you are ready!' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 36, height: 36, borderRadius: '50%', background: '#8b5cf6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                  {s.step}
                </div>
                <div>
                  <strong style={{ color: '#e2e8f0' }}>{s.title}</strong>
                  <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(139,92,246,0.08)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)' }}>
            <p style={{ color: '#a78bfa', fontSize: 13 }}>💡 <strong>Tip:</strong> Twilio is optional. Even without it, Telegram alerts work perfectly. Twilio AI calls are triggered only for <strong>high/critical</strong> severity threats.</p>
          </div>
        </div>
      )}
    </section>
  )
}
