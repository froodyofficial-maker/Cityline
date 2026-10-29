import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/chat.css';
import './styles/panels.css';
import './styles/settings.css';
import './styles/voice.css';
import './styles/pages.css';
import './styles/effects.css';
import 'highlight.js/styles/github-dark.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
