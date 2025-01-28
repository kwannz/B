import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
