
import './css/ui.css';
import './css/main.css';
import './css/color.css';
import './js/main';

if (
  typeof window !== 'undefined' &&
  window.name !== 'site_auth_target_frame' &&
  window.name !== 'ptt_auth_target_frame' &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.debug('ServiceWorker registration failed:', err);
    });
  });
}
