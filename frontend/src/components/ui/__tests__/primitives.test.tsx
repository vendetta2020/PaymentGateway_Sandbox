import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../button';
import { EmptyState } from '../empty-state';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';

describe('UI Primitives', () => {
  describe('Button', () => {
    it('renders button with text and triggers click', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Submit Payment</Button>);
      const button = screen.getByRole('button', { name: /submit payment/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles disabled state properly', () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled Action
        </Button>,
      );
      const button = screen.getByRole('button', { name: /disabled action/i });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('EmptyState', () => {
    it('renders title and description with accessible region role', () => {
      render(
        <EmptyState
          title="No Transactions Found"
          description="There are currently no recorded transactions in this period."
        />,
      );
      expect(screen.getByRole('region', { name: /no transactions found/i })).toBeInTheDocument();
      expect(screen.getByText(/there are currently no recorded transactions/i)).toBeInTheDocument();
    });
  });

  describe('ErrorState', () => {
    it('renders alert role and triggers retry callback', () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="Network Failure"
          message="Could not connect to gateway server."
          onRetry={handleRetry}
        />,
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: /retry request/i });
      fireEvent.click(retryButton);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('LoadingState', () => {
    it('renders with accessible aria-live="polite" and role="status"', () => {
      render(<LoadingState message="Loading ledger..." />);
      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText('Loading ledger...')).toBeInTheDocument();
    });
  });
});
