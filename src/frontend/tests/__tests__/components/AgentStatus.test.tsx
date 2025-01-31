import React from 'react'
import { render, screen } from '../../utils/test-utils'
import AgentStatus from '@/app/components/AgentStatus'

describe('AgentStatus', () => {
  it('renders agent status header', () => {
    render(<AgentStatus />, { authenticated: true })
    expect(screen.getByText(/Trading Agent Status/i)).toBeInTheDocument()
  })

  it('shows agent details', () => {
    render(<AgentStatus />, { authenticated: true })
    expect(screen.getByText(/Market Data Analyst/i)).toBeInTheDocument()
    expect(screen.getByText(/Valuation Agent/i)).toBeInTheDocument()
    const activeChips = screen.getAllByText(/active/i, { selector: '.MuiChip-label' })
    expect(activeChips).toHaveLength(2)
    expect(screen.getByText(/Collects and preprocesses market data/i)).toBeInTheDocument()
    expect(screen.getByText(/Calculates token intrinsic value/i)).toBeInTheDocument()
  })

  it('displays agent descriptions', () => {
    render(<AgentStatus />, { authenticated: true })
    expect(screen.getByText(/Collects and preprocesses market data/i)).toBeInTheDocument()
    expect(screen.getByText(/Calculates token intrinsic value/i)).toBeInTheDocument()
  })

  it('shows agent status chips', () => {
    render(<AgentStatus />, { authenticated: true })
    const activeChips = screen.getAllByText(/active/i, { selector: '.MuiChip-label' })
    expect(activeChips).toHaveLength(2)
    expect(screen.getByText(/Market Data Analyst/i)).toBeInTheDocument()
    expect(screen.getByText(/Valuation Agent/i)).toBeInTheDocument()
  })
})
