// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css'; 


import { Provider } from 'react-redux'; 
import { store } from './store/store'; 

// --- FIX: Suppress benign ResizeObserver errors ---
// This prevents the "ResizeObserver loop completed..." error from crashing the dev overlay.
// It happens often with Recharts and TradingView widgets and is safe to ignore in this context.
const originalError = console.error;
console.error = (...args) => {
  if (/ResizeObserver loop completed with undelivered notifications/.test(args[0])) {
    return;
  }
  originalError.call(console, ...args);
};

window.addEventListener('error', (e) => {
    if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
        if (resizeObserverErr) {
            resizeObserverErr.setAttribute('style', 'display: none');
        }
        e.stopImmediatePropagation();
    }
});
// ---------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);