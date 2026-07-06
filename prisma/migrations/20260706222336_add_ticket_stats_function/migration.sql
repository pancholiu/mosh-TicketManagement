-- Computes dashboard ticket stats server-side: totals, open count, AI-resolution
-- count/rate, average resolution time, and a 30-day daily ticket count series.
CREATE OR REPLACE FUNCTION get_ticket_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH resolved AS (
    SELECT
      t."createdAt",
      t."updatedAt",
      EXISTS (
        SELECT 1 FROM "Reply" r WHERE r."ticketId" = t.id AND r."senderType" = 'AI'
      ) AS resolved_by_ai
    FROM "Ticket" t
    WHERE t.status IN ('RESOLVED', 'CLOSED')
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*) FROM "Ticket") AS total_tickets,
      (SELECT COUNT(*) FROM "Ticket" WHERE status IN ('NEW', 'PROCESSING', 'OPEN')) AS open_tickets,
      (SELECT COUNT(*) FROM resolved WHERE resolved_by_ai) AS resolved_by_ai_count,
      (SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) * 1000) FROM resolved) AS avg_resolution_time_ms
  ),
  days AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'UTC')::date - INTERVAL '29 days',
      (now() AT TIME ZONE 'UTC')::date,
      INTERVAL '1 day'
    )::date AS day
  ),
  day_counts AS (
    SELECT days.day, COUNT(t.id) AS count
    FROM days
    LEFT JOIN "Ticket" t
      ON t."createdAt" >= days.day AND t."createdAt" < days.day + INTERVAL '1 day'
    GROUP BY days.day
    ORDER BY days.day
  )
  SELECT json_build_object(
    'totalTickets', totals.total_tickets,
    'openTickets', totals.open_tickets,
    'resolvedByAiCount', totals.resolved_by_ai_count,
    'resolvedByAiPercent', CASE
      WHEN totals.total_tickets > 0 THEN (totals.resolved_by_ai_count::float / totals.total_tickets) * 100
      ELSE 0
    END,
    'avgResolutionTimeMs', totals.avg_resolution_time_ms,
    'ticketsByDay', (
      SELECT json_agg(json_build_object('date', to_char(day_counts.day, 'YYYY-MM-DD'), 'count', day_counts.count))
      FROM day_counts
    )
  ) INTO result
  FROM totals;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
