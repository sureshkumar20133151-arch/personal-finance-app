
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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


import { FinanceProvider } from './context/FinanceContext';

import Budget from './pages/Budget';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <FinanceProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

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
