import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="font-family: sans-serif; padding: 20px; color: #5A5A40;">
        <h2 style="font-size: 18px;">竹林启动失败 (Runtime Error)</h2>
        <p style="font-size: 12px; opacity: 0.8;">${message}</p>
        <pre style="font-size: 10px; background: #eee; padding: 10px; margin-top: 10px; overflow: auto;">${error?.stack || ''}</pre>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #5A5A40; color: white; border: none; cursor: pointer;">重试</button>
      </div>
    `;
  }
  return false;
};

console.log('App is starting...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
