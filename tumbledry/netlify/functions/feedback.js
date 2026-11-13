// netlify/functions/feedback.js — staff view of customer ratings + call follow-up
//
// GET                                    all feedback (staff)
// POST { action: 'MARK_CALLED', id, notes }  record that the manager called the customer
// POST { action: 'UPDATE_NOTES', id, notes } edit call notes later

import { getDb, checkAuth, ok, err, cors } from './_db.js'
import { ensureFeedbackTable } from './_feedback.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (!checkAuth(event)) return err('Unauthorized', 401)

  let sql
  try { sql = getDb(); await ensureFeedbackTable(sql) }
  catch (e) { return err(`Database unavailable: ${e.message}`, 500) }

  try {
    if (event.httpMethod === 'GET') {
      const feedback = await sql`SELECT * FROM order_feedback ORDER BY created_at DESC LIMIT 1000`
      return ok({ feedback })
    }

    if (event.httpMethod !== 'POST') return err('Method not allowed', 405)
    let body
    try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid request') }
    const notes = String(body.notes || '').trim().slice(0, 2000)

    if (body.action === 'MARK_CALLED') {
      const rows = await sql`
        UPDATE order_feedback SET status = 'called', called_at = NOW(), call_notes = ${notes}
        WHERE id = ${body.id} RETURNING *`
      if (!rows.length) return err('Feedback not found', 404)
      return ok({ feedback: rows[0] })
    }

    if (body.action === 'UPDATE_NOTES') {
      const rows = await sql`UPDATE order_feedback SET call_notes = ${notes} WHERE id = ${body.id} RETURNING *`
      if (!rows.length) return err('Feedback not found', 404)
      return ok({ feedback: rows[0] })
    }

    return err('Unknown action')
  } catch (e) {
    return err(`Something went wrong: ${e.message}`, 500)
  }
}
