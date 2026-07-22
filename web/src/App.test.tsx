import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the sign-up screen at the root path', () => {
    render(<App />);
    expect(screen.getByText('Practice out loud.')).toBeInTheDocument();
  });
});
