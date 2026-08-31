import { api } from './api'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export async function getPushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function subscribeToPush(token) {
  if (!pushSupported()) throw new Error('Push notifications are not supported in this browser')

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission-denied')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  await api.post('/push-subscribe', sub.toJSON(), token)
  return sub
}

export async function unsubscribeFromPush(token) {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  try {
    await api.post('/push-unsubscribe', { endpoint }, token)
  } catch {
    // subscription is gone locally either way
  }
}
