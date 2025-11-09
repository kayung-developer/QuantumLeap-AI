// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css'; // Your global styles

import { Provider } from 'react-redux'; // <-- 1. Import the Provider
import { store } from './store/store'; // <-- 2. Import your store

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* The ONE AND ONLY BrowserRouter for the entire application */}
    <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </Provider>
  </React.StrictMode>
);