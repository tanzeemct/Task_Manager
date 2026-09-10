import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export function taskUrl(taskId) {
  return `${window.location.origin}/task/${taskId}`;
}

export function whatsAppShareUrl(task) {
  const lines = [`Task: ${task.title}`];
  if (task.deadline) {
    lines.push(`Due: ${new Date(task.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`);
  }
  lines.push(taskUrl(task.id));
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/?text=${text}`;
}

// Opens a URL through the system browser/WhatsApp app. On web this is a
// normal new-tab open; inside the Capacitor-wrapped Android app a plain
// `window.open` would try (and fail) to load wa.me inside the in-app
// WebView, so native builds route through the Browser plugin instead,
// which hands off to the OS the same way a real browser tab would.
export async function openExternal(url) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export async function shareTaskToWhatsApp(task) {
  await openExternal(whatsAppShareUrl(task));
}
