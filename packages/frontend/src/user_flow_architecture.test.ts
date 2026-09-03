import SignInModal from './components/SignInModal';
import App from './App';
import { authService } from './services/authService';
import MerchantDashboard from './components/MerchantDashboard';
import AdminDashboard from './components/AdminDashboard';
import Footer from './components/Footer';

export function runUserFlowArchitectureTests() {
  console.log('Testing RazorShop User Flow Architecture & Component Contracts...');

  // 1. Verify SignInModal component contract
  if (typeof SignInModal !== 'function') {
    throw new Error('SignInModal component must be exported as a React component function');
  }

  // 2. Verify App component contract
  if (typeof App !== 'function') {
    throw new Error('App component must be exported as a React component function');
  }

  // 3. Verify MerchantDashboard & AdminDashboard component contracts
  if (typeof MerchantDashboard !== 'function') {
    throw new Error('MerchantDashboard component must be exported as a React component function');
  }
  if (typeof AdminDashboard !== 'function') {
    throw new Error('AdminDashboard component must be exported as a React component function');
  }

  // 4. Verify Footer component contract
  if (typeof Footer !== 'function') {
    throw new Error('Footer component must be exported as a React component function');
  }

  // 5. Verify authService methods for state transitions
  if (typeof authService.logout !== 'function') {
    throw new Error('authService.logout must be a function');
  }
  if (typeof authService.isAuthenticated !== 'function') {
    throw new Error('authService.isAuthenticated must be a function');
  }
  if (typeof authService.login !== 'function') {
    throw new Error('authService.login must be a function');
  }
  if (typeof authService.register !== 'function') {
    throw new Error('authService.register must be a function');
  }

  console.log('✅ All RazorShop user flow architecture contracts verified successfully.');
}

runUserFlowArchitectureTests();
