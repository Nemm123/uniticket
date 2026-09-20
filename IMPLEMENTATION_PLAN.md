# Implementation Plan — Giai đoạn 1 (Frontend Mock)

> **Phạm vi:** Luồng khách hàng (xem sự kiện → chọn vé → checkout mô phỏng → vé của tôi + QR mock).  
> **Không thuộc Giai đoạn 1:** Backend, Signed QR Token thật, giao dịch Solana on-chain, chống giả, chuyển nhượng P2P, scanner staff production.  
> **Trạng thái:** Chờ xác nhận trước khi viết/chỉnh code.  
> **Cập nhật:** 20/09/2026 — bổ sung ràng buộc QR, PurchasedTicket, inventory, phí mạng, mock data, lỗi, kiểm thử.

---

## 0. Nguyên tắc bắt buộc

- Giai đoạn 1 là **Frontend Mock**. Mọi copy, badge và dữ liệu phải nói rõ đây là mô phỏng.
- Không tuyên bố QR chống giả, xác thực bảo mật, hoặc vé NFT đã mint trên chain.
- Không mã hóa private key, seed phrase, hoặc dữ liệu nhạy cảm vào QR / localStorage.
- `localStorage` chỉ phục vụ demo trên **một trình duyệt / một thiết bị**. Không đồng bộ nhiều người dùng.
- Khi mua thất bại: Toast, không `alert()`.
- Không tự thêm trường vào `mockEvents` nếu chưa được xác nhận (xem mục 5).

---

## 1. QR Code — Frontend Mock

### Yêu cầu
- QR Giai đoạn 1 **chỉ là Frontend Mock**: sinh SVG/Canvas từ payload JSON không ký.
- Copy UI phải ghi **“QR mô phỏng”**. Không dùng wording “QR chống giả”, “xác thực bảo mật”, “signed token đã kích hoạt”.
- Payload **không** chứa: private key, seed phrase, secret, chữ ký giả mạo như thể đã được backend ký.
- Cấu trúc dữ liệu **tương thích thay thế sau này** bằng Signed QR Token từ Backend (cùng envelope, đổi `payload` / `signature`).

### Envelope đề xuất (mock → signed)

```ts
type QrEnvelopeV1 = {
  version: 'mock-v1';       // sau này: 'signed-v1'
  isMockQr: true;           // sau này: false
  payload: {
    ticketId: string;
    orderId: string;
    eventId: string;
    tierId: string;
    ticketCode: string;
    seat: string;
    issuedAt: string;       // ISO
  };
  // Chỗ dành cho backend; Giai đoạn 1 luôn null
  signature: null;
  signedBy: null;
};
```

QR encode `JSON.stringify(envelope)`. Khi có Backend: giữ `payload`, gán `signature` + `signedBy`, đổi `version`. Client Scanner sau này verify chữ ký; Giai đoạn 1 **không** verify chữ ký.

### Copy bắt buộc trên My Tickets
- Badge: `QR MÔ PHỎNG`
- Ghi chú: QR không chứng minh tính hợp lệ on-chain; chưa có Signed QR Token.

---

## 2. PurchasedTicket — một vé = một bản ghi

### Cấm
- Không lưu một object có `quantity = 2` (hoặc N) thay cho N vé.
- Không dùng chung `ticketCode` / `ticketId` cho nhiều chỗ ngồi.

### Bắt buộc khi mua `N` vé
- Tạo **N** `PurchasedTicket`.
- Mỗi vé: `ticketId` (`id`) duy nhất, `ticketCode` riêng.
- Cùng đơn: chung `orderId`.
- Tổng `newTickets.length === N` trước khi ghi storage.

### Mô hình (Giai đoạn 1 + chỗ mở rộng)

| Trường | Giai đoạn 1 | Mở rộng sau |
| :--- | :--- | :--- |
| `id` | ticketId duy nhất | giữ nguyên |
| `orderId` | liên kết đơn | map sang order backend |
| `eventId`, `tierId` | bắt buộc | giữ nguyên |
| `ticketCode` | mã hiển thị + QR | giữ nguyên |
| `status` | `'valid'` | `'checked_in'` / `'transferred'` |
| `isCheckedIn`, `checkInTime?` | mặc định `false` / omit | Staff check-in |
| `customerWallet` | địa chỉ mock | owner on-chain |
| `qrPayload` | envelope mock | signed token |
| (sau này, không implement GĐ1) | — | `transferredTo`, `transferTx`, `listedForResale` |

Không implement UI chuyển nhượng trong Giai đoạn 1 (để Giai đoạn sau). Chỉ **để chỗ dữ liệu** (`status` union) để không phải phá schema.

---

## 3. Inventory mock

### Luồng xác nhận mua
1. Đọc tồn kho hiện tại từ localStorage (`remainingQuantity` của hạng vé).
2. Nếu `quantity > remainingQuantity` hoặc `remainingQuantity <= 0` → **từ chối**, Toast lỗi, không ghi vé.
3. Nếu đủ: trừ `remainingQuantity`, tăng `soldTickets`, ghi N vé — **cùng một thao tác** (ghi fail thì rollback cả hai key).

### Ghi chú demo (UI + comment code)
> Tồn kho lưu trên `localStorage` của trình duyệt này. Không đồng bộ giữa nhiều người dùng, nhiều tab/thiết bị, hoặc máy khác. Đây không phải inventory production.

---

## 4. Phí mạng mô phỏng (không phải phí Solana thật)

### Copy bắt buộc
- Nhãn: **“Phí mạng mô phỏng”**.
- Không trình bày `0.00005 SOL` (hoặc số tương tự) như **phí giao dịch thực tế** trên Solana.
- Hiển thị rõ: **giao dịch chưa diễn ra trên Blockchain**; không trừ SOL; không có signature / slot / explorer link thật.

### Hiển thị đề xuất trong Checkout
- Giá vé: `priceSol * quantity` (từ `TicketTier.priceSol`).
- Dòng phụ: `Phí mạng mô phỏng: 0 SOL` **hoặc** một số minh họa kèm chú thích “(không phải phí giao dịch on-chain)”.
- Banner: “Thanh toán mô phỏng — chưa có giao dịch trên Blockchain.”
- Nút: **không** dùng “Thanh Toán & Mint Vé NFT” như thể mint đã chạy. Dùng “Xác nhận mua (mô phỏng)”.

Nếu giữ số minh họa (ví dụ 0.00005), bắt buộc gắn nhãn mô phỏng và **không** cộng vào như fee RPC thật.

---

## 5. Mock data — báo cáo trường (không tự giả định)

Nguồn: `src/data/mockEvents.ts` + `EventItem` / `TicketTier` trong `src/types/index.ts`.

### Có đúng tên trường yêu cầu

| Yêu cầu | Có trong mock? | Trường thực tế |
| :--- | :---: | :--- |
| `title` | Có | `title: string` |
| `artists` | **Không** | Có `lineup?: string[]` (không có `artists`) |
| `lineup` | Có | `lineup?: string[]` |
| `location` | **Không** | Không có `location`. Có `venue` + `city` |
| `date` | Có | `date: string` dạng `DD/MM/YYYY` (không phải ISO Date) |
| `category` | Có | `category` union: Concert, EDM Festival, Web3 Hackathon, Rock Arena, DJ Night |
| ticket tiers | Có | `tiers?: TicketTier[]` |
| `price` | **Không** | Event: `minPriceSol`. Hạng vé: `priceSol` |
| available quantity | **Không** (đúng tên) | Hạng vé: `remainingQuantity`, `totalQuantity`. Event: `totalTickets`, `soldTickets` |

### Hệ quả cho Giai đoạn 1 (chờ xác nhận)

- **Tìm kiếm địa điểm:** dùng `venue` và `city`. Không thêm `location` trừ khi được xác nhận.
- **Tìm kiếm nghệ sĩ:** dùng `lineup`. Không thêm `artists` trừ khi được xác nhận.
- **Lọc giá:** dùng `minPriceSol` (event) và/hoặc `priceSol` (tier). Không thêm `price`.
- **Tồn kho / chặn mua vượt:** dùng `tiers[].remainingQuantity`. Không thêm `availableQuantity`.
- `lineup` và `tiers` đang **optional** trên type; mọi event hiện tại trong file mock **đều có** cả hai. Logic lọc/mua phải xử lý `undefined` an toàn, không giả định luôn có.

**Không chỉnh `mockEvents.ts` để đổi tên trường** cho đến khi Nam xác nhận có cần alias (`location`, `artists`, `price`, …) hay chỉ map sang field hiện có.

---

## 6. Error handling

| Tình huống | Hành vi |
| :--- | :--- |
| localStorage throw / quota | try/catch; không crash app; Toast lỗi mua vé |
| JSON parse fail / không phải array | fallback: inventory → `mockEvents`; vé đã mua → `[]` |
| Vé thiếu field bắt buộc | bỏ qua bản ghi hỏng khi đọc |
| Mua vượt tồn / ghi fail | Toast lỗi; không đổi tồn kho; không thêm vé |
| Form thiếu tên/email/ví | Toast lỗi validation |

Không dùng `alert()` cho luồng mua vé / checkout / inventory. Dùng Toast hiện có (`src/components/common/Toast.tsx`).

---

## 7. Testing (bắt buộc trước khi đóng Giai đoạn 1)

Chưa có test runner trong `package.json`. Cần thêm Vitest (khớp Vite) và các case:

1. **Mua 1 vé:** 1 `PurchasedTicket`; `remainingQuantity` giảm 1; `soldTickets` +1.
2. **Mua 2+ vé:** N bản ghi, N `ticketId` / `ticketCode` khác nhau, cùng `orderId`; tồn kho giảm N.
3. **Mua vượt tồn:** không ghi vé; tồn kho không đổi; hàm trả fail.
4. **Refresh sau khi mua:** đọc lại localStorage vẫn còn đủ N vé và tồn kho đã trừ (mô phỏng reload bằng gọi lại `getStored*`).
5. **localStorage thiếu / JSON hỏng / không phải array:** không throw; fallback an toàn.

Ưu tiên unit test `storage` + hàm tạo đơn (tách logic khỏi React nếu cần để test được).

---

## 8. Phạm vi UI Giai đoạn 1 (đã chỉnh so với plan cũ)

Giữ:
- Router: `/`, `/events`, `/events/:id`, `/my-tickets` (organizer/scanner không phải tiêu chí đóng GĐ1).
- Events: search + filter trên **field đã có** (mục 5).
- Event detail: +/- số lượng, tổng `priceSol`, chặn vượt `remainingQuantity`.
- Checkout mock + My Tickets + QR mock + persist localStorage.

Bỏ / hoãn so với plan cũ trong `feature_audit.md`:
- Không “phí gas Solana ước tính” như fee thật.
- Không “Sinh Mã QR Thật” theo nghĩa bảo mật; chỉ QR render mock.
- Không CTA “Mint Vé NFT” như mint đã chạy.
- Modal Transfer Ticket: **hoãn Giai đoạn sau** (chỉ giữ field `status` mở rộng).

---

## 9. Danh sách file cần chỉnh sửa / tạo

Chưa thực hiện trong lượt này.

### Sửa

| File | Việc |
| :--- | :--- |
| `src/types/index.ts` | `QrEnvelopeV1`; `PurchasedTicket` 1 vé / 1 record; `status` mở rộng check-in/transfer; không thêm field mock chưa xác nhận |
| `src/utils/storage.ts` | đọc/ghi an toàn; check tồn trước mua; cập nhật inventory; rollback; comment localStorage không multi-user |
| `src/components/checkout/CheckoutModal.tsx` | tạo N vé; envelope QR mock; copy phí mạng mô phỏng + chưa on-chain; Toast qua `onError`; không `alert` |
| `src/pages/EventDetail/index.tsx` | +/- ; chặn vượt tồn; mở checkout; Toast |
| `src/pages/Events/index.tsx` | search/filter: `title`, `lineup`, `venue`, `city`, `date`, `category`, `minPriceSol` / `tiers` — **không** giả định `location`/`artists`/`price` |
| `src/App.tsx` | My Tickets: 1 card / vé, QR mock + disclaimer; Toast mua thành công/thất bại; hydrate localStorage khi load |
| `src/components/common/Toast.tsx` | đảm bảo error/success cho checkout (chỉ sửa nếu thiếu type/UI) |
| `package.json` | script `test` + vitest |
| `vite.config.ts` | (nếu cần) vitest config |
| `feature_audit.md` | đồng bộ wording Giai đoạn 1 (QR mock, phí mạng mô phỏng) |

### Tạo

| File | Việc |
| :--- | :--- |
| `src/utils/qrPayload.ts` | build/parse envelope mock; không secret |
| `src/utils/purchase.ts` | tạo N `PurchasedTicket` + `orderId`; gọi storage atomic |
| `src/utils/storage.test.ts` | 5 nhóm test mục 7 |
| `src/utils/purchase.test.ts` | mua 1 / mua nhiều / unique ids |

### Không sửa cho đến khi xác nhận mục 5

| File | Lý do |
| :--- | :--- |
| `src/data/mockEvents.ts` | Thiếu đúng tên `artists`, `location`, `price`, available quantity. Map sang field hiện có; không tự thêm alias. |

### Ngoài phạm vi Giai đoạn 1 (không làm trong lượt code kế tiếp)

- `src/pages/CheckIn/*`, scanner camera production
- Transfer ticket modal
- `WalletModal` alert (connect ví mock) — không thuộc luồng mua; có thể dọn sau
- Create Event `alert` — Giai đoạn 2

---

## 10. Tiêu chí xong Giai đoạn 1

- [ ] QR mock, disclaimer, payload không secret, envelope sẵn cho signed token
- [ ] Mua N vé = N record, unique `ticketId`/`ticketCode`, chung `orderId`
- [ ] Không mua vượt tồn; inventory localStorage + disclaimer không sync
- [ ] Checkout: “Phí mạng mô phỏng”; không fee on-chain giả; chưa có tx blockchain
- [ ] Search/filter chỉ dùng field đã có (sau khi Nam chốt mục 5)
- [ ] Toast khi fail; localStorage hỏng không làm sập app
- [ ] 5 nhóm test mục 7 pass

---

**Chờ xác nhận:** (1) map search/filter sang `venue`+`city`, `lineup`, `minPriceSol`/`priceSol`, `remainingQuantity` — **không** đổi schema mock; (2) phí mạng mô phỏng hiển thị `0 SOL` hay số minh họa có nhãn rõ; (3) hoãn Transfer Ticket. Sau xác nhận mới viết code.
