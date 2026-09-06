---
name: financial-dashboard-ux
description: "Govern UX and presentation standards for payment gateways: currency formatting (Rp 125.000), transaction details, status mapping, sensitive data masking, non-calculation invariant, and merchant isolation."
---

# Skill: Financial Dashboard UX

## Purpose
Govern the user experience, interaction models, domain representation, and data display rules for the Payment Gateway Merchant Dashboard. This skill ensures that financial transactions, reconciliation discrepancies, settlements, webhooks, and credentials are presented accurately, securely, and unambiguously.

---

## Domain Representation Requirements

The frontend must accurately and cleanly represent all payment gateway core domains:

1. **Payments**:
   - Unique Payment ID (UUID), Order ID (`orderId`), Amount, Currency, Payment Method (`QRIS`, `VIRTUAL_ACCOUNT`, `EWALLET`, `CARD`), Provider Reference, Status (`PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `EXPIRED`), Timestamps.
2. **Refunds**:
   - Refund ID, Payment Reference, Original Amount, Refunded Amount, Reason, Status (`PENDING`, `SUCCESS`, `FAILED`), Provider Reference.
   - Clear display of remaining refundable balance for partially refunded transactions.
3. **Webhooks**:
   - Configured Webhook URL, Secret Key (masked), Event Types subscribed.
   - Delivery Log: Event ID, Event Type, Payload preview, HTTP Response Code, Attempts, Next Retry time, Status (`SUCCESS`, `FAILED`).
4. **Settlements**:
   - Settlement Reference (`stl_*`), Period Start & End, Currency, Gross Amount, Refund Deduction, Net Amount, Status (`PENDING`, `PROCESSING`, `SETTLED`, `FAILED`).
   - Immutability indicator: Clear visual lock indicator once status is `SETTLED`.
5. **Reconciliation**:
   - Reconciliation Run ID, Period, Status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), Matched Count, Discrepancy Count.
   - Discrepancy Breakdown Table: Type (`MATCHED`, `MISSING_IN_PROVIDER`, `MISSING_IN_INTERNAL`, `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `STATUS_MISMATCH`, `DUPLICATE_PROVIDER_REFERENCE`), Internal vs. Provider values comparison.
6. **API Credentials**:
   - Environment mode indicator (`Test` vs. `Live`), Prefix display (`sk_test_...`, `pk_test_...`), Masked secret keys, Revocation action with explicit confirmation modal.

---

## Financial Formatting Rules

### 1. Currency Presentation
All financial figures must be formatted with locale-aware currency symbols and thousand separators. Never display raw unformatted integers or unrounded floating numbers.

- **IDR (Indonesian Rupiah)**:
  - Correct: `Rp 125.000` / `Rp 1.500.000` / `-Rp 100.000`
  - Avoid: `125000`, `125,000.00 IDR`, `Rp125000`
- **USD (US Dollar)**:
  - Correct: `$125.00` / `$1,500.50`
  - Avoid: `125`, `125.0 USD`
- **Negative Balances (Cross-Period Debt)**:
  - Must be clearly formatted and emphasized (e.g., `-Rp 100.000` with crimson accent) to indicate merchant debt resulting from refunds exceeding gross sales in a settlement period.

### 2. Numerical Legibility
- Always use monospaced numerals (`font-mono tabular-nums`) for currency amounts, exchange rates, and transaction counts in tables so that decimal points and digits align vertically.

---

## Authoritative Backend Invariant (Strict Non-Calculation Rule)

> **CRITICAL RULE**: The frontend must NEVER calculate authoritative financial values independently.

- **The Backend is the Single Source of Truth**:
  - Payment statuses, remaining refundable balance, gross amount, net settlement payouts, and reconciliation discrepancy totals are calculated and persisted strictly by the backend PostgreSQL database.
- **Frontend Responsibilities**:
  - Display backend values faithfully.
  - Format values for locale-aware presentation.
  - Render statuses with appropriate semantic indicators.
  - Provide valid input forms for mutations (e.g., request refund, trigger settlement).
  - Surface backend validation errors clearly (e.g., `Refund amount exceeds remaining refundable balance`).
  - Handle loading, empty, and network error states.
- **Strictly Prohibited**:
  - Do NOT duplicate financial business logic (such as deduction algorithms or fee estimations) inside React hooks or components.

---

## Security & Sensitive Information Masking

1. **API Keys & Secrets**:
   - Live and test secret keys (`sk_live_...`, `sk_test_...`) and webhook HMAC secrets must be masked by default (e.g., `sk_test_••••••••••••3a1f`).
   - Provide an explicit, deliberate user action ("Reveal" / "Copy") to unmask secrets.
   - Never log API secrets to browser console or include them in URL query parameters.
2. **Customer & Payment Data**:
   - Mask card numbers (only display last 4 digits: `•••• 4242`).
   - Virtual Account numbers, QRIS payloads, and phone numbers must be formatted with standard readability spacing.

---

## Transaction Details Layout Standard

When displaying any transaction detail modal or page, strictly group data into clear sections:
- **Header**: Primary Transaction ID (UUID), Status Badge, Amount (prominent display), Created Timestamp.
- **Metadata Grid**: Order Reference, Payment Method, Currency, Merchant ID.
- **Provider & Settlement Trace**: Provider Reference, Settlement Reference, Settled Timestamp.
- **Audit & Timeline**: State history transitions and webhook delivery statuses.
