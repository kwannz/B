import React from 'react';
import Header from './Header';
import TokenAllocation from './TokenAllocation';
import Features from './Features';
import Roadmap from './Roadmap';
import Footer from './Footer';
import './styles.css';

function App() {
  return (
    <div className="app">
      <Header />
      <TokenAllocation />
      <Features />
      <Roadmap />
      <Footer />
    </div>
  );
}

export default App;
