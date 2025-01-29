import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Chain } from "@thirdweb-dev/chains";

const solanaChain: Chain = {
  name: "Solana Devnet",
  chain: "Solana",
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
};

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID || '';
if (!clientId) {
  throw new Error('VITE_THIRDWEB_CLIENT_ID is required');
}

export const client = new ThirdwebSDK(solanaChain, {
  clientId,
  secretKey: import.meta.env.VITE_THIRDWEB_SECRET_KEY,
});
