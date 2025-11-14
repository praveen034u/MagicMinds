import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProgressProvider } from "@/contexts/ProgressContext";
import { Auth0ProviderWrapper } from "@/contexts/Auth0Context";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthPage } from "./pages/Auth/AuthPage";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import ParentSetup from "./pages/ParentSetup";
import ModeSelector from "./pages/ModeSelector";
import GameDashboard from "./pages/GameDashboard";
import StoryDashboard from "./pages/StoryDashboard";
import StoryViewer from "./pages/StoryViewer";
import ProgressRewards from "./pages/ProgressRewards";
import GameRouter from "./pages/GameRouter";
import NotFound from "./pages/NotFound";
import VoicePricingPlans from "./pages/VoicePricingPlans";
import PaymentPage from "./pages/Payment";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Auth0ProviderWrapper>
        <ProgressProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
             {/* Public Landing */}
             <Route path="/welcome" element={<Landing />} />
             
             {/* Auth routes */}
             <Route path="/auth" element={<AuthPage />} />
             
             {/* Protected App routes */}
             <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
             <Route path="/parent-setup" element={<ProtectedRoute><ParentSetup /></ProtectedRoute>} />
             <Route path="/modes" element={<ProtectedRoute><ModeSelector /></ProtectedRoute>} />
             <Route path="/games" element={<ProtectedRoute><GameDashboard /></ProtectedRoute>} />
             <Route path="/stories" element={<ProtectedRoute><StoryDashboard /></ProtectedRoute>} />
             <Route path="/story-viewer" element={<ProtectedRoute><StoryViewer /></ProtectedRoute>} />
             <Route path="/progress" element={<ProtectedRoute><ProgressRewards /></ProtectedRoute>} />
             <Route path="/games/:gameId" element={<ProtectedRoute><GameRouter /></ProtectedRoute>} />
             <Route path="/pricing" element={<ProtectedRoute><VoicePricingPlans /></ProtectedRoute>} />
             <Route path="/payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
             
             {/* Root redirect */}
             <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
             
             {/* 404 fallback */}
             <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ProgressProvider>
      </Auth0ProviderWrapper>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;