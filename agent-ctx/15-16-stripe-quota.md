# Task: Implement Feature 15 (Stripe Payment) and Feature 16 (Storage Quota Enforcement)

## Summary

Implemented both features for the RidgeBox cloud storage web app:

### Feature 15: Stripe Payment Integration

**API Endpoints Created:**
- `/home/z/my-project/ridgebox/api/stripe/checkout.js` - POST endpoint that creates a Stripe Checkout Session using the Stripe API directly via fetch. Accepts priceId, userId, email. Returns checkout session URL. Uses STRIPE_SECRET_KEY env var.
- `/home/z/my-project/ridgebox/api/stripe/webhook.js` - POST endpoint that handles Stripe webhooks. Handles checkout.session.completed, customer.subscription.updated, customer.subscription.deleted. Updates user subscription status in Supabase. Uses STRIPE_WEBHOOK_SECRET env var.
- `/home/z/my-project/ridgebox/api/stripe/portal.js` - POST endpoint that creates a Stripe Customer Portal session. Returns portal URL for managing subscriptions. Looks up customer ID from Supabase if needed.

**Frontend Changes:**
- Added Stripe.js CDN (`https://js.stripe.com/v3/`) in the `<head>` section
- Replaced the placeholder `initStripeCheckout()` function with a working Stripe Checkout integration:
  - Gets current user info (userId, email)
  - Calls `/api/stripe/checkout` with priceId for the selected tier
  - Redirects to Stripe Checkout page
  - After successful payment, redirects back to dashboard with success toast
  - When no price ID is configured, shows setup instructions modal
- Added `PRICING_TIERS` constant with 3 pricing tiers:
  - Free: $0/month — 5GB storage, basic features
  - Pro: $4.99/month — 100GB storage, all features
  - Business: $9.99/month — 1TB storage, priority support, admin features
- Updated `openPricingModal()` with new tier structure and current plan detection
- Added "Manage Subscription" button in settings that opens Stripe Customer Portal via `manageSubscription()` function
- Added subscription tier badge (`getSubTierBadge()`) in the header
- Added `handleCheckoutReturn()` for handling Stripe checkout success/cancel redirects
- Added `refreshSubscriptionStatus()` to fetch subscription data from Supabase
- Added `saveStripeConfig()` and `downgradeToFree()` helper functions
- Added Stripe config section in settings modal with:
  - Stripe Publishable Key field
  - Stripe Price IDs for each tier (Free, Pro, Business)
  - Stored in IndexedDB settings (localStorage)
- Updated homepage pricing cards to use new tier names (Free/Pro/Business) and storage amounts (5GB/100GB/1TB)
- Updated `vercel.json` to add routes for `/api/stripe/(.*)`

### Feature 16: Storage Quota Enforcement

**Core Functions:**
- `getSubscriptionLimit()` - Returns storage limit in bytes based on current tier (Free: 5GB, Pro: 100GB, Business: 1TB)
- `checkStorageQuota(fileSize)` - Calculates current total storage used, compares with tier limit, returns { allowed, used, limit, percentage }
- Updated `getStorageLimitBytes()` to use subscription tier limits first, then fall back to bot-based calculation

**Quota Checks Added In:**
- `executeUpload()` - Regular file uploads
- `executeUrlUpload()` - URL uploads
- `capturePhoto()` - Camera photo capture
- `toggleRecording()` - Camera video recording
- `uploadScreenshot()` - Clipboard/screenshot uploads
- `syncBackupFolder()` - Backup sync uploads

**UI Elements:**
- Storage usage bar in sidebar (`getQuotaBarHtml()`) that shows:
  - Used / Total quota with color coding
  - Green (<70%), yellow (70-90%), red (>90%)
  - Clicking opens storage management page
- Warning banner system in dashboard (`getStorageWarningBanner()`):
  - 80% usage: yellow banner "You've used 80% of your storage"
  - 95% usage: red banner "Almost out of storage! Upgrade now"
  - 100%: red banner "Storage full! Uploads blocked" with Upgrade button
- Quota exceeded modal (`showQuotaExceededModal()`) with:
  - "Storage Limit Reached" / "Penyimpanan penuh"
  - Options: "Upgrade to Pro" or "Free up space" (opens storage analytics)
  - Blocks the upload from proceeding
- Subscription quota section in storage management page showing:
  - Used/Limit/Available stats
  - Colored progress bar
  - Tier badge and upgrade button
- Updated `getAllStorageStats()` to include quota info in the return object

**CSS Additions:**
- `.sub-tier-badge` styles for Free/Pro/Business tier badges
- `.quota-bar-*` styles for the storage quota bar in sidebar
- `.quota-modal-icon` styles for the quota exceeded modal

**Settings Updates:**
- Added `subscription` object to `APP.settings` stored in localStorage
- Added `stripePublishableKey`, `stripePriceFree`, `stripePricePro`, `stripePriceBusiness` to settings
