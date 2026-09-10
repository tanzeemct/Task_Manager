// Actually executed with: node tests/status.test.mjs
// This file imports the REAL src/lib/status.js used by the app — not a copy,
// not a simulation. status.js has zero external dependencies, so it's the
// one module in this codebase that can run in plain Node without Vite,
// React, or Supabase installed.
import assert from 'node:assert/strict';
import { STATUS_META, isOverdue, primaryAction } from '../src/lib/status.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL: ${name}`);
    console.log('  ' + e.message);
    process.exitCode = 1;
  }
}

// --- STATUS_META completeness ---
// Every status the database schema/migrations actually allow must have a
// corresponding badge entry, or the UI silently falls back to "Pending",
// which would misreport a task's real state.
const DB_STATUSES = [
  'pending', 'accepted', 'in_progress', 'completed', 'awaiting_approval',
  'approved', 'rejected', 'cancelled', 'extension_requested', 'changes_requested'
];
test('every database-allowed status has a STATUS_META entry', () => {
  for (const s of DB_STATUSES) {
    assert.ok(STATUS_META[s], `Missing STATUS_META for "${s}"`);
  }
});

// --- isOverdue ---
test('isOverdue: past deadline, still in progress -> true', () => {
  assert.equal(isOverdue({ status: 'in_progress', deadline: '2020-01-01T00:00:00Z' }), true);
});
test('isOverdue: past deadline but approved -> false', () => {
  assert.equal(isOverdue({ status: 'approved', deadline: '2020-01-01T00:00:00Z' }), false);
});
test('isOverdue: past deadline but cancelled -> false', () => {
  assert.equal(isOverdue({ status: 'cancelled', deadline: '2020-01-01T00:00:00Z' }), false);
});
test('isOverdue: no deadline at all -> false', () => {
  assert.equal(isOverdue({ status: 'pending', deadline: null }), false);
});
test('isOverdue: future deadline -> false', () => {
  const future = new Date(Date.now() + 100000000).toISOString();
  assert.equal(isOverdue({ status: 'in_progress', deadline: future }), false);
});

// --- primaryAction: the exact bug fixed during the last audit ---
const ADMIN_ID = 'admin-uuid';
const USER_ID = 'user-uuid';

test('primaryAction: assignee on a pending task can accept', () => {
  const task = { assigned_to: USER_ID, created_by: ADMIN_ID, status: 'pending' };
  assert.equal(primaryAction(task, USER_ID, false)?.key, 'accept');
});

test('primaryAction: creator/Admin sees approve on someone else\u2019s awaiting_approval task', () => {
  const task = { assigned_to: USER_ID, created_by: ADMIN_ID, status: 'awaiting_approval' };
  assert.equal(primaryAction(task, ADMIN_ID, true)?.key, 'approve');
});

test('REGRESSION GUARD: Admin who is ALSO the assignee never gets an approve button on their own submission', () => {
  // This is the exact self-approval bug found and fixed in the previous audit.
  // A User assigned this task to Admin; Admin completed it; Admin must not
  // be able to approve their own work, even though profile.role === 'admin'.
  const task = { assigned_to: ADMIN_ID, created_by: USER_ID, status: 'awaiting_approval' };
  assert.equal(primaryAction(task, ADMIN_ID, true), null, 'Self-approval button must not appear');
});

test('primaryAction: changes_requested surfaces a Resubmit action to the assignee', () => {
  const task = { assigned_to: USER_ID, created_by: ADMIN_ID, status: 'changes_requested' };
  assert.equal(primaryAction(task, USER_ID, false)?.key, 'complete');
});

test('primaryAction: an uninvolved third party gets no action', () => {
  const task = { assigned_to: USER_ID, created_by: ADMIN_ID, status: 'pending' };
  assert.equal(primaryAction(task, 'someone-else-uuid', false), null);
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) console.log('SOME TESTS FAILED.');
