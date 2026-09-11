# Test Plan · Build the real prompt-injected invoice attack

**Layer:** BE unit (vitest)

**File:** `server/src/routes/__tests__/activity.test.js`

**Run:** `npm test --prefix server -- activity`

**Note:** `selectNormalPaymentTarget` and `selectPoisonedPaymentTarget` are removed by this issue (replaced by one real decision function per Action Item 2), so their two existing `describe` blocks are deleted, not modified. `classifyPaymentError`'s existing tests are untouched by this issue and are not relisted here.

Action Items 3 (frontend wiring) and 4 (e2e proof) are verified by their own spec.md Verify clauses (`npm run build --prefix apps/business` and the real headed Playwright run) — not unit-testable logic, so they have no entries below. The Playwright run itself is executed for real, with video + trace, by `/e2e-verify` in Phase 2.5.

---

## Tests

**activity.js**

- **decidePaymentFromInvoice** *(real AI call via a local Ollama server — `openai` SDK mocked at module level)*
  - [happy-path] decides the destination account, the amount, and states its own reasoning, straight from a (mocked) real `makePayment` tool-call response
  - [unhappy-path] raises a real, distinct error when the model's response contains no `makePayment` tool call
  - [unhappy-path] raises a real, distinct error when the local model call itself fails (e.g. Ollama not running)

- **isPaymentFlagged**
  - [happy-path] not flagged when the decided account matches the vendor's real, locked account
  - [happy-path] flagged when the decided account differs from the vendor's real, locked account

- **buildActivityRow** *(existing function, extended)*
  - [happy-path] the produced row carries the real reasoning and flagged state alongside the existing amount, fee, and both transaction hashes
  - [happy-path] a flagged row also carries the raw invoice document for the frontend to display; a non-flagged row does not carry one

**invoice-content.js** *(tested from `activity.test.js`, per the approved spec's file plan)*

- **extractInvoiceText**
  - [happy-path] the clean invoice's extracted text contains no rerouting instruction
  - [happy-path] the poisoned invoice's extracted text contains the concealed rerouting instruction and its target account, regardless of how that text is visually concealed in the document
