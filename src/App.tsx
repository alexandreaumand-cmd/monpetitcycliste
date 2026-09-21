import React, { Suspense } from "react";
import "./i18n"; // Initialize i18n
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SeasonProvider } from "./contexts/SeasonContext";
import { LeagueProvider } from "./contexts/LeagueContext";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { LoadingSpinner } from "./components/shared/LoadingSpinner";
import { ScrollToTop } from "./components/shared/ScrollToTop";
import { useLanguageSync } from "./hooks/useLanguageSync";
import { lazyWithRetry } from "./lib/lazyWithRetry";

// Lazy-loaded pages
const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const InstallPage = lazyWithRetry(() => import("./pages/InstallPage"));
const JoinLeaguePage = lazyWithRetry(() => import("./pages/JoinLeaguePage").then(m => ({ default: m.JoinLeaguePage })));
const InvitePage = lazyWithRetry(() => import("./pages/InvitePage").then(m => ({ default: m.InvitePage })));
const InviteShortPage = lazyWithRetry(() => import("./pages/InviteShortPage").then(m => ({ default: m.InviteShortPage })));
const CompleteProfile = lazyWithRetry(() => import("./pages/CompleteProfile"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const AboutPage = lazyWithRetry(() => import("./pages/AboutPage"));
const RulesPage = lazyWithRetry(() => import("./pages/RulesPage"));
const HowToPlayPage = lazyWithRetry(() => import("./pages/HowToPlayPage"));
const LegalNoticePage = lazyWithRetry(() => import("./pages/LegalNoticePage"));
const TermsPage = lazyWithRetry(() => import("./pages/TermsPage"));
const PrivacyPage = lazyWithRetry(() => import("./pages/PrivacyPage"));
const TeamPage = lazyWithRetry(() => import("./pages/TeamPage"));
const ContactPage = lazyWithRetry(() => import("./pages/ContactPage"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));

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
  useLanguageSync();

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
                      <Route path="/reset-password" element={<ResetPassword />} />
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
                      <Route path="/team" element={<TeamPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="/dashboard/*" element={<Dashboard />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </TooltipProvider>
              </SeasonProvider>
            </LeagueProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
