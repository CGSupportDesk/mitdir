import fs from 'node:fs/promises'
import { Pool } from '@neondatabase/serverless'
import { required } from './env.mjs'

const pool = new Pool({ connectionString: required('DATABASE_URL') })
try {
  const schema = await fs.readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
  console.log('MitDir database schema is up to date.')
} finally {
  await pool.end()
}
