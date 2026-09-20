# BÁO CÁO AUDIT TOÀN BỘ CHỨC NĂNG DỰ ÁN UNITICKET (WEB3 SOLANA)

> **Dự án:** UniTicket - Website Bán Vé Sự Kiện & Hòa Nhạc NFT trên Solana  
> **Cuộc thi:** UniHackFest  
> **Thời điểm Audit:** 19/09/2026  
> **Mục tiêu:** Rà soát toàn bộ source code hiện tại, phân loại chính xác các chức năng đã có, đang hoạt động, chỉ là giao diện mẫu (Mockup/Placeholder) hoặc còn thiếu, từ đó đề xuất lộ trình triển khai rõ ràng giữa Frontend Mock, Backend và Blockchain.

---

## 1. BẢNG TIÊU CHÍ PHÂN LOẠI
- **[A] Đã hoàn thành và hoạt động:** Đã có giao diện hoàn chỉnh, dữ liệu và tương tác người dùng hoạt động trơn tru.
- **[B] Đã có UI nhưng chưa có logic thật:** Đã hiển thị giao diện mẫu (mockup/placeholder) nhưng chưa có logic xử lý nghiệp vụ, chưa lưu dữ liệu hoặc chỉ có thông báo tĩnh.
- **[C] Chưa có:** Hoàn toàn chưa có mã nguồn hoặc giao diện cho tính năng này.
- **[D] Có lỗi hoặc chưa hoàn thiện:** Đã có nhưng còn lỗi, thiếu sót hoặc chưa đạt chuẩn trải nghiệm.

---

## 2. KẾT QUẢ AUDIT CHI TIẾT THEO PHÂN HỆ

### PHÂN HỆ 1: KHÁCH HÀNG (CUSTOMER)

| STT | Chức năng | Trạng thái | Hiện trạng trong Codebase | Đánh giá & Khoảng cách (Gap) |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Home Page** | **[A]** | File `src/pages/Home/index.tsx`, `HeroSection.tsx`, `FeaturedEvents.tsx`, `NFTBenefits.tsx`. | Hoạt động mượt mà: Hero banner, đồng hồ đếm ngược thời gian thực, danh sách concert nổi bật, lọc danh mục, hiệu ứng ánh sáng Web3. |
| 2 | **Events (Danh sách sự kiện)** | **[B]** | Tab `events` trong `src/App.tsx`. | Đã hiển thị dạng lưới các sự kiện từ `mockEvents`. Chưa có thanh tìm kiếm (Search Bar), chưa có lọc theo giá SOL / ngày tháng / địa điểm, chưa có phân trang. |
| 3 | **Event Details (Chi tiết sự kiện)** | **[B]** | Tab `event-detail` trong `src/App.tsx`. | Đã hiển thị banner lớn, thời gian, địa điểm, nghệ sĩ line-up, các hạng vé. Chưa có URL động (`/events/:id`), chưa có sơ đồ khán đài/ghế ngồi tương tác. |
| 4 | **Search & Filter** | **[B]** | Bộ lọc phân loại trong `FeaturedEvents.tsx`. | Chỉ lọc cứng theo 5 danh mục thể loại trên Home. Chưa có ô tìm kiếm theo tên ca sĩ/tên show, chưa có bộ lọc kết hợp đa tiêu chí. |
| 5 | **Select Ticket (Chọn vé)** | **[B]** | Khối chọn hạng vé trong `event-detail`. | Hiển thị các hạng vé (GA, VIP, VVIP) kèm giá SOL và đặc quyền. Nút bấm chỉ mở popup ví, chưa có bộ đếm số lượng (+/-), chưa tính tổng tiền. |
| 6 | **Checkout (Thanh toán / Đặt vé)** | **[C]** | Chưa có file hoặc component. | Chưa có giỏ hàng, chưa có form nhập thông tin người nhận vé, chưa có tóm tắt chi phí (Order Summary) và phí mạng Solana. |
| 7 | **Connect Wallet** | **[B]** | Component `WalletModal.tsx` và nút trên `Navbar.tsx`. | Đã có giao diện modal hiển thị Phantom, Solflare, Backpack. Khi bấm chỉ hiển thị alert thông báo mô phỏng, chưa kết nối Web3 thật. |
| 8 | **My Tickets (Bộ sưu tập vé của tôi)** | **[B]** | Tab `my-tickets` trong `src/App.tsx`. | Hiển thị 1 thẻ vé Holographic mẫu cố định. Chưa có danh sách nhiều vé, chưa lưu trữ vé đã mua vào `localStorage`, chưa lọc vé sắp diễn ra / đã dùng. |
| 9 | **QR Ticket (Mã QR check-in)** | **[B]** | Thẻ vé trong `src/App.tsx`. | Đang dùng icon tĩnh `QrCode` từ thư viện lucide-react. Chưa tích hợp thư viện tạo mã QR SVG thật (`qrcode.react`), chưa có mã hóa token bảo mật. |
| 10 | **Transfer Ticket (Chuyển nhượng vé)** | **[C]** | Chưa có file hoặc component. | Chưa có giao diện gửi tặng vé sang địa chỉ ví khác, chưa có tính năng niêm yết bán lại (P2P Resale Marketplace). |

---

### PHÂN HỆ 2: BAN TỔ CHỨC (ORGANIZER)

| STT | Chức năng | Trạng thái | Hiện trạng trong Codebase | Đánh giá & Khoảng cách (Gap) |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Create Event (Tạo sự kiện mới)** | **[B]** | Tab `create-event` trong `src/App.tsx`. | Mới có form mẫu với 3 trường disabled (Tên sự kiện, thể loại, giá khởi điểm). Chưa có form tạo đa bước đầy đủ, chưa cho upload ảnh banner, chưa cấu hình ngày giờ. |
| 2 | **Manage Events (Quản lý sự kiện đã tạo)** | **[C]** | Chưa có file hoặc component. | Chưa có bảng danh sách các sự kiện do ban tổ chức tạo, chưa có chức năng sửa thông tin, tạm ngưng bán vé hoặc hủy sự kiện. |
| 3 | **Ticket Types (Cấu hình hạng vé)** | **[C]** | Có type `TicketTier` trong `types/index.ts`. | Chưa có giao diện cho Organizer tự tạo các hạng vé linh hoạt (Early Bird, Standard, VIP Pass, đặt số lượng và quyền lợi riêng). |
| 4 | **Ticket Inventory (Quản lý kho vé)** | **[C]** | Chưa có file hoặc component. | Chưa có theo dõi tồn kho vé thời gian thực, chưa có cơ chế giữ chỗ tạm thời (lock ticket trong 10 phút thanh toán). |
| 5 | **Sales Dashboard (Bảng điều khiển doanh thu)** | **[C]** | Chưa có file hoặc component. | Hoàn toàn chưa có dashboard thống kê tổng doanh thu SOL, số vé đã bán, biểu đồ doanh thu theo ngày và tỷ lệ check-in. |

---

### PHÂN HỆ 3: NHÂN VIÊN SOÁT VÉ (STAFF / GATEKEEPER)

| STT | Chức năng | Trạng thái | Hiện trạng trong Codebase | Đánh giá & Khoảng cách (Gap) |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **QR Scanner (Camera quét mã vé)** | **[C]** | Chưa có file hoặc component. | Chưa có màn hình sử dụng camera điện thoại/laptop để quét mã QR tại cổng soát vé sân vận động. |
| 2 | **Ticket Verification (Xác thực tính hợp lệ)** | **[C]** | Chưa có logic xác thực. | Chưa có hàm kiểm tra mã vé xem có khớp với sự kiện không, vé còn hạn hay đã bị hủy. |
| 3 | **Check-in (Chấp nhận vào cổng)** | **[C]** | Chưa có logic cập nhật. | Chưa có cơ chế chuyển trạng thái vé từ `VALID` thành `CHECKED_IN` để chống tái sử dụng vé. |
| 4 | **Scan History (Lịch sử quét vé)** | **[C]** | Chưa có file hoặc component. | Chưa có nhật ký ghi nhận các lượt quét (thời gian quét, cổng quét, số lượt thành công / thất bại). |

---

### PHÂN HỆ 4: HỆ THỐNG & HẠ TẦNG (SYSTEM)

| STT | Chức năng | Trạng thái | Hiện trạng trong Codebase | Đánh giá & Khoảng cách (Gap) |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Routing (Điều hướng trang)** | **[D]** | Dùng `useState('home')` trong `src/App.tsx`. | Chưa dùng thư viện router chuẩn (`react-router-dom`). Không có URL trực tiếp (`/events`, `/events/123`), khi ấn Refresh (F5) trang bị quay về trang chủ. |
| 2 | **Data Model (Mô hình dữ liệu)** | **[A]** | File `src/types/index.ts` và `src/data/mockEvents.ts`. | Rất đầy đủ và rõ ràng: `EventItem`, `TicketTier`, `NFTTicket`. Cấu trúc chuẩn hóa cao. |
| 3 | **Authentication (Xác thực đăng nhập)** | **[C]** | Chưa có. | Chưa có hệ thống tài khoản, chưa có Sign-in with Solana (SIWS) hoặc Session lưu trữ. |
| 4 | **Role-based Access (Phân quyền người dùng)** | **[C]** | Chưa có. | Mọi người dùng đều thấy chung một giao diện, chưa tách quyền Customer / Organizer / Staff. |
| 5 | **Error Handling (Xử lý lỗi & Thông báo)** | **[D]** | Đang dùng `alert()` mặc định của trình duyệt. | Chưa có React Error Boundary, chưa có Toast Notification (thông báo popup góc màn hình) chuyên nghiệp. |
| 6 | **Responsive UI (Đa thiết bị)** | **[A]** | Toàn bộ các file components và `index.css`. | Đạt chuẩn xuất sắc: Hoạt động mượt trên Desktop, Tablet, Mobile; không bị lỗi tràn chữ (Text Overflow) sau đợt tối ưu. |

---

## 3. TỔNG HỢP TỶ LỆ HOÀN THIỆN HIỆN TẠI

- **[A] Đã hoàn thành và hoạt động:** 3 / 25 chức năng (~12%)  
  *(Home Page, Data Model, Responsive UI)*
- **[B] Đã có UI nhưng chưa có logic thật (Mockup / Preview):** 7 / 25 chức năng (~28%)  
  *(Events List, Event Details, Filter cơ bản, Select Ticket, Connect Wallet, My Tickets, Create Event preview)*
- **[C] Chưa có:** 13 / 25 chức năng (~52%)  
  *(Checkout, Transfer, Manage Events, Ticket Types, Inventory, Sales Dashboard, QR Scanner, Verification, Check-in, Scan History, Auth, Role Access)*
- **[D] Cần hoàn thiện / Tái cấu trúc:** 2 / 25 chức năng (~8%)  
  *(Routing sang React Router, Toast Notifications thay cho browser alert)*

---

## 4. PHÂN TÁCH TRÁCH NHIỆM KIẾN TRÚC (ARCHITECTURE BREAKDOWN)

Để dự án phát triển bài bản và không bị lẫn lộn giữa các tầng công nghệ, chúng ta phân định rõ:

### Tầng 1: Frontend Mock (Giao diện & Trải nghiệm tương tác người dùng)
- **Mục đích:** Giúp ban giám khảo UniHackFest trải nghiệm toàn bộ luồng nghiệp vụ mượt mà trên máy tính và điện thoại mà không cần thiết lập blockchain phức tạp.
- **Công nghệ:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React, `qrcode.react`, `react-router-dom`.
- **Cơ chế lưu trữ:** `localStorage` (lưu giỏ hàng, vé đã mua, sự kiện mới tạo và trạng thái check-in giả lập).

### Tầng 2: Backend & Database (Máy chủ lưu trữ tập trung - Triển khai sau)
- **Mục đích:** Đồng bộ dữ liệu giữa nhiều người dùng thực tế (khán giả mua vé trên điện thoại, ban tổ chức quản lý trên máy tính, nhân viên quét vé tại cổng).
- **Công nghệ đề xuất:** Node.js / Express hoặc Next.js API Routes, cơ sở dữ liệu PostgreSQL / MongoDB / Supabase.
- **Chức năng:** Lưu trữ thông tin sự kiện, quản lý đơn hàng, cấp mã QR có chữ ký số (Signed QR Token), ghi log lịch sử soát vé.

### Tầng 3: Solana Blockchain (Mạng phi tập trung Web3 - Triển khai sau)
- **Mục đích:** Đảm bảo tính độc bản, chống vé giả và thanh toán phi tập trung.
- **Công nghệ đề xuất:** `@solana/web3.js`, `@solana/wallet-adapter-react`, Metaplex Core / Candy Machine (chuẩn NFT vé Solana).
- **Chức năng:** Ký ví Phantom thanh toán bằng SOL, mint NFT vé trực tiếp vào ví người mua, smart contract tự động trích 5% phí bản quyền khi vé được chuyển nhượng.

---

## 5. ĐỀ XUẤT LỘ TRÌNH TRIỂN KHAI THEO THỨ TỰ ƯU TIÊN

### 🚀 GIAI ĐOẠN 1: HOÀN THIỆN TOÀN BỘ LUỒNG KHÁCH HÀNG (CUSTOMER FLOW - Ưu tiên số 1)

Plan chi tiết (ràng buộc QR mock, 1 vé = 1 record, inventory, phí mạng mô phỏng, mock fields, Toast, tests): xem `IMPLEMENTATION_PLAN.md`. Chưa viết code cho đến khi được xác nhận.

1. **Nâng cấp Hệ Thống Điều Hướng (React Router):**
   - Thiết lập các đường dẫn chuẩn: `/` (Home), `/events` (Danh sách), `/events/:id` (Chi tiết), `/my-tickets` (Vé của tôi). `/organizer` và `/scanner` không phải tiêu chí đóng Giai đoạn 1.
2. **Trang Danh Sách Sự Kiện (Events Explorer):**
   - Tìm kiếm / lọc chỉ trên field hiện có trong `mockEvents` (xem báo cáo trong `IMPLEMENTATION_PLAN.md` mục 5). Không tự thêm `artists`, `location`, `price`.
3. **Trang Chi Tiết & Mua Vé (Ticket Booking & Checkout Modal):**
   - Cho phép chọn số lượng vé (+/-), tính tổng theo `priceSol`, kiểm tra `remainingQuantity` trước khi xác nhận.
   - Checkout là **mô phỏng**: nhãn **“Phí mạng mô phỏng”**, không trình bày số SOL như phí giao dịch on-chain thật, ghi rõ giao dịch chưa diễn ra trên Blockchain. Không CTA “Mint Vé NFT” như thể đã mint.
4. **Trang Vé Của Tôi & QR Frontend Mock:**
   - Render QR từ payload mock (`qrcode.react`). Không tuyên bố chống giả / xác thực bảo mật. Không nhúng private key / seed. Envelope dữ liệu để sau thay Signed QR Token từ Backend.
   - Mua N vé → N `PurchasedTicket` (mỗi vé `ticketId` + `ticketCode` riêng, chung `orderId`). Lưu `localStorage` (không đồng bộ đa thiết bị).
   - Transfer Ticket: hoãn Giai đoạn sau; chỉ giữ chỗ field `status`.

### 🏢 GIAI ĐOẠN 2: PHÂN HỆ BAN TỔ CHỨC (ORGANIZER DASHBOARD - Ưu tiên số 2)
1. **Form Tạo Sự Kiện Hoàn Chỉnh:**
   - Tạo biểu mẫu 3 bước: Thông tin chung -> Tạo các hạng vé & số lượng -> Xuất bản.
   - Cho phép chọn ảnh bìa, ngày giờ, địa điểm và lưu sự kiện mới vào danh sách.
2. **Trang Bảng Điều Khiển Quản Lý Sự Kiện (Organizer Dashboard):**
   - Bảng thống kê: Tổng doanh thu SOL, số vé đã bán, số vé còn lại.
   - Danh sách sự kiện do mình tổ chức với nút sửa / đóng bán vé.

### 📱 GIAI ĐOẠN 3: PHÂN HỆ NHÂN VIÊN SOÁT VÉ (STAFF SCANNER - Ưu tiên số 3)
1. **Màn Hình Quét Mã QR (QR Scanner):**
   - Tích hợp camera điện thoại hoặc nút mô phỏng quét mã vé.
   - Kiểm tra mã vé: Nếu hợp lệ -> Đổi trạng thái vé sang `CHECKED_IN`, phát âm thanh/hiệu ứng thành công màu xanh.
   - Nếu mã vé đã dùng rồi -> Cảnh báo màu đỏ: *"Cảnh báo: Vé đã được check-in lúc 18:30!"*.
2. **Lịch Sử Soát Vé:**
   - Hiển thị danh sách khách đã vào cổng theo thời gian thực.

### 🌐 GIAI ĐOẠN 4 & 5: BACKEND & BLOCKCHAIN (Tích hợp thực tế)
- Tích hợp kết nối ví Phantom thật qua Solana Wallet Adapter.
- Triển khai Smart Contract trên Solana Devnet.
