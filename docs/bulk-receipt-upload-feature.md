# Bulk Receipt Upload — Feature Specification

**Product:** Fintr  
**Feature:** Bulk Receipt Upload for Paid/Sponsored Subscribers  
**Status:** Revised — Pending Implementation  
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

Currently, users may only upload one receipt at a time. This enhancement allows paying subscribers to select up to **15 receipt images in a single session**, have each processed by the AI pipeline sequentially, and review all resulting draft transactions in one seamless workflow — significantly reducing the manual effort required when reconciling multiple purchases.

Key decisions confirmed by product review: push notifications via Capacitor are **in scope**; failed receipts do **not** consume tokens; paid users have a draft limit of **15**; and the per-image endpoint strategy is used (no dedicated bulk endpoint for this iteration).

---

## 2. Background & Motivation

The existing single-receipt upload flow works well for day-to-day use. However, power users — particularly small business owners, freelancers, and households with high transaction volume — frequently need to process batches of receipts at once (e.g., after a business trip, a market run, or end-of-month reconciliation).

Offering bulk upload exclusively to paid subscribers creates a meaningful, tangible differentiation between free and paid tiers, directly incentivizing upgrades.

---

## 3. Scope

| In Scope | Out of Scope |
|---|---|
| Multi-image file selection (up to 15) via Capacitor | Bulk upload via camera capture |
| Sequential AI processing per image | Parallel AI processing |
| Per-image status feedback in UI | Auto-approving transactions without review |
| Token cost preview before upload | Bulk editing of draft transactions |
| Draft creation for all successful receipts | CSV/spreadsheet import |
| Seamless sequential draft review flow | Admin bulk upload bypass |
| **Push notifications on batch completion (Capacitor)** | Email notifications on completion |
| Subscription gate (paid/sponsor only) | |

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
- **1 AI token consumed per successful receipt** — enforced by `CreateUsage` before processing; failed receipts must not consume tokens
- **5 draft maximum per user per space (free)** — enforced by `CreateDraftFromReceiptResult#delete_old_drafts` (`Transactions::Draft::MAX_DRAFTS = 5`); raised to **15 for paid/sponsored users**
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
- "Add more" opens the Capacitor file picker again to append additional images (up to the 15-image cap)
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
| More than 15 files selected | Trimmed to 15 with a warning toast |
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
| `src/components/dashboard/add-receipt-dialog.tsx` | Add bulk mode: multi-file state, preview grid, sequential upload loop, progress tracking, subscription gate, push notification trigger |
| `src/services/receipts/mutation.tsx` | No change required — `uploadReceipt()` is called once per image in the loop |
| `src/hooks/async/useSubscriptions.ts` | Already available — consume `useCurrentSubscription()` to gate the button |
| Capacitor Push Notifications plugin | Trigger local push notification on batch completion |

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
    // Token is NOT consumed for failed receipts — error is caught before CreateUsage charges
    setBulkStatuses(prev => setStatus(prev, i, 'error', null, error.message));
  }
}

// After loop: fire push notification via Capacitor
await LocalNotifications.schedule({
  notifications: [{
    title: 'Receipts Processed',
    body: `${successCount} of ${total} receipts processed successfully.`,
    id: Date.now(),
  }]
});
```

**Push notifications** are delivered via the Capacitor `@capacitor/local-notifications` (or `@capacitor/push-notifications`) plugin. The notification is triggered client-side after the processing loop completes, providing immediate feedback even if the user has navigated away.

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

**Decided: use the existing per-image endpoint.** The existing `POST /api/v1/receipts` endpoint is called once per image from the frontend loop. This approach:

- Reuses all existing validation, AI processing, and token consumption logic
- Avoids complexity of a bulk endpoint requiring WebSocket updates and parallel processing
- Keeps each receipt's draft creation and token deduction atomic and independent

> **Note:** A dedicated `POST /receipts/bulk` endpoint (with WebSocket progress updates and parallel processing) is a viable future enhancement if throughput demands grow, but is deferred for this iteration.

**Draft limit for paid users** must be raised from `MAX_DRAFTS = 5` to `MAX_DRAFTS = 15` in `Transactions::Draft` to accommodate a full 15-receipt batch. The `CreateDraftFromReceiptResult#delete_old_drafts` method applies this limit conditionally based on subscription type.

**Token gating on failure:** The backend `CreateUsage` operation must be restructured so that the token is only recorded on a **successful** AI extraction. If `ProcessReceipt` fails (AI error, unreadable image, etc.), the `Ai::Usage` record should be rolled back or not created. This ensures failed receipts do not consume user tokens.

---

### 6.3 Token Consumption Model

| Action | Tokens consumed |
|---|---|
| Single receipt upload (success) | 1 token |
| Bulk upload of N successful receipts | N tokens (1 per successful receipt) |
| Failed receipt (AI error) | **0 tokens** — token deduction gated on AI success |
| Failed receipt (file validation) | 0 tokens (rejected before `CreateUsage`) |
| Failed receipt (network/server error) | 0 tokens (request never reaches `CreateUsage`) |

Token balance is rechecked via `refetchAIUsage()` after each receipt in the loop, ensuring the UI stays accurate. The backend independently gates each request via `space.can_ai?`, so if a user runs out of tokens mid-batch, remaining receipts are skipped and marked ❌ in the UI.

> **Goal:** As much as possible, tokens should only be consumed for value delivered. If the AI fails to extract meaningful data from an image, the user should not be penalised.

---

## 7. Subscription Tier Comparison

| Capability | Free | Paid / Sponsor |
|---|---|---|
| Single receipt upload | ✅ | ✅ |
| Camera capture | ✅ | ✅ |
| AI data extraction | ✅ (up to token limit) | ✅ (higher token limit) |
| Draft transaction creation | ✅ | ✅ |
| **Bulk receipt upload (up to 15)** | ❌ | ✅ |
| **Token cost preview before batch** | ❌ | ✅ |
| **Seamless sequential draft review** | ❌ | ✅ |
| **Push notification on batch completion** | ❌ | ✅ |
| **Higher draft limit (15 vs 5)** | ❌ | ✅ |

---

## 8. Constraints & Limitations

- **Maximum batch size: 15 receipts** — balances UX responsiveness with server load and token consumption risk.
- **`MAX_DRAFTS = 15` for paid/sponsored users** — the draft limit is raised from 5 to 15 for paid/sponsored subscribers to accommodate a full bulk batch. The "Review Transactions" flow is designed to be seamless and frictionless, prompting the user to review and save each draft in sequence before it is displaced by newer ones.
- **`MAX_DRAFTS = 5` for free users** — unchanged.
- **Sequential, not parallel** — processing is intentionally sequential to provide clear per-image feedback and to avoid race conditions on token consumption checks.
- **Mobile camera** — bulk mode uses the file picker only (no webcam grid). Camera capture remains single-image only, as capturing multiple photos in one session is not a standard mobile browser API.
- **No retry on failed images** — failed receipts must be uploaded again individually. A retry button per failed item could be added in a future iteration.

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|---|---|---|---|
| 1 | Should the `MAX_DRAFTS` limit be raised for paid users? | Product | ✅ Resolved | **Yes — 15 drafts for paid/sponsored users.** |
| 2 | Should failed receipts still consume a token, or should we gate token deduction on AI success? | Engineering | ✅ Resolved | **Failed receipts must not consume a token.** Token is only recorded on successful AI extraction. |
| 3 | Is 15 the right cap, or should higher-tier plans allow more? | Product | 🔵 Deferred | **Parked for future discussion.** Current cap set to 15. |
| 4 | Should the "Review Transactions" flow be a stepper/wizard UI or individual dialogs? | Design | ✅ Resolved | **Use existing draft-based flow, but improve it to be more seamless.** The draft review experience should guide the user through each receipt without friction. |
| 5 | Do we want a dedicated `POST /receipts/bulk` backend endpoint now, or stay with per-image calls? | Engineering | ✅ Resolved | **Use per-image calls (singular endpoint) for now.** A `POST /receipts/bulk` with WebSocket + parallel processing is a future stretch goal. |

---

*This document is intended as a feature specification for internal review. Implementation timelines and sprint assignments are to be determined by the engineering team in coordination with product.*
