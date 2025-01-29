import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { ThirdwebProvider, metamaskWallet, phantomWallet } from "@thirdweb-dev/react";
import { Chain } from "@thirdweb-dev/chains";

const Solana: Chain = {
  name: "Solana",
  chain: "SOL",
  rpc: ["https://api.devnet.solana.com"],
  nativeCurrency: {
    name: "SOL",
    symbol: "SOL",
    decimals: 9,
  },
  shortName: "sol",
  chainId: 103,
  testnet: true,
  slug: "solana",
};
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes/index';
import './env';

const solanaConfig = {
  ...Solana,
  network: "devnet" as const,
  rpc: ["https://api.devnet.solana.com"],
  chainId: 103,
  testnet: true,
  slug: "solana-devnet",
} as const;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const App: React.FC = () => {
  return (
    <ThirdwebProvider
      activeChain={solanaConfig}
      clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID ?? ''}
      supportedWallets={[metamaskWallet(), phantomWallet()]}
      autoConnect={true}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ThirdwebProvider>
  );
};

export default App;
