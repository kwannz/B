import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { ThirdwebProvider, phantomWallet } from "@thirdweb-dev/react";
import AppRoutes from './routes';

const solanaConfig = {
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
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

function App() {
  return (
    <ThirdwebProvider
      activeChain={solanaConfig}
      clientId={import.meta.env.VITE_THIRDWEB_CLIENT_ID}
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
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </ThirdwebProvider>
  );
}

export default App;
