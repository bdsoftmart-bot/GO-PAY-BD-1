import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Recover cleanly if a browser holds a stale chunk URL after a new Vercel/host deployment
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(<App />);
