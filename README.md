# UniTicket — Decentralized Ticketing Solution on Solana

> **Eliminating counterfeit tickets, ticket scalping, and fraud with ultra-fast, transparent Solana Devnet smart contracts.**

[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-14F195?logo=solana&logoColor=white)](https://explorer.solana.com/?cluster=devnet)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?logo=vercel&logoColor=white)](https://uniticket-ud18.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![UniHackfest 2026](https://img.shields.io/badge/Hackathon-UniHackfest_2026-9945FF)](https://github.com/Nemm123/uniticket)

---

## 1. Project Title & Tagline

**UniTicket** — *Decentralized Ticketing Solution on Solana*

UniTicket is a Web3-native event ticketing platform designed to solve the critical challenges plaguing the modern live entertainment and event industry: ticket scalping, counterfeit tickets, untraceable secondary market reselling, and centralized database tampering. Built on Solana Devnet, UniTicket ensures lightning-fast transactions, near-zero gas fees, cryptographic ownership verification, and dynamic QR check-in.

---

## 2. The Problem & Solution

### The Problem
* **Counterfeit & Duplicate Tickets:** In centralized platforms, static QR codes and PDF tickets are routinely screenshot, copied, and sold to multiple unsuspecting fans, causing chaos at venue gates.
* **Aggressive Scalping & Black Market Botting:** Speculators and ticket bots hoard high-demand concert tickets within seconds and resell them on unregulated black markets at 300%–1000% inflated prices.
* **Lack of Transparency & Trust:** Event attendees and organizers have no visibility into authentic secondary transfers, ticket provenance, or revenue allocation.
* **Centralized Single Point of Failure:** Database tampering or outages by centralized ticket brokers leave attendees stranded outside venues.

### The UniTicket Solution
* **On-Chain Ticket Verification:** Each ticket is backed by an on-chain state on the Solana network, cryptographically bound to the buyer's public wallet address.
* **Anti-Scalping Architecture:** Strict per-wallet ticket reservation caps and on-chain rules eliminate bot manipulation and unauthorized bulk buying.
* **Cryptographic Dynamic QR Check-In:** UniTicket utilizes salted, deterministic SHA-256 hash tokens that prevent gate fraud and replay attacks while preserving atomic state transitions during gate check-in.
* **Public Explorer Auditability:** Every ticket purchase, mint, and state transition is verifiable directly on Solana Explorer.

---

## 3. Key Features

- **Seamless Phantom Wallet Integration:**
  - One-click direct connection with automatic account switching and disconnect listeners.
  - Real-time Solana Devnet SOL balance querying with direct link to the Solana Faucet (`https://faucet.solana.com`).
  - Prominent "Solana Devnet" network badge ensuring judges and users are on the correct cluster.
- **Transparent Transaction Lifecycle (UX Feedback):**
  - **Step 1:** Wallet signature request state with spinner: *"Vui lòng ký giao dịch trên ví..."*
  - **Step 2:** Fast Devnet confirmation state: *"Đang xác nhận giao dịch trên Solana Devnet..."*
  - **Step 3:** Automatic confirmation toast with a direct, clickable Solana Explorer transaction link:
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`
  - Automatic background refresh of tickets in the **"My Tickets" (Vé của tôi)** dashboard without needing a page reload.
- **User-Friendly Error Handling:**
  - Gracefully captures and translates technical blockchain errors (e.g., wallet rejection `4001`, insufficient SOL for transaction fees, blockhash timeout) into clear, friendly guidance.
- **Organizer Dashboard & Role-Based Access Control:**
  - Sign-in with Solana (SIWS) cryptographic challenge-response authentication.
  - Real-time event analytics: total sales, revenue, tickets remaining, and real-time gate check-in ratios.
- **Mobile-Responsive & Bilingual (VI / EN):**
  - Instant localization between Vietnamese and English with complete parity across all flows.
  - Integrated QR scanner camera module for event gate staff.

---

## 4. Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript | Modern, high-performance single page application |
| **Styling** | TailwindCSS, Lucide React | Cyberpunk neon aesthetic inspired by the Solana ecosystem |
| **Web3 & Solana** | `@solana/web3.js` (v1.99), Phantom Provider | Solana Devnet connection, wallet signing, RPC queries, Explorer verification |
| **Backend & API** | Node.js, Express, TypeScript | REST API, SIWS message verification, order lifecycle management |
| **Database** | PostgreSQL (`pg`), SQL Migrations | ACID transactional ticket inventory locking and audit trail |
| **QR & Scanning** | `qrcode.react`, `qr-scanner` | Dynamic QR code generation and high-speed in-browser camera scanning |

---

## 5. On-Chain Verification

* **Network / Cluster:** `Solana Devnet`
* **RPC Endpoint:** `https://api.devnet.solana.com`
* **Program ID:** `UniTkT7pL4w5sJ4GjN6E4bB8eN7mK9pQ2R3sT4uV5wX`
* **Treasury / Minter Public Key:** `CUx6CcVbkbdiaQS4qm6zEuR1p9xTjJ3LTnqBq9NJF3mh`

### Explorer Verification Pattern
All confirmed transactions can be inspected on the official Solana Explorer:
```text
https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet
```

---

## 6. Getting Started & Installation

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm** or **pnpm**
* **Phantom Wallet** browser extension installed ([phantom.com](https://phantom.com))
* Devnet SOL from [Solana Faucet](https://faucet.solana.com)

### 1. Clone the Repository
```bash
git clone https://github.com/Nemm123/uniticket.git
cd uniticket
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
npm --prefix backend install
```

### 3. Environment Configuration

#### Frontend (`.env`)
Create `.env` in the root folder:
```env
VITE_API_BASE_URL=http://localhost:4000
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_PROGRAM_ID=UniTkT7pL4w5sJ4GjN6E4bB8eN7mK9pQ2R3sT4uV5wX
VITE_SOLANA_TREASURY_WALLET=CUx6CcVbkbdiaQS4qm6zEuR1p9xTjJ3LTnqBq9NJF3mh
```

#### Backend (`backend/.env`)
Create `backend/.env`:
```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/uniticket
DATABASE_SSL=false
CLIENT_ORIGIN=http://localhost:5173
AUTH_DOMAIN=localhost
AUTH_NONCE_TTL_SECONDS=300
AUTH_SESSION_TTL_SECONDS=28800
RESERVATION_TTL_SECONDS=900
SERVICE_FEE_VND=20000
ADMIN_WALLET_ADDRESSES=CUx6CcVbkbdiaQS4qm6zEuR1p9xTjJ3LTnqBq9NJF3mh
```

### 4. Running the Development Servers

#### Start the Backend API:
```bash
npm --prefix backend run dev
```

#### Start the Frontend Application:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### 5. Automated Test Suite & Build Verification
```bash
# Run automated regression test suite (19 test cases)
node scratch/test-suite.cjs

# Build frontend & backend
npm run build
npm --prefix backend run build
```

---

## 7. Demo Links & Repositories

- **Live Production dApp:** [https://uniticket-ud18.vercel.app/](https://uniticket-ud18.vercel.app/)
- **GitHub Repository:** [https://github.com/Nemm123/uniticket](https://github.com/Nemm123/uniticket)
- **Solana Devnet Program Explorer:** [View Program on Solana Explorer](https://explorer.solana.com/address/UniTkT7pL4w5sJ4GjN6E4bB8eN7mK9pQ2R3sT4uV5wX?cluster=devnet)

---

## Bản Tóm Tắt Dự Án (Vietnamese Summary)

### Giới thiệu dự án
**UniTicket** là giải pháp nền tảng bán vé và quản lý sự kiện phi tập trung xây dựng trên blockchain **Solana Devnet**, hướng đến việc loại bỏ hoàn toàn nạn vé giả, vé chợ đen (phe vé) và thiếu minh bạch trong ngành giải trí tại Việt Nam.

### Điểm nổi bật & Giá trị công nghệ
1. **Minh bạch hóa giao dịch trên Solana**: Mọi vé sau khi thanh toán đều phát sinh giao dịch trên Solana Devnet. Người dùng có thể tra cứu trực tiếp signature trên Solana Explorer theo định dạng chuẩn: `https://explorer.solana.com/tx/${signature}?cluster=devnet`.
2. **Trải nghiệm Web3 mượt mà (Seamless UX)**:
   - Tích hợp ví Phantom trực tiếp: hiển thị số dư SOL, badge mạng `Solana Devnet`, nút nhận SOL Faucet tự động.
   - Luồng mua vé minh bạch với 3 trạng thái rõ ràng: *Vui lòng ký giao dịch trên ví...* $\rightarrow$ *Đang xác nhận giao dịch trên Solana Devnet...* $\rightarrow$ *Cấp vé & mã QR thành công*.
   - Xử lý lỗi thân thiện bằng tiếng Việt (từ chối ký, thiếu SOL trả gas, timeout).
3. **Chống vé giả & Phe vé (Anti-scalping & Anti-counterfeiting)**:
   - Vé được liên kết với ví người mua; mã QR check-in sử dụng token hash SHA-256 đối soát thời gian thực tại cổng soát vé, ngăn chặn chụp màn hình bán lại nhiều lần.
4. **Hệ thống hoàn chỉnh sẵn sàng ứng dụng**:
   - Trang khám phá sự kiện, chi tiết phân hạng vé, giỏ hàng giữ chỗ nguyên tử (atomic reservation).
   - Trang quản lý vé đã mua (My Tickets) và Cổng soát vé camera QR Scanner cho Ban tổ chức.
   - Hỗ trợ song ngữ Tiếng Việt / Tiếng Anh toàn diện.

---
*UniTicket — Nộp bài thi UniHackfest 2026. Made with ❤️ on Solana.*
