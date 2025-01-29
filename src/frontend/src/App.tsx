import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, StyledEngineProvider } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { ThirdwebProvider, phantomWallet } from "@thirdweb-dev/react";
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';

const solanaConfig = {
  chainId: 103,
  rpc: ["https://api.devnet.solana.com"],
  nativeCurrency: {
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
  },
  shortName: "sol",
  slug: "solana-devnet",
  testnet: true,
  chain: "Solana",
  name: "Solana Devnet",
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
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#121212',
          color: '#ffffff',
        },
      },
    },
  },
});

function App() {
  return (
    <StyledEngineProvider injectFirst>
      <ThirdwebProvider
        activeChain={solanaConfig}
        clientId="a3e2d3f54b3416c87c25630e9431adce"
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
    </StyledEngineProvider>
  );
}

export default App;
