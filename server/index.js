import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app  = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'TwinBIM server running', timestamp: new Date().toISOString() })
})

app.post('/api/ai', async (req, res) => {
  const { question, assets } = req.body

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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    })
    const data = await response.json()
    res.json({ answer: data.content?.[0]?.text || 'No response generated.' })
  } catch (err) {
    res.status(500).json({ error: 'AI request failed.' })
  }
})

app.listen(PORT, () => {
  console.log(`✅ TwinBIM server running on http://localhost:${PORT}`)
})
