import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './components/App.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <UpdatePrompt />
    </HashRouter>
  </React.StrictMode>
);
