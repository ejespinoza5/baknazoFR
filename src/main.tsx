import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import { LazyMotion, MotionConfig } from 'motion/react';

// Las animaciones se descargan aparte y no retrasan la primera pintura.
const funcionesDeMovimiento = () => import('./lib/motionFunciones').then((m) => m.default);
import App from './App';
import './index.css';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Con "reducir movimiento" activado en el sistema, las animaciones dejan
        los desplazamientos y quedan solo los fundidos. */}
    <MotionConfig reducedMotion="user">
      <LazyMotion features={funcionesDeMovimiento} strict>
        <GoogleOAuthProvider clientId={clientId}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </GoogleOAuthProvider>
      </LazyMotion>
    </MotionConfig>
  </React.StrictMode>
);
