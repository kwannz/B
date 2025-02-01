import React from 'react';

function TokenAllocation() {
  return (
    <section className="token-allocation">
      <h2>TOKEN SALE ALLOCATION</h2>
      <div className="chart-container">
        <div className="chart">{/* Placeholder for chart */}</div>
        <div className="allocation-data">
          <p>70% Private Sale</p>
          <p>15% Public Sale</p>
          <p>10% Exchange</p>
          <p>5% Team</p>
        </div>
      </div>
      <button>Buy Tokens</button>
    </section>
  );
}

export default TokenAllocation;
