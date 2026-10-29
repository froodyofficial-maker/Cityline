export function canNotify() {
  return typeof Notification !== 'undefined';
}

export async function requestNotifyPermission() {
  if (!canNotify()) return 'denied' as NotificationPermission;
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export function desktopNotify(title: string, body: string, icon: string | null, onClick?: () => void) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body: body.slice(0, 180), icon: icon || './favicon.svg', silent: true, tag: title });
    n.onclick = () => { window.focus(); onClick?.(); n.close(); };
    setTimeout(() => n.close(), 7000);
  } catch { /* some browsers only allow notifications from a service worker */ }
}

let baseTitle = 'Cityline';
export function setTitleBadge(count: number, title?: string) {
  if (title) baseTitle = title;
  document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${baseTitle}` : baseTitle;
}
