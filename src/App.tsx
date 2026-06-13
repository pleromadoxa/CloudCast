import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DisplayFeedProvider } from './context/DisplayFeedContext';
import { PrismFeedProvider } from './context/PrismFeedContext';
import { ProgramPresetProvider } from './context/ProgramPresetContext';
import { NetworkProvider } from './context/NetworkContext';
import { ProductionProvider } from './context/ProductionContext';
import { MarketingLayout } from './components/marketing/MarketingLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProductGate } from './components/auth/ProductGate';
import { ProductionHost } from './components/production/ProductionHost';
import { OnAirBanner } from './components/production/OnAirBanner';
import { LandingPage } from './pages/LandingPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductGuidePage } from './pages/ProductGuidePage';
import { ProductLandingPage } from './pages/ProductLandingPage';
import { SolutionsPage } from './pages/SolutionsPage';
import { ProductsHubPage } from './pages/ProductsHubPage';
import { AuthPage } from './pages/AuthPage';
import { PricingPage } from './pages/PricingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AudioMixerDashboardPage } from './pages/AudioMixerDashboardPage';
import { ReplayDashboardPage } from './pages/ReplayDashboardPage';
import { DisplayDashboardPage } from './pages/DisplayDashboardPage';
import { DisplayCongregationPage } from './pages/DisplayCongregationPage';
import { MixerOutputPage } from './pages/MixerOutputPage';
import { SymphonyDashboardPage } from './pages/SymphonyDashboardPage';
import { PrismDashboardPage } from './pages/PrismDashboardPage';
import { PrismEyePage } from './pages/PrismEyePage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { AdminRoute } from './components/auth/AdminRoute';
import { SupabaseHeartbeat } from './components/system/SupabaseHeartbeat';
import { AcceptableUsePage } from './pages/legal/AcceptableUsePage';
import { CookiesPage } from './pages/legal/CookiesPage';
import { DpaPage } from './pages/legal/DpaPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { RefundsPage } from './pages/legal/RefundsPage';
import { SecurityPage } from './pages/legal/SecurityPage';
import { SlaPage } from './pages/legal/SlaPage';
import { SubprocessorsPage } from './pages/legal/SubprocessorsPage';
import { TermsPage } from './pages/legal/TermsPage';
import { RouteSEO } from './components/seo/RouteSEO';

export default function App() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <DisplayFeedProvider>
        <PrismFeedProvider>
        <ProgramPresetProvider>
        <ProductionProvider>
          <SupabaseHeartbeat />
          <BrowserRouter>
          <RouteSEO />
          <ProductionHost />
          <OnAirBanner />
          <Routes>
            <Route element={<MarketingLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="products/guide" element={<ProductGuidePage />} />
              <Route path="products/:slug" element={<ProductLandingPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="for/:slug" element={<SolutionsPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route
                path="hub"
                element={
                  <ProtectedRoute>
                    <ProductsHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                }
              />
              <Route path="legal/terms" element={<TermsPage />} />
              <Route path="legal/privacy" element={<PrivacyPage />} />
              <Route path="legal/cookies" element={<CookiesPage />} />
              <Route path="legal/acceptable-use" element={<AcceptableUsePage />} />
              <Route path="legal/security" element={<SecurityPage />} />
              <Route path="legal/sla" element={<SlaPage />} />
              <Route path="legal/refunds" element={<RefundsPage />} />
              <Route path="legal/dpa" element={<DpaPage />} />
              <Route path="legal/subprocessors" element={<SubprocessorsPage />} />
            </Route>
            <Route path="login" element={<AuthPage />} />
            <Route path="display/view" element={<DisplayCongregationPage />} />
            <Route path="dashboard/output" element={<MixerOutputPage />} />
            <Route path="prism/eye" element={<PrismEyePage />} />
            <Route
              path="audio"
              element={
                <ProtectedRoute>
                  <ProductGate product="audio_mixer">
                    <AudioMixerDashboardPage />
                  </ProductGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="replay"
              element={
                <ProtectedRoute>
                  <ProductGate product="instant_replay">
                    <ReplayDashboardPage />
                  </ProductGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="display"
              element={
                <ProtectedRoute>
                  <ProductGate product="regal_display">
                    <DisplayDashboardPage />
                  </ProductGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="symphony"
              element={
                <ProtectedRoute>
                  <ProductGate product="symphony_studio">
                    <SymphonyDashboardPage />
                  </ProductGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="prism"
              element={
                <ProtectedRoute>
                  <ProductGate product="regal_prism">
                    <PrismDashboardPage />
                  </ProductGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <ProductGate product="video_mixer">
                    <DashboardPage />
                  </ProductGate>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </ProductionProvider>
        </ProgramPresetProvider>
        </PrismFeedProvider>
        </DisplayFeedProvider>
      </AuthProvider>
    </NetworkProvider>
  );
}
