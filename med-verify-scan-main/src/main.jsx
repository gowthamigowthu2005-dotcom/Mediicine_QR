import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { setupMockServer } from './mock/mockServer.js';

// Activate mock backend fallback for standalone GitHub Pages & offline deployment
setupMockServer();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
