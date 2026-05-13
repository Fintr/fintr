# Bulk Receipt Upload — Feature Specification

**Product:** Fintr  
**Feature:** Bulk Receipt Upload for Paid/Sponsored Subscribers  
**Status:** Proposed  
**Prepared by:** Engineering Team  
**Date:** May 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Motivation](#2-background--motivation)
3. [Scope](#3-scope)
4. [Current System Overview](#4-current-system-overview)
5. [Proposed Feature Design](#5-proposed-feature-design)
   - [Access Control](#51-access-control)
   - [User Interface Flow](#52-user-interface-flow)
   - [Error Handling](#53-error-handling)
6. [Technical Architecture](#6-technical-architecture)
   - [Frontend Changes](#61-frontend-changes)
   - [Backend Changes](#62-backend-changes)
   - [Token Consumption Model](#63-token-consumption-model)
7. [Subscription Tier Comparison](#7-subscription-tier-comparison)
8. [Constraints & Limitations](#8-constraints--limitations)
9. [Open Questions](#9-open-questions)

---

## 1. Executive Summary

This document describes the design and implementation plan for **Bulk Receipt Upload**, a premium feature exclusive to paid and sponsored subscribers on Fintr.

Currently, users may only upload one receipt at a time. This enhancement allows paying subscribers to select up to **10 receipt images in a single session**, have each processed by the AI pipeline sequentially, and review all resulting draft transactions in one continuous workflow — significantly reducing the manual effort required when reconciling multiple purchases.

---

## 2. Background & Motivation

The existing single-receipt upload flow works well for day-to-day use. However, power users — particularly small business owners, freelancers, and households with high transaction volume — frequently need to process batches of receipts at once (e.g., after a business trip, a market run, or end-of-month reconciliation).

Offering bulk upload exclusively to paid subscribers creates a meaningful, tangible differentiation between free and paid tiers, directly incentivizing upgrades.

---

## 3. Scope

| In Scope | Out of Scope |
|---|---|
| Multi-image file selection (up to 10) | Bulk upload via camera capture |
| Sequential AI processing per image | Parallel AI processing |
| Per-image status feedback in UI | Email/push notifications on completion |
| Token cost preview before upload | Auto-approving transactions without review |
| Draft creation for all successful receipts | Bulk editing of draft transactions |
| Sequential transaction review flow | CSV/spreadsheet import |
| Subscription gate (paid/sponsor only) | Admin bulk upload bypass |

---

## 4. Current System Overview

### Single Receipt Upload — End-to-End Flow

```
User picks image
       │
       ▼
Frontend validates
(type: image/*, size ≤ 10MB)
       │
       ▼
POST /api/v1/receipts
  { image: File }   ← multipart/form-data
       │
       ▼
Backend: ReceiptsController#create
  ├─ Save image to tmp/receipt_processing/
  ├─ CreateUsage (checks token limit, records 1 token)
  │     └─ space.can_ai?
  │           └─ tokens_used < current_token_limit
  │                 └─ FREE_TOKENS(30) + active paid billing cycle tokens
  └─ ProcessReceipt pipeline:
        ├─ ExtractReceiptDataVision  (AI Vision API)
        ├─ CalculateConfidenceAi
        ├─ FormatResult  →  suggested_transaction_payload
        └─ CreateDraftFromReceiptResult  →  Transactions::Draft record
       │
       ▼
Response: { suggestedTransactionPayload, draftId, confidence, processingTime }
       │
       ▼
Frontend: opens Add Transaction dialog
  pre-filled with AI-suggested values
  user confirms/edits and saves
```

### Key Constraints in the Current System

- **One image per request** — `POST /receipts` accepts a single `image` field
- **1 AI token consumed per receipt** — enforced by `CreateUsage` before processing
- **5 draft maximum per user per space** — enforced by `CreateDraftFromReceiptResult#delete_old_drafts` (`Transactions::Draft::MAX_DRAFTS = 5`)
- **Token limit** = `Space::FREE_TOKENS (30)` + tokens allocated from active paid billing cycles

---

## 5. Proposed Feature Design

### 5.1 Access Control

Bulk upload is gated behind an active paid or sponsored subscription.

| Subscription Type | Status | Bulk Upload Access |
|---|---|---|
| `paid` | `active` | ✅ Allowed |
| `sponsor` | `active` | ✅ Allowed |
| `free` | `active` | ❌ Not available |
| Any | `inactive` / `pending` | ❌ Not available |

Free users will see the standard two-button layout unchanged. Paid/sponsored users will see the additional **"Bulk Upload"** button with a subtle premium badge.

---

### 5.2 User Interface Flow

#### Screen 1 — Initial Options (Paid User)

The "Add Receipt" dialog presents three options instead of two:

```
┌──────────────────────────────────────────┐
│  Add Receipt                             │
│                                          │
│  ┌──────────────┐  ┌──────────────┐      │
│  │              │  │              │      │
│  │  📷          │  │  🖼           │      │
│  │  Take Photo  │  │  Upload File │      │
│  │              │  │              │      │
│  └──────────────┘  └──────────────┘      │
│                                          │
│  ┌────────────────────────────────┐      │
│  │  📂  Bulk Upload  ✨ Paid      │      │
│  └────────────────────────────────┘      │
│                                          │
│  12 tokens remaining                     │
└──────────────────────────────────────────┘
```

- "Take Photo" and "Upload File" behave exactly as before — no regression
- "Bulk Upload" button shows a `✨ Paid` badge to reinforce its value
- Token count is displayed as always

---

#### Screen 2 — File Selection & Preview Grid

After tapping "Bulk Upload", the native file picker opens with `multiple` enabled. Once files are selected, the dialog transitions to a preview grid:

```
┌──────────────────────────────────────────┐
│  Add Receipts  (5 selected)              │
│                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐      │
│  │  img1  │  │  img2  │  │  img3  │      │
│  │   [✕]  │  │   [✕]  │  │   [✕]  │      │
│  └────────┘  └────────┘  └────────┘      │
│  ┌────────┐  ┌────────┐                  │
│  │  img4  │  │  img5  │  + Add more      │
│  │   [✕]  │  │   [✕]  │                  │
│  └────────┘  └────────┘                  │
│                                          │
│  ⚡ Tokens needed: 5  /  12 remaining    │
│                                          │
│  [ Cancel ]          [ Upload All → ]    │
└──────────────────────────────────────────┘
```

**Behaviour:**
- Each thumbnail shows a remove `[✕]` button to deselect individual images before uploading
- "Add more" opens the file picker again to append additional images (up to the 10-image cap)
- Token cost is calculated upfront: `tokensNeeded = selectedImages.length`
- "Upload All" is **disabled** if `tokensNeeded > aiUsage.remaining`, with a clear message: *"Not enough tokens. Remove X receipt(s) or upgrade your plan."*
- Images are validated on selection (type: `image/*`, size ≤ 10MB each)

---

#### Screen 3 — Sequential Processing

Receipts are uploaded and processed **one at a time**. The preview grid updates live as each image is handled:

```
┌──────────────────────────────────────────┐
│  Processing receipts...  3 of 5          │
│                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐      │
│  │  img1  │  │  img2  │  │  img3  │      │
│  │   ✅   │  │   ✅   │  │   ⏳   │      │  ← active
│  └────────┘  └────────┘  └────────┘      │
│  ┌────────┐  ┌────────┐                  │
│  │  img4  │  │  img5  │                  │
│  │   ⏸    │  │   ⏸    │                  │  ← pending
│  └────────┘  └────────┘                  │
│                                          │
│  ████████████░░░░░░░░  60%              │
│                                          │
│  Processing is in progress...            │
└──────────────────────────────────────────┘
```

**Status indicators:**

| Icon | Meaning |
|---|---|
| ⏸ (gray) | Queued, not yet started |
| ⏳ (spinning) | Currently being processed by AI |
| ✅ (green) | Successfully processed, draft created |
| ❌ (red) | Failed — image could not be read or AI extraction failed |

- The dialog **cannot be closed** during processing (same guard as single upload)
- No cancel mid-batch to avoid ambiguous token consumption states

---

#### Screen 4 — Completion Summary

Once all images have been processed, the dialog shows a results summary:

```
┌──────────────────────────────────────────┐
│  Done!  4 of 5 receipts processed ✅     │
│                                          │
│  ✅  receipt1.jpg   ₱ 245.00             │
│  ✅  receipt2.jpg   ₱ 89.50              │
│  ✅  receipt3.jpg   ₱ 1,200.00           │
│  ❌  receipt4.jpg   Could not read image │
│  ✅  receipt5.jpg   ₱ 55.00              │
│                                          │
│  7 tokens remaining after this batch     │
│                                          │
│  [ Close ]      [ Review Transactions ]  │
└──────────────────────────────────────────┘
```

- Each successful receipt shows the extracted amount for a quick sanity check
- Failed receipts show a short reason
- "Review Transactions" opens the Add Transaction dialog, cycling through all successful drafts one by one so the user can confirm, edit, and save each
- Updated token balance is shown so the user knows their remaining capacity

---

### 5.3 Error Handling

| Scenario | Behaviour |
|---|---|
| File is not an image | Rejected immediately at file selection with toast error |
| File exceeds 10MB | Rejected immediately at file selection with toast error |
| More than 10 files selected | Trimmed to 10 with a warning toast |
| Not enough tokens for the whole batch | "Upload All" disabled; user prompted to remove images or upgrade |
| Token limit hit mid-batch | Processing stops after the last successful receipt; completed results still shown |
| AI cannot extract data from an image | Receipt marked ❌ in grid; processing continues with remaining images |
| Network / server error on one image | Receipt marked ❌; error message shown in summary; processing continues |

---

## 6. Technical Architecture

### 6.1 Frontend Changes

**Files to modify:**

| File | Change |
|---|---|
| `src/components/dashboard/add-receipt-dialog.tsx` | Add bulk mode: multi-file state, preview grid, sequential upload loop, progress tracking, subscription gate |
| `src/services/receipts/mutation.tsx` | No change required — `uploadReceipt()` is called once per image in the loop |
| `src/hooks/async/useSubscriptions.ts` | Already available — consume `useCurrentSubscription()` to gate the button |

**State additions to `AddReceiptDialog`:**

```typescript
// Bulk mode
const [isBulkMode, setIsBulkMode] = useState(false);
const [selectedImages, setSelectedImages] = useState<File[]>([]);
const [bulkPreviews, setBulkPreviews] = useState<string[]>([]);
const [bulkStatuses, setBulkStatuses] = useState<BulkItemStatus[]>([]);
// 'idle' | 'processing' | 'success' | 'error'

type BulkItemStatus = {
  file: File;
  preview: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  result?: any;      // suggestedTransactionPayload
  draftId?: string;
  errorMessage?: string;
};
```

**Sequential processing loop:**

```typescript
for (let i = 0; i < selectedImages.length; i++) {
  setBulkStatuses(prev => setStatus(prev, i, 'processing'));
  try {
    const response = await uploadReceipt(api, { image: selectedImages[i] });
    setBulkStatuses(prev => setStatus(prev, i, 'success', response));
    refetchAIUsage();
  } catch (error) {
    setBulkStatuses(prev => setStatus(prev, i, 'error', null, error.message));
  }
}
```

**Subscription gate:**

```typescript
const { activeSubscription } = useCurrentSubscription();
const isPaidOrSponsor =
  activeSubscription?.status === 'active' &&
  (activeSubscription?.subscriptionType === 'paid' ||
   activeSubscription?.subscriptionType === 'sponsor');
```

---

### 6.2 Backend Changes

No new endpoint is required. The existing `POST /api/v1/receipts` endpoint is called once per image from the frontend loop. This approach:

- Reuses all existing validation, AI processing, and token consumption logic
- Avoids complexity of a bulk endpoint handling partial failures server-side
- Keeps each receipt's draft creation and token deduction atomic and independent

**If a dedicated bulk endpoint is preferred in the future**, the proposed signature would be:

```
POST /api/v1/receipts/bulk
Content-Type: multipart/form-data

images[0]: <File>
images[1]: <File>
...
images[9]: <File>
```

Response:
```json
{
  "data": {
    "results": [
      { "status": "success", "draftId": "...", "suggestedTransactionPayload": { ... } },
      { "status": "error",   "filename": "receipt4.jpg", "message": "Could not extract data" }
    ],
    "successCount": 4,
    "failureCount": 1
  }
}
```

---

### 6.3 Token Consumption Model

| Action | Tokens consumed |
|---|---|
| Single receipt upload | 1 token |
| Bulk upload of N receipts | N tokens (1 per receipt, deducted sequentially) |
| Failed receipt (AI error) | 1 token (consumed before processing attempt) |
| Failed receipt (file validation) | 0 tokens (rejected before `CreateUsage`) |

Token balance is rechecked via `refetchAIUsage()` after each receipt in the loop, ensuring the UI stays accurate. The backend independently gates each request via `space.can_ai?`, so if a user runs out of tokens mid-batch, remaining receipts receive a `402`-equivalent error and are marked ❌ in the UI.

---

## 7. Subscription Tier Comparison

| Capability | Free | Paid / Sponsor |
|---|---|---|
| Single receipt upload | ✅ | ✅ |
| Camera capture | ✅ | ✅ |
| AI data extraction | ✅ (up to token limit) | ✅ (higher token limit) |
| Draft transaction creation | ✅ | ✅ |
| **Bulk receipt upload (up to 10)** | ❌ | ✅ |
| **Token cost preview before batch** | ❌ | ✅ |
| **Sequential review of all drafts** | ❌ | ✅ |

---

## 8. Constraints & Limitations

- **Maximum batch size: 10 receipts** — balances UX responsiveness with server load and token consumption risk.
- **`MAX_DRAFTS = 5`** — the existing draft cap means if the user uploads 10 receipts, only the 5 most recent drafts are retained. The "Review Transactions" flow should prompt the user to save each draft before moving to the next to avoid automatic deletion.
- **Sequential, not parallel** — processing is intentionally sequential to provide clear per-image feedback and to avoid race conditions on token consumption checks.
- **Mobile camera** — bulk mode uses the file picker only (no webcam grid). Camera capture remains single-image only, as capturing multiple photos in one session is not a standard mobile browser API.
- **No retry on failed images** — failed receipts must be uploaded again individually. A retry button per failed item could be added in a future iteration.

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should the `MAX_DRAFTS` limit be raised for paid users? | Product | Open |
| 2 | Should failed receipts still consume a token, or should we gate token deduction on AI success? | Engineering | Open |
| 3 | Is 10 the right cap, or should higher-tier plans allow more? | Product | Open |
| 4 | Should the "Review Transactions" flow be a stepper/wizard UI or individual dialogs? | Design | Open |
| 5 | Do we want a dedicated `POST /receipts/bulk` backend endpoint now, or stay with per-image calls? | Engineering | Open |

---

*This document is intended as a feature specification for internal review. Implementation timelines and sprint assignments are to be determined by the engineering team in coordination with product.*
