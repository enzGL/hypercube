import './estado/tema'; // aplica o tema salvo antes do primeiro render
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/700.css';
import './estilos.css';
import { App } from './App';
import { restaurarConfig } from './estado/loja';
import { talvezTesteDoLider } from './estado/fumacaLider';

restaurarConfig();
void talvezTesteDoLider();

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
