import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Lazy-loaded pages — only downloaded when navigated to
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Budget = lazy(() => import('./pages/Budget'));
const Loans = lazy(() => import('./pages/Loans'));
const Setup = lazy(() => import('./pages/Setup'));
const Account = lazy(() => import('./pages/Account'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const CompleteProfile = lazy(() => import('./pages/auth/CompleteProfile'));
const Landing = lazy(() => import('./pages/Landing'));
const Legal = lazy(() => import('./pages/Legal'));

import { FinanceProvider } from './context/FinanceContext';
const SmsSetupGuide = lazy(() => import('./context/SmsSetupGuide'));

// Branded loading spinner shown while lazy chunks are downloading
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-muted-foreground font-medium">Loading...</p>
    </div>
  </div>
);

const APP_BUILD_ID = '1.0.7';

const App = () => {
  const [showSmsSetup, setShowSmsSetup] = useState(false);

  useEffect(() => {
    try {
      const currentBuild = localStorage.getItem('app_build_id');
      if (currentBuild && currentBuild !== APP_BUILD_ID) {
        console.log(`[App] Build mismatch detected (${currentBuild} -> ${APP_BUILD_ID}). Reloading...`);
        localStorage.setItem('app_build_id', APP_BUILD_ID);
        window.location.reload(true);
      } else {
        localStorage.setItem('app_build_id', APP_BUILD_ID);
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    const handler = () => {
      console.log("[App] sms_needs_setup event received, showing guide modal");
      setShowSmsSetup(true);
    };
    window.addEventListener("sms_needs_setup", handler);
    return () => window.removeEventListener("sms_needs_setup", handler);
  }, []);

  return (
    <Router>
      <AuthProvider>
        <FinanceProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/welcome" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/complete-profile" element={
                <ProtectedRoute requireProfile={false}><CompleteProfile /></ProtectedRoute>
              } />
              
              {/* Legal Pages for Razorpay Verification */}
              <Route path="/privacy" element={<Legal />} />
              <Route path="/terms" element={<Legal />} />
              <Route path="/refund" element={<Legal />} />
              <Route path="/contact" element={<Legal />} />
              <Route path="/shipping" element={<Legal />} />

              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/account" element={<Account />} />
              </Route>
            </Routes>
            {showSmsSetup && (
              <SmsSetupGuide
                isOpen={showSmsSetup}
                onClose={() => setShowSmsSetup(false)}
                onDone={() => {
                  setShowSmsSetup(false);
                  window.dispatchEvent(new CustomEvent("sms_rescan"));
                }}
              />
            )}
          </Suspense>
        </FinanceProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
