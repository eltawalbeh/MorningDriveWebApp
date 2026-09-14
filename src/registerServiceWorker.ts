const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  if (window.location.protocol !== 'https:' && !isLocalhost) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      void registration.update()
    } catch {
      // Morning Drive must remain fully usable even when service workers are unavailable.
    }
  })
}
