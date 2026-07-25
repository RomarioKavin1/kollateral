import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Base Sepolia only: this is the FADE/FOLLOW demo chain (Task 10). Same
// Uniswap Trading API endpoint serves testnet — the prize accepts testnet
// tx IDs, so we never touch mainnet funds here.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
