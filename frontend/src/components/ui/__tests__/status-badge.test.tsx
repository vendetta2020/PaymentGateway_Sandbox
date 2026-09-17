import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('renders with role="status" and accessible aria-label', () => {
    render(<StatusBadge status="SUCCEEDED" />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Status: Succeeded');
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
  });

  it('renders all required status states correctly', () => {
    const statuses = [
      { status: 'SUCCEEDED', label: 'Succeeded' },
      { status: 'MATCHED', label: 'Matched' },
      { status: 'PENDING', label: 'Pending' },
      { status: 'PROCESSING', label: 'Processing' },
      { status: 'FAILED', label: 'Failed' },
      { status: 'DISCREPANCY', label: 'Discrepancy' },
      { status: 'REFUNDED', label: 'Refunded' },
      { status: 'REVOKED', label: 'Revoked' },
      { status: 'EXPIRED', label: 'Expired' },
      { status: 'SETTLED', label: 'Settled' },
      { status: 'COMPLETED', label: 'Completed' },
      { status: 'RUNNING', label: 'Running' },
    ] as const;

    for (const item of statuses) {
      const { unmount } = render(<StatusBadge status={item.status} />);
      expect(screen.getByText(item.label)).toBeInTheDocument();
      unmount();
    }
  });

  it('does not rely on color alone by rendering text label alongside dot', () => {
    render(<StatusBadge status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('allows custom label override', () => {
    render(<StatusBadge status="FAILED" label="504 Gateway Timeout" />);
    expect(screen.getByText('504 Gateway Timeout')).toBeInTheDocument();
  });
});
