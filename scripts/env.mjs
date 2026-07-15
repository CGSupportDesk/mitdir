import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

for (const name of ['.env.local', '.env']) {
  const file = path.resolve(process.cwd(), name)
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false })
}

export function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}
