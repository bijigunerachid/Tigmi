import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.jsx';
import { AppProviders } from './app/providers.jsx';
import './index.css';
import './lib/i18n.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
