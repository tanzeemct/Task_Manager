import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, load]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    load();
  }

  return { notifications, unreadCount, markRead };
}
