import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { SOLANA_DEVNET_RPC_URL } from './services/solanaClient';
import './index.css';

const RootComponent: React.FC = () => {
  const endpoint = useMemo(() => SOLANA_DEVNET_RPC_URL, []);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);

