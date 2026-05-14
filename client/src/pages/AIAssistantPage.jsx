import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../components/Auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Bot, Send, Loader2, User, Sparkles } from 'lucide-react'

const SUGGESTIONS = [
  'How many assets are currently critical?',
  'Which assets have expired warranties?',
  'List all HVAC assets and their status',
  'What maintenance is needed this month?',
  'Summarize the overall health of my building',
]

async function askClaude(question, assets) {
  const summary = assets.slice(0, 80).map(a =>
    `- ${a.name} (${a.category}) | Location: ${a.location || 'N/A'} | Status: ${a.status} | Manufacturer: ${a.manufacturer || 'N/A'} | Install: ${a.install_date || 'N/A'} | Warranty expires: ${a.warranty_expiry || 'N/A'}`
  ).join('\n')

  const systemPrompt = `You are TwinBIM's AI assistant — an expert in Building Information Management and Digital Twins.
You have access to the user's live building asset registry. Answer their questions about assets, maintenance, compliance, and building health clearly and concisely.
Today's date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.

ASSET REGISTRY (${assets.length} total assets):
${summary}
${assets.length > 80 ? `\n...and ${assets.length - 80} more assets not shown.` : ''}

Respond in plain language. Use bullet points where helpful. Flag any critical issues prominently.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }]
    })
  })
  const data = await res.json()
  return data.content?.[0]?.text || 'Sorry, I could not generate a response.'
}

export default function AIAssistantPage() {
  const { user }    = useAuth()
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [assets,    setAssets]    = useState([])
  const bottomRef   = useRef()

  useEffect(() => {
    supabase.from('assets').select('*').eq('user_id', user.id)
      .then(({ data }) => setAssets(data || []))
  }, [user.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const q = text || input
    if (!q.trim() || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q }])
    setLoading(true)
    try {
      const answer = await askClaude(q, assets)
      setMessages(m => [...m, { role: 'assistant', content: answer }])
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: `AI query: "${q.slice(0, 80)}"`,
        entity: 'ai'
      })
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles size={22} className="text-blue-400" /> AI Assistant
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Ask anything about your building assets — powered by Claude AI.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-5">
              <Bot size={28} className="text-blue-400" />
            </div>
            <p className="text-slate-400 mb-6 text-sm">
              {assets.length === 0
                ? 'Import some assets first, then ask me anything about your building.'
                : `I have access to ${assets.length} assets. Ask me anything!`
              }
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-full px-3 py-1.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-blue-400" />
              </div>
            )}
            <div className={`
              max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed
              ${m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'
              }
            `}>
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-blue-400" />
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your building assets…"
          className="input flex-1"
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="btn-primary px-4 flex items-center gap-2"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
