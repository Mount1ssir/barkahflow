# BarkahFlow — Developer & System Skills Guide

Welcome to the developer guide for **BarkahFlow**, a high-performance, cross-platform (Web, Mobile, Desktop), offline-first Point of Sale (POS) and inventory management system designed for merchants in multi-lingual environments (supporting French, English, and Arabic).

This document serves as an exhaustive reference for the system's architecture, database design, core business modules, integrations, and coding patterns.

---

## 🗺️ Project Architecture & Tech Stack

BarkahFlow is designed as a hybrid application that runs natively on Desktop (via Tauri) and Mobile (via Capacitor), while maintaining a standard web deployment using Next.js.

### 1. Frontend & Core Frameworks
*   **Web Framework:** [Next.js](https://nextjs.org) (v16.2.9) utilizing the **App Router** (`app/` directory).
*   **Library:** [React](https://react.dev) (v19.2.4) & TypeScript.
*   **State Management:** [Zustand](https://github.com/pmndrs/zustand) for client-side reactive state (e.g., POS cart, sidebar toggles).
*   **Styling:** [Tailwind CSS](https://tailwindcss.com) (v4.3.1) alongside standard vanilla CSS for complex graphics (e.g., custom glassmorphism backgrounds like `ShapeGrid.jsx`).
*   **Internationalization:** [i18next](https://www.i18next.com/) supporting French (default), English, and Arabic (RTL layout ready).

### 2. Platform Compilation (Static Export)
Because the app must be packaged into native mobile packages (APK/IPA) and desktop installers (MSI/DMG/Debian), Next.js is configured for **Static HTML Exports**:
*   **Next.js Config (`next.config.ts`):** `output: 'export'` and `images: { unoptimized: true }`.
*   **Capacitor Output Directory (`capacitor.config.json`):** Sets `webDir` to `"out"`.
*   **Tauri Output Directory (`src-tauri/tauri.conf.json`):** Sets `frontendDist` to `../out`.

### 3. Database Layer (SQLite + Supabase Sync)
To support offline-first usage, the primary database is a local SQLite database that communicates with a remote Supabase instance for data synchronization.
*   **Local Driver Wrapper (`src/lib/db.ts`):** Implements `dbSelect` and `dbExecute` which transparently resolve to the correct native driver depending on the running platform:
    *   **Mobile:** Uses `@capacitor-community/sqlite` native SQLite engine.
    *   **Desktop:** Uses `@tauri-apps/plugin-sql` native Rust SQL engine.
    *   **Web Fallback:** Falls back to an in-memory SQL/IndexedDB solution if running on a standard web browser.

---

## 🗄️ Database Schema Design

The SQLite schema (located in `src/lib/schema.sql`) represents a robust commercial model designed for retail flows:

```mermaid
erDiagram
    clients ||--o{ invoices : "has"
    clients ||--o{ debt_ledger : "accumulates"
    categories ||--o{ products : "classifies"
    products ||--o{ line_items : "contained in"
    invoices ||--|{ line_items : "comprises"
    invoices ||--o{ transactions : "generates"
    invoices ||--o{ debt_ledger : "leads to"
    users ||--o{ invoices : "creates"
    users ||--o{ cashier_settings : "configures"
    users ||--o{ cashier_stats : "tracks"
    users ||--o{ stock_movements : "records"
```

### Table Definitions & Purpose
1.  **`clients`:** Custom names, addresses, contacts, and loyalty/credit limits.
2.  **`categories`:** Product classification with Arabic, English, French names, and custom category colors.
3.  **`products`:** Inventory records containing SKU, barcode, translations (`name_ar`, `name_en`, `name_fr`), pricing (`cost_price` and `retail_price` stored in cents), `stock_qty`, `reserved_stock`, tax rates, supply records, and favorites.
4.  **`invoices`:** Completed checkout headers with invoice number, pricing summary (subtotal, tax, discounts, totals), payment status (`PAID`, `PARTIAL`, `UNPAID`), and payment method.
5.  **`line_items`:** Individual invoice line entries mapping products to sold quantities, unit price, discounts, and item subtotals.
6.  **`transactions`:** Double-entry journal records representing Cash-In (`INCOME`) or Cash-Out (`EXPENSE`), mapping manually entered transactions or linked automatically to invoices.
7.  **`debt_ledger`:** Accounts receivable ledger representing active client debt balances, remaining outstanding dues, and status (`ACTIVE`, `SETTLED`, `PARTIAL`).
8.  **`reminders_queue`:** Notification queues for SMS/WhatsApp debt alerts.
9.  **`users`:** Staff credentials, PIN hash, role (`admin` or `cashier`), permissions JSON array, login lockouts, and online status.
10. **`cashier_settings` & `cashier_stats`:** Operational preferences and historical cashier performance tracking.
11. **`stock_movements`:** Inventory audit logs tracking additions (`IN`), deductions (`OUT`), or adjustments (`ADJUSTMENT`) with reason codes and operator stamps.

---

## 🧠 Core Modules & Technical Details

### 1. POS Checkout Transaction Pipeline (`lib/checkout-process.ts`)
The checkout flow is highly secure, transactional, and incorporates multi-step checks:
*   **Credit/Debt Validation:** Requires a registered `customerId` if the `paymentStatus` is set to `PARTIAL` or `UNPAID`.
*   **Stock Lock Verification:** Performs pre-checkout scans on inventory availability (checking `stock_qty - reserved_stock`). If insufficient, aborts immediately.
*   **Stock Reservation:** Atomically increments `reserved_stock` before inserting records, avoiding race conditions during concurrent user operations.
*   **Monetary Precautions:** Stores all prices, taxes, and discounts in **integers (cents)** to avoid floating-point math issues.
*   **Transaction Logs & Audit Trails:** Deducts stock, releases reservation, inserts transactional income ledger, updates debt ledger (if partial/unpaid), and logs an encrypted record to the audit logging table.
*   **Concurrency Retry Wrapper:** Includes a database lock retry loop (`withRetry`) to handle SQLite write lock scenarios.

### 2. Barcode Scanner & External Lookup System (`lib/barcode-lookup.ts`)
*   **Hardware Interfacing:** Seamlessly connects with native platforms:
    *   Tauri: Uses `@tauri-apps/plugin-barcode-scanner`.
    *   Capacitor Mobile: Integrates `@capacitor-mlkit/barcode-scanning`.
    *   Web/Camera fallback: Uses `html5-qrcode` and `@zxing/browser`.
*   **EAN-13 & UPC-A Variants:** Generates alternative product codes using `barcodeVariants` (e.g. adding leading zeros to 12-digit UPCs or stripping them from 13-digit EANs) to ensure high hit rates.
*   **External Queries:** If a scanned barcode is missing from the local database, it issues parallel requests to **Open Food Facts**, **Open Products Facts**, and **Open Beauty Facts** API endpoints.
*   **Network Guard & Aborts:** Enforces a 15-second timeout via `AbortController` to handle poor cellular networks on portable cash registers.

### 3. Biometric Security & PIN Authorization (`lib/biometric-auth.ts`)
Supports dual-tier security for POS terminals:
*   **Desktop (WebAuthn):** Standard browser/WebView credential registration and assertion via `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`. Uses Windows Hello or Touch ID natively.
*   **Mobile (Native):** Integrates `@aparajita/capacitor-biometric-auth` for Android/iOS.
*   **PIN Codes (`lib/pin-storage.ts`):** Local cashier verification with brute-force lockouts (tracking `failed_pin_attempts` and locking the app via `locked_until` timestamps).

### 4. AI Voice Assistant & Speech Modules (`lib/voice/`)

BarkahFlow integrates complex artificial intelligence, natural language parsing, fuzzy search, and speech synthesis systems to facilitate hands-free warehouse and merchant operations:

*   **Primary Online LLM Intent Engine (`lib/voice/llm-intent-parser.ts`):**
    *   **LLM Model:** Utilizes the state-of-the-art `llama-3.3-70b-versatile` model hosted on the Groq API.
    *   **Architecture:** Calls are proxied through a server-side route `/api/voice/parse` (see [route.ts](file:///c:/Users/HP/Desktop/main/barkahflow/app/api/voice/parse/route.ts)) to protect the API key.
    *   **Context-Aware Prompts:** Dynamically injects context state (e.g. current UI path) into the system prompt (see [llm-schema.ts](file:///c:/Users/HP/Desktop/main/barkahflow/lib/voice/llm-schema.ts)).
    *   **Output Control:** Enforces strict JSON formatting via `{ type: 'json_object' }` with low temperature (`0.1`) to resolve user speech to predefined structured actions (`NAVIGATE`, `POS_ADD`, `STATS_REVENUE`, etc.) and arguments.
*   **Dual-Pass Offline Fallback Engine (`lib/voice/offline-fallback.ts`):**
    *   **Performance:** Completes local intent parsing in under 5ms, operating fully offline.
    *   **Pass 1 (Regex Rules):** Matches incoming spoken strings against high-confidence regex patterns for French, English, and Arabic keywords (e.g., matching confirmation phrases, numerical values, or navigation destinations).
    *   **Pass 2 (Fuzzy Logic):** Matches unmatched inputs against templates using `Fuse.js` fuzzy matching to handle typos, accents, or transcript variations.
*   **Voice Execution & Action Binding (`lib/voice/voice-executor.ts`):**
    *   Applies resolved intents directly to the react context, zustand stores (adding items to [cart-store.ts](file:///c:/Users/HP/Desktop/main/barkahflow/lib/store/cart-store.ts)), or programmatic page routers.
*   **Text-to-Speech (TTS) Feedback Loop (`lib/voice/voice-feedback.ts`):**
    *   Speaks responses back to the cashier in their local language using the native `SpeechSynthesis` API.
*   **Barcode Lookup & Data Aggregation (`lib/barcode-lookup.ts`):**
    *   Integrates native platform APIs (MLKit on Android/iOS via Capacitor community barcode scanning and Tauri Rust-based barcode scanner) to process and parse image data.
    *   Queries Open Food Facts, Open Products Facts, and Open Beauty Facts using parallel, abort-controlled fetch calls to pull missing product metadata (images, French names, brands) from external databases.

---

## 🛠️ Code Conventions & Developer Guidelines

When modifying or expanding BarkahFlow, adhere to these rules:

### 1. Database Operations
*   **Never query Supabase directly in standard POS pages.** All operational transactions (sales, products, clients) must write to SQLite locally via `dbExecute` and `dbSelect` to preserve offline operation.
*   Let the sync daemon handle remote writes in the background.

```typescript
// Correct pattern:
import { dbSelect, dbExecute } from '@/src/lib/db';

const products = await dbSelect<Product>('SELECT * FROM products WHERE is_active = 1');
```

### 2. Multi-Language Translations
*   Always structure user-facing strings using `t('namespace.key')` via the `useTranslation` hook.
*   Update translation files in `lib/i18n/locales/` for French (`fr`), English (`en`), and Arabic (`ar`).

### 3. Role-Based Access Control (RBAC)
*   Prevent administrative options from being shown to cashiers. Protect navigation and interactive features using the `<Guard>` component or `usePermission` hook.

```typescript
import { Guard } from '@/components/rbac/Guard';

<Guard permission="view_reports">
  <button onClick={viewFinancialReports}>Export Financials</button>
</Guard>
```

### 4. Real-Time State Synchronicity
*   When managing checkout transactions, update the global cart using the exported hook `useCart` which synchronizes automatic offline memory states (`localStorage`).

---

## 📦 Native Compilation Checklists

### Tauri Build (Desktop)
Ensure Rust components and system configurations are compiled:
```powershell
npm run tauri build
```
*Configures Windows Hello WebAuthn bindings automatically through system APIs.*

### Capacitor Sync (Mobile)
When changing routes, static pages, or web code, execute sync to native Android and iOS folders:
```powershell
npm run build
npx cap sync
npx cap open android
```
