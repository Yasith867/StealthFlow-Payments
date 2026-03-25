import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import PageWrapper from "@/components/PageWrapper";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Create from "@/pages/Create";
import Execute from "@/pages/Execute";
import Receipts from "@/pages/Receipts";
import NotFound from "@/pages/not-found";
import type { WalletInfo } from "@/lib/wallet";

const queryClient = new QueryClient();

function AnimatedRoutes({ wallet, setWallet }: { wallet: WalletInfo | null; setWallet: (w: WalletInfo | null) => void }) {
  const [location] = useLocation();
  return (
    <Switch key={location}>
      <Route path="/">
        <PageWrapper><Landing /></PageWrapper>
      </Route>
      <Route path="/dashboard">
        <PageWrapper><Dashboard wallet={wallet} onConnect={setWallet} /></PageWrapper>
      </Route>
      <Route path="/create">
        <PageWrapper><Create wallet={wallet} onConnect={setWallet} /></PageWrapper>
      </Route>
      <Route path="/execute">
        <PageWrapper><Execute wallet={wallet} onConnect={setWallet} /></PageWrapper>
      </Route>
      <Route path="/receipts">
        <PageWrapper><Receipts wallet={wallet} onConnect={setWallet} /></PageWrapper>
      </Route>
      <Route>
        <PageWrapper><NotFound /></PageWrapper>
      </Route>
    </Switch>
  );
}

function AppContent() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  useEffect(() => {
    const eth = (window as Window & { ethereum?: { on?: (event: string, cb: (v: unknown) => void) => void; removeListener?: (event: string, cb: (v: unknown) => void) => void } }).ethereum;
    if (!eth?.on) return;

    const onChainChanged = (chainIdHex: unknown) => {
      const newChainId = parseInt(chainIdHex as string, 16);
      setWallet((prev) => prev ? { ...prev, chainId: newChainId } : null);
    };

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (!list || list.length === 0) {
        setWallet(null);
      } else {
        setWallet((prev) => prev ? { ...prev, address: list[0] } : null);
      }
    };

    eth.on("chainChanged", onChainChanged);
    eth.on("accountsChanged", onAccountsChanged);
    return () => {
      eth.removeListener?.("chainChanged", onChainChanged);
      eth.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#070710] text-gray-100">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-700/6 blur-[160px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-cyan-700/5 blur-[120px] rounded-full" />
      </div>

      <Navbar wallet={wallet} onConnect={setWallet} onDisconnect={() => setWallet(null)} />

      <main className="relative">
        <AnimatedRoutes wallet={wallet} setWallet={setWallet} />
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/4 py-6 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-700">
          <span>StealthFlow: Private Condition Wallet</span>
          <span>Powered by Fhenix FHE · Amounts are always encrypted</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
