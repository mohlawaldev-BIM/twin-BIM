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

app.listen(PORT, () => {
  console.log(`✅ TwinBIM server running on http://localhost:${PORT}`)
})
