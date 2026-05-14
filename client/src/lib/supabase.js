import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://eyglzqnobmskevvdrfef.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5Z2x6cW5vYm1za2V2dmRyZmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDEzMjEsImV4cCI6MjA5NDE3NzMyMX0.aimEOAe5_wyb6J9UzEHjbZg5ucxGkmhuwC4Lxq62Doo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
