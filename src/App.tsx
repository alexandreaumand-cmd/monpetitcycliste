import React, { Suspense } from "react";
import "./i18n"; // Initialize i18n
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SeasonProvider } from "./contexts/SeasonContext";
import { LeagueProvider } from "./contexts/LeagueContext";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { LoadingSpinner } from "./components/shared/LoadingSpinner";
import { ScrollToTop } from "./components/shared/ScrollToTop";

// Lazy-loaded pages
const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const InstallPage = React.lazy(() => import("./pages/InstallPage"));
const JoinLeaguePage = React.lazy(() => import("./pages/JoinLeaguePage").then(m => ({ default: m.JoinLeaguePage })));
const InvitePage = React.lazy(() => import("./pages/InvitePage").then(m => ({ default: m.InvitePage })));
const InviteShortPage = React.lazy(() => import("./pages/InviteShortPage").then(m => ({ default: m.InviteShortPage })));
const CompleteProfile = React.lazy(() => import("./pages/CompleteProfile"));
const AboutPage = React.lazy(() => import("./pages/AboutPage"));
const RulesPage = React.lazy(() => import("./pages/RulesPage"));
const HowToPlayPage = React.lazy(() => import("./pages/HowToPlayPage"));
const LegalNoticePage = React.lazy(() => import("./pages/LegalNoticePage"));
const TermsPage = React.lazy(() => import("./pages/TermsPage"));
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ScrollToTop />
            <LeagueProvider>
              <SeasonProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/complete-profile" element={<CompleteProfile />} />
                      <Route path="/install" element={<InstallPage />} />
                      <Route path="/i/:token" element={<InviteShortPage />} />
                      <Route path="/invite" element={<InvitePage />} />
                      <Route path="/join" element={<JoinLeaguePage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/rules" element={<RulesPage />} />
                      <Route path="/how-to-play" element={<HowToPlayPage />} />
                      <Route path="/legal" element={<LegalNoticePage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/privacy" element={<PrivacyPage />} />
                      <Route path="/dashboard/*" element={<Dashboard />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </TooltipProvider>
              </SeasonProvider>
            </LeagueProvider>
          </BrowserRouter>
          {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          )}
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
