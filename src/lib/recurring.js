import { supabase } from './supabaseClient';

// NOTE ON ARCHITECTURE: a proper implementation runs this on a server-side
// schedule (e.g. a Supabase Edge Function + pg_cron, both free) so occurrences
// appear even if nobody opens the app that day. This client-side version is a
// pragmatic interim step: it checks for due occurrences whenever an Admin
// loads the app, which is honest but imperfect — documented in the README.

// Exported for direct unit testing (see tests/recurring.test.mjs) — this is
// the one piece of recurrence logic worth testing in isolation, since
// month-end/leap-year/weekly-interval math is exactly where these bugs hide.
export function nextDateFromTemplate(t, fromDate) {
  const d = new Date(fromDate);
  if (t.frequency === 'daily') d.setDate(d.getDate() + t.interval_count);
  if (t.frequency === 'weekly') d.setDate(d.getDate() + 7 * t.interval_count);
  if (t.frequency === 'monthly') {
    // Plain `d.setMonth(d.getMonth() + n)` overflows on short months: Jan 31
    // + 1 month silently becomes March 2/3 instead of the last day of Feb.
    // Clamp explicitly to the target month's real last day instead.
    const originalDay = d.getDate();
    const targetMonthIndex = d.getMonth() + t.interval_count;
    const daysInTargetMonth = new Date(d.getFullYear(), targetMonthIndex + 1, 0).getDate();
    d.setDate(1); // avoid any overflow while changing the month itself
    d.setMonth(targetMonthIndex);
    d.setDate(Math.min(originalDay, daysInTargetMonth));
  }
  if (t.frequency === 'custom') d.setDate(d.getDate() + t.interval_count);
  return d;
}

export async function generateDueOccurrences() {
  const { data: templates } = await supabase.from('recurring_templates').select('*').eq('active', true);
  if (!templates) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const t of templates) {
    if (t.end_type === 'after_count' && t.occurrences_created >= t.end_count) continue;
    if (t.end_type === 'on_date' && t.end_date && new Date(t.end_date) < today) continue;

    const base = t.last_generated_date ? new Date(t.last_generated_date) : new Date(today);
    const due = t.last_generated_date ? nextDateFromTemplate(t, base) <= today : true;
    if (!due) continue;

    const [hh, mm] = (t.default_time || '17:00').split(':');
    const deadline = new Date(today);
    deadline.setHours(Number(hh), Number(mm), 0, 0);

    await supabase.from('tasks').insert({
      title: t.title,
      description: t.description,
      created_by: t.created_by,
      assigned_to: t.assigned_to,
      priority: t.priority,
      proof_required: t.proof_required,
      deadline: deadline.toISOString(),
      recurring_template_id: t.id
    });
    // If two sessions raced and both tried to generate today's occurrence,
    // the unique index added in migration_003.sql (recurring_template_id +
    // deadline date) rejects the second insert — that failure is expected
    // and intentionally not surfaced as an error, it's the duplicate guard working.

    await supabase
      .from('recurring_templates')
      .update({
        last_generated_date: today.toISOString().slice(0, 10),
        occurrences_created: t.occurrences_created + 1
      })
      .eq('id', t.id);
  }
}
