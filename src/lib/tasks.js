import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

// Fetches tasks relevant to the current user (their own + assigned to them,
// or everything if admin), and stays live via Realtime.
export function useTasks({ isAdmin, userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from('tasks')
      .select('*, assignee:assigned_to(full_name), creator:created_by(full_name)')
      .order('deadline', { ascending: true, nullsFirst: false });

    if (!isAdmin) {
      query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to load tasks', error);
      setTasks([]);
    } else {
      setTasks(
        (data || []).map((t) => ({
          ...t,
          assignee_name: t.assignee?.full_name,
          creator_name: t.creator?.full_name
        }))
      );
    }
    setLoading(false);
  }, [isAdmin, userId]);

  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { tasks, loading, refresh: load };
}

export async function fetchTaskWithDetails(taskId) {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*, assignee:assigned_to(full_name), creator:created_by(full_name)')
    .eq('id', taskId)
    .single();
  if (error) return { task: null, error };

  const [{ data: comments }, { data: attachments }, { data: history }] = await Promise.all([
    supabase.from('comments').select('*, author:author_id(full_name)').eq('task_id', taskId).order('created_at'),
    supabase.from('attachments').select('*').eq('task_id', taskId).order('created_at'),
    supabase.from('activity_history').select('*, actor:actor_id(full_name)').eq('task_id', taskId).order('created_at')
  ]);

  return {
    task: {
      ...task,
      assignee_name: task.assignee?.full_name,
      creator_name: task.creator?.full_name
    },
    comments: comments || [],
    attachments: attachments || [],
    history: history || [],
    error: null
  };
}

export async function updateTaskStatus(taskId, status, extra = {}) {
  return supabase.from('tasks').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', taskId);
}

export async function createTask(task) {
  return supabase.from('tasks').insert(task).select().single();
}

export async function addComment(taskId, authorId, message) {
  return supabase.from('comments').insert({ task_id: taskId, author_id: authorId, message });
}

// Answers a task's Yes/No/Explanation checklist. `response` is 'yes', 'no',
// or 'explanation'; `note` is required for 'explanation' and optional
// otherwise. See migration_005.sql for who's allowed to call this.
export async function submitChecklistResponse(taskId, userId, response, note) {
  return supabase
    .from('tasks')
    .update({
      checklist_response: response,
      checklist_response_note: note || null,
      checklist_response_by: userId,
      checklist_response_at: new Date().toISOString()
    })
    .eq('id', taskId);
}
