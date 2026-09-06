'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { LayoutDashboard, Download, Plus } from 'lucide-react';

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        category="SANDBOX ENVIRONMENT • v2.18-sim"
        title="Overview"
        description="Monitor payments, refunds, and settlement activity in the simulator sandbox."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" />
              <span>Create mock payment</span>
            </Button>
          </>
        }
      />

      {/* Phase 11 Foundation Verification Panel */}
      <Card variant="subtle" className="border-border">
        <CardHeader>
          <CardTitle>Phase 11 — Frontend Foundation & Design System</CardTitle>
          <CardDescription>
            Application shell, typography hierarchy, semantic status tokens, and UI primitives verified against Stitch V2.5 specifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-neutral-600 leading-relaxed space-y-2">
            <p>
              • <strong>Backend Authority:</strong> All financial calculations, state transitions, and records remain 100% authoritative on the NestJS backend.
            </p>
            <p>
              • <strong>Functional Brutalism:</strong> Restrained border radius, crisp 1px borders, high-contrast typography, and monospaced technical identifiers.
            </p>
            <p>
              • <strong>Phase Boundary:</strong> Business logic pages (live payment lists, settlement reconciliation runs, refund flows) are scheduled for Phase 12+.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Semantic Status Badge Palette Verification */}
      <div className="space-y-3">
        <SectionHeader
          title="Status Token Semantics"
          description="Consistent multi-state indicators with visible text labels and accessible color contrast."
        />
        <div className="flex flex-wrap gap-2.5 p-4 border border-border rounded-sm bg-white">
          <StatusBadge status="SUCCEEDED" />
          <StatusBadge status="MATCHED" />
          <StatusBadge status="PENDING" />
          <StatusBadge status="PROCESSING" />
          <StatusBadge status="FAILED" />
          <StatusBadge status="DISCREPANCY" />
          <StatusBadge status="REFUNDED" />
          <StatusBadge status="REVOKED" />
          <StatusBadge status="EXPIRED" />
        </div>
      </div>

      {/* Table Primitives Verification */}
      <div className="space-y-3">
        <SectionHeader
          title="Table Primitives Foundation"
          description="Semantic table structure with monospace technical identifiers and tabular numbers."
        />
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Reference</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead align="right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell isMonospace>pay_01J8K9X2B0MN3Q</TableCell>
                <TableCell isMonospace>ORDER-2026-00192</TableCell>
                <TableCell align="right" isMonospace className="font-semibold">
                  Rp 1.500.000
                </TableCell>
                <TableCell>Virtual Account (BCA)</TableCell>
                <TableCell>
                  <StatusBadge status="SUCCEEDED" />
                </TableCell>
                <TableCell align="right" isMonospace className="text-neutral-500">
                  Today, 14:21
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell isMonospace>pay_01J8K8W1F1PP4R</TableCell>
                <TableCell isMonospace>ORDER-2026-00191</TableCell>
                <TableCell align="right" isMonospace className="font-semibold">
                  Rp 250.000
                </TableCell>
                <TableCell>QRIS</TableCell>
                <TableCell>
                  <StatusBadge status="SUCCEEDED" />
                </TableCell>
                <TableCell align="right" isMonospace className="text-neutral-500">
                  Today, 14:18
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell isMonospace>pay_01J8K7V4C3LK9S</TableCell>
                <TableCell isMonospace>ORDER-2026-00190</TableCell>
                <TableCell align="right" isMonospace className="font-semibold">
                  Rp 75.000
                </TableCell>
                <TableCell>E-Wallet (OVO)</TableCell>
                <TableCell>
                  <StatusBadge status="PENDING" />
                </TableCell>
                <TableCell align="right" isMonospace className="text-neutral-500">
                  Today, 14:12
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell isMonospace>pay_01J8K6T1A8NM2T</TableCell>
                <TableCell isMonospace>ORDER-2026-00189</TableCell>
                <TableCell align="right" isMonospace className="font-semibold">
                  Rp 3.200.000
                </TableCell>
                <TableCell>Card (Visa •••• 4242)</TableCell>
                <TableCell>
                  <StatusBadge status="FAILED" />
                </TableCell>
                <TableCell align="right" isMonospace className="text-neutral-500">
                  Today, 14:05
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Presentation State Primitives Verification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="default">
          <CardHeader>
            <CardTitle>Loading Primitive</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadingState message="Fetching ledger records..." size="sm" />
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Error Primitive</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorState
              title="Connection Timeout"
              message="Failed to contact provider simulator."
              onRetry={() => {}}
            />
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Empty Primitive</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<LayoutDashboard className="w-6 h-6" />}
              title="No batches queued"
              description="Settlement run cycle finalized."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
