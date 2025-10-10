import { http, createConfig } from 'wagmi'
import {  sepolia, gnosis } from 'wagmi/chains'
import { injected, metaMask, safe, walletConnect } from 'wagmi/connectors'

const projectId  =import.meta.env.VITE_WAGMI_PROJECT_ID ;

export const config = createConfig({
  chains: [ sepolia, gnosis],
  connectors: [
    injected(),
    metaMask(),
    safe(),
    walletConnect({ projectId }),
  ],
  transports: {
   
    [sepolia.id]: http(),
    [gnosis.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}