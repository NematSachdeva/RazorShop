import { PrivacyPolicyPage } from './components/info/PrivacyPolicyPage';
import { TermsOfServicePage } from './components/info/TermsOfServicePage';
import { ContactSupportPage } from './components/info/ContactSupportPage';
import { ApiStatusPage } from './components/info/ApiStatusPage';
import MerchantDashboard from './components/MerchantDashboard';
import AdminDashboard from './components/AdminDashboard';

export function runNavigationAndPagesTests() {
  console.log('Testing RazorShop Navigation, Info Pages & Dashboard exports...');

  if (typeof PrivacyPolicyPage !== 'function') {
    throw new Error('PrivacyPolicyPage component must be exported as a function');
  }
  if (typeof TermsOfServicePage !== 'function') {
    throw new Error('TermsOfServicePage component must be exported as a function');
  }
  if (typeof ContactSupportPage !== 'function') {
    throw new Error('ContactSupportPage component must be exported as a function');
  }
  if (typeof ApiStatusPage !== 'function') {
    throw new Error('ApiStatusPage component must be exported as a function');
  }
  if (typeof MerchantDashboard !== 'function') {
    throw new Error('MerchantDashboard component must be exported as a function');
  }
  if (typeof AdminDashboard !== 'function') {
    throw new Error('AdminDashboard component must be exported as a function');
  }

  console.log('All RazorShop storefront, merchant, and admin dashboard components verified successfully.');
}
