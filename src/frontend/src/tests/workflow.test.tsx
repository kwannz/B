import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AgentSelection from '../pages/AgentSelection';
import StrategyCreation from '../pages/StrategyCreation';
import BotIntegration from '../pages/BotIntegration';
import KeyManagement from '../pages/KeyManagement';
import TradingDashboard from '../pages/TradingDashboard';
import { AuthProvider } from '../contexts/AuthContext';
import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('Trading Bot Workflow Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Agent Selection Step', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <AgentSelection />
        </AuthProvider>
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Select Your Agent/i)).toBeInTheDocument();
    const tradingAgentButton = screen.getByText(/Trading Agent/i);
    await userEvent.click(tradingAgentButton);
  });

  it('Strategy Creation Step', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <StrategyCreation />
        </AuthProvider>
      </BrowserRouter>
    );

    const nameInput = screen.getByLabelText(/Strategy Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);
    const promotionInput = screen.getByLabelText(/Promotion Words/i);

    await userEvent.type(nameInput, 'Test Strategy');
    await userEvent.type(descriptionInput, 'Test Description');
    await userEvent.type(promotionInput, 'test, keywords');

    const createButton = screen.getByRole('button', { name: /Create Strategy/i });
    await userEvent.click(createButton);

    expect(JSON.parse(localStorage.getItem('strategyData') || '{}')).toEqual({
      name: 'Test Strategy',
      description: 'Test Description',
      promotionWords: 'test, keywords'
    });
  });

  it('Bot Integration Step', async () => {
    localStorage.setItem('strategyData', JSON.stringify({
      name: 'Test Strategy',
      description: 'Test Description',
      promotionWords: 'test, keywords'
    }));

    render(
      <BrowserRouter>
        <AuthProvider>
          <BotIntegration />
        </AuthProvider>
      </BrowserRouter>
    );

    await screen.findByText(/Bot Initialized/i);
    expect(screen.getByText(/Bot ID: test-bot-id/i)).toBeInTheDocument();
  });

  it('Wallet Creation Step', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <KeyManagement />
        </AuthProvider>
      </BrowserRouter>
    );

    await screen.findByText(/Generated Wallet/i);
    expect(screen.getByText(/test-wallet-address/)).toBeInTheDocument();
    expect(screen.getByText(/test-private-key/)).toBeInTheDocument();
  });

  it('Status Display Step', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TradingDashboard />
        </AuthProvider>
      </BrowserRouter>
    );

    await screen.findByText(/Trading Dashboard/i);
    expect(screen.getByText(/Trading History/i)).toBeInTheDocument();

    // Verify trade details are displayed
    const trade = {
      type: 'BUY',
      status: 'COMPLETED'
    };
    expect(screen.getByText(new RegExp(trade.type, 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(trade.status, 'i'))).toBeInTheDocument();
  });
});
