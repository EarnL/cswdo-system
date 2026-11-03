import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen', () => {
  window.history.replaceState({}, '', '/login');
  render(<App />);
  expect(screen.getByRole('heading', { name: /Sign in to CSWDO/i })).toBeInTheDocument();
});
