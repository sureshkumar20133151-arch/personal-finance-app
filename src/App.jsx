
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Setup from './pages/Setup';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Landing from './pages/Landing';
import Account from './pages/Account';
import Loans from './pages/Loans';
import Legal from './pages/Legal';


import { FinanceProvider } from './context/FinanceContext';

import Budget from './pages/Budget';

const App = () => {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

  return (
    <Router>
      <AuthProvider>
        <FinanceProvider>
          <Routes>
            <Route path="/" element={isNative ? <Navigate to="/dashboard" replace /> : <Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Legal Pages for Razorpay Verification */}
            <Route path="/privacy" element={<Legal />} />
            <Route path="/terms" element={<Legal />} />
            <Route path="/refund" element={<Legal />} />
            <Route path="/contact" element={<Legal />} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budget" element={<Budget />} />

              <Route path="/loans" element={<Loans />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/account" element={<Account />} />
            </Route>
          </Routes>
        </FinanceProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
