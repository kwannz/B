import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import '@thirdweb-dev/react/styles.css';
import { ThirdwebProvider, phantomWallet } from "@thirdweb-dev/react";
import { Chain } from "@thirdweb-dev/chains";
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes/index';

console.log('App rendering, checking environment:', {
  VITE_THIRDWEB_CLIENT_ID: import.meta.env.VITE_THIRDWEB_CLIENT_ID
});

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

const solanaConfig = {
  ...Solana,
  network: "devnet" as const,
  rpc: ["https://api.devnet.solana.com"],
  chainId: 103,
  testnet: true,
  slug: "solana-devnet",
  icon: {
    url: "https://solana.com/favicon.ico",
    width: 32,
    height: 32,
    format: "png"
  }
} as const;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff4081',
      dark: '#c51162',
      contrastText: '#ffffff',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
      contrastText: '#ffffff',
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(30, 30, 30, 0.9)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        standardError: {
          backgroundColor: 'rgba(211, 47, 47, 0.1)',
        },
        standardInfo: {
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: '#ffffff',
        },
      },
    },
  },
});

const App: React.FC = () => {
  const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;
  console.log('ThirdWeb Client ID:', clientId);
  return (
    <ThirdwebProvider
      activeChain={solanaConfig}
      clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID ?? ''}
      supportedWallets={[phantomWallet()]}
      autoConnect={false}
      dAppMeta={{
        name: "Trading Bot",
        description: "Solana Trading Bot Platform",
        logoUrl: "https://solana.com/favicon.ico",
        url: window.location.origin,
        isDarkMode: true,
      }}
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
