// netlify/functions/_feedback.js — shared table setup for order feedback (additive)

export async function ensureFeedbackTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS order_feedback (
      id             TEXT PRIMARY KEY,
      order_id       TEXT UNIQUE NOT NULL,
      tag_number     TEXT DEFAULT '',
      customer_phone TEXT NOT NULL,
      customer_name  TEXT DEFAULT '',
      rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment        TEXT DEFAULT '',
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      status         TEXT DEFAULT 'new',
      called_at      TIMESTAMPTZ,
      call_notes     TEXT DEFAULT ''
    )
  `
}
