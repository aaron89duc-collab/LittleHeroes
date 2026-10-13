# Chơi Co-op online (2 người) — hướng dẫn cài đặt

Hai người, mỗi người một máy (máy tính hoặc điện thoại), vào cùng một phòng bằng **mã phòng 5 ký tự**
và cùng đánh qua các màn. Game vẫn chỉ deploy trên **Vercel**, không cần thuê server.

## Cách hoạt động

```
Máy chủ phòng (P1) ◀═══ WebRTC (kết nối thẳng giữa 2 máy) ═══▶ Máy khách (P2)
  chạy toàn bộ trận đấu                                     gửi phím bấm, vẽ lại hình nhận được
          │                                                         │
          └──── chỉ lúc tìm nhau: PeerJS Cloud (0.peerjs.com, miễn phí) ┘
          └──── /api/ice (Vercel Function): danh sách STUN/TURN ───────┘
```

- **Chủ phòng** chạy toàn bộ trận đấu: quái, trùm, sát thương, vật phẩm. Khoảng 20 lần/giây, máy chủ phòng gửi
  "bức tranh" hiện tại (vị trí, khung hình, chữ, hiệu ứng), số máu/điểm, âm thanh và thông báo cho máy khách.
- **Máy khách** gửi phím bấm cho chủ phòng. Máy khách tự vẽ nền, mưa/tuyết và thanh trạng thái riêng, và làm mượt chuyển động.
- Dữ liệu trận đấu đi **thẳng giữa 2 máy**, không qua Vercel. Mỗi trận dùng khoảng 20–40 KB/giây.
- **PeerJS Cloud** chỉ giúp hai máy tìm thấy nhau theo mã phòng.
- **STUN/TURN** giúp đi qua router/NAT. Khoảng 80–90% trường hợp chỉ cần STUN (miễn phí). Một số mạng 4G
  hoặc mạng công ty chặn kết nối thẳng thì cần TURN (máy chủ chuyển tiếp).

## 1. Cập nhật code & cài thư viện

```bash
npm install          # cài thêm peerjs (đã có trong package.json)
npm run build        # kiểm tra build
```

Đẩy code lên git, Vercel tự build lại. File `api/ice.ts` được Vercel tự nhận là **Function**
(đường dẫn `/api/ice`), không cần cấu hình gì thêm.

Kiểm tra sau khi deploy: mở `https://<tên-dự-án>.vercel.app/api/ice`. Trang phải trả về JSON dạng
`{"iceServers":[{"urls":["stun:stun.l.google.com:19302", ...]}]}`.

## 2. (Nên làm) Thêm TURN miễn phí để chơi được trên mọi mạng

Chọn **một** trong hai nhà cung cấp, rồi vào **Vercel → Project → Settings → Environment Variables**
thêm biến tương ứng (áp dụng cho *Production* và *Preview*). Sau đó vào **Deployments → Redeploy**.

### Cách A — Cloudflare Realtime TURN
1. Đăng nhập https://dash.cloudflare.com → mục **Realtime** → **TURN** → tạo TURN key mới (**Create**).
2. Đặt tên (ví dụ `little-heroes`) và tạo. Cloudflare hiện **Turn Token ID** và **API Token**. Chép lại cả hai,
   vì API Token chỉ hiện một lần.
3. Thêm biến môi trường trên Vercel:
   | Name | Value |
   |---|---|
   | `CF_TURN_KEY_ID` | Turn Token ID |
   | `CF_TURN_API_TOKEN` | API Token |

### Cách B — Metered.ca
1. Đăng ký https://www.metered.ca, tạo app (ví dụ `littleheroes` → tên miền `littleheroes.metered.live`).
2. Trong trang quản lý TURN của app, tạo một **API Key** (giao diện có thể đổi tên mục theo thời gian).
3. Thêm biến môi trường trên Vercel:
   | Name | Value |
   |---|---|
   | `METERED_APP` | `littleheroes` (phần trước `.metered.live`) |
   | `METERED_API_KEY` | API key |

> Khóa bí mật chỉ nằm trên Vercel. Trình duyệt chỉ nhận mật khẩu TURN tạm thời từ `/api/ice`.
> Mở lại `/api/ice` sau khi redeploy: kết quả phải có thêm các dòng `turn:...` kèm `username`/`credential`.

Đã có TURN server riêng thì dùng `TURN_URLS` (cách nhau bởi dấu phẩy), `TURN_USERNAME`, `TURN_CREDENTIAL`.

## 3. Cách chơi

1. Người 1: **Menu → 🤝 Chơi cùng bạn (online) → ➕ Tạo phòng**. Game hiện mã phòng, ví dụ `K7QX2`.
2. Bấm **📋 Sao chép link mời** rồi gửi link (dạng `…vercel.app/?room=K7QX2`) qua Zalo/Messenger.
   Người 2 mở link là tự vào phòng. Người 2 cũng có thể vào **Chơi cùng bạn** và gõ mã.
3. Mỗi người chọn nhân vật (2 người có thể chọn trùng). Chủ phòng chọn màn (theo các màn chủ phòng đã mở)
   rồi bấm **▶ BẮT ĐẦU**.
4. Hết màn, cả hai quay lại phòng chờ, xem kết quả và chơi màn tiếp theo. Màn thắng được lưu vào máy của cả hai người.

### Luật Co-op
- **Mạng dùng chung** (3 mạng). Khi hết mạng mà đồng đội vẫn còn đứng: người gục nằm chờ. Đồng đội đứng sát người gục
  khoảng 1,6 giây sẽ **đỡ dậy** (người gục hồi 50% máu). Thua khi cả hai cùng gục.
- Quái thường có máu ×1,4, trùm có máu ×1,6. Tối đa 3 quái được tấn công cùng lúc (chơi một mình là 2).
- Camera giữ cả hai trong khung hình, không ai chạy được ra khỏi màn hình. Vùng chơi lấy theo màn hình hẹp hơn
  trong hai máy, nên hai người luôn thấy hết như nhau.
- Mỗi người chỉ bị rung hoặc chớp đỏ màn hình khi nhân vật của **mình** trúng đòn.

### Tạm dừng / thoát
- **Chủ phòng** bấm tạm dừng (Esc / P / nút II) thì trận dừng cho cả hai. Máy khách thấy chữ "Chủ phòng đang tạm dừng".
  Chủ phòng chuyển sang tab khác hoặc khóa màn hình điện thoại cũng làm trận tự dừng.
- **Máy khách** bấm tạm dừng chỉ mở menu (Tiếp tục / Âm thanh / Rời phòng), trận đấu vẫn chạy.
- Máy khách mất mạng hoặc thoát: chủ phòng **chơi tiếp một mình**. Phòng vẫn mở, xong màn bạn có thể vào lại bằng mã cũ.
- Chủ phòng thoát: máy khách quay về phòng chờ kèm thông báo.

### Lưu ý
- Chủ phòng nên dùng máy mạnh hơn (máy tính hoặc điện thoại đời mới) và mạng ổn định, vì máy đó chạy cả trận.
- Ping hiện dưới thanh máu. Dưới 100 ms là chơi mượt.
- Bản xem thử trên Claude (artifact) **không** chơi online được, vì trang đó chặn kết nối ra ngoài. Hãy dùng bản trên Vercel.

## 4. Sửa lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| "Không tìm thấy phòng này" | Kiểm tra mã. Chủ phòng phải đang ở màn hình hiện mã phòng. |
| Kết nối mãi không xong / hết thời gian | Một trong hai mạng chặn kết nối thẳng → làm **bước 2 (TURN)**. Thử đổi wifi ↔ 4G. |
| `/api/ice` báo 404 | Thư mục `api/` chưa lên git, hoặc Vercel chưa deploy lại. |
| `/api/ice` không có dòng `turn:` | Sai tên biến môi trường, hoặc chưa Redeploy sau khi thêm biến. |
| Máy khách bị đứng hình | Chủ phòng đã chuyển tab hoặc khóa máy → quay lại game. |

## 5. (Tùy chọn) Dùng PeerJS server riêng

Mặc định game dùng PeerJS Cloud miễn phí để hai máy tìm nhau. Muốn tự chạy server riêng (`npx peer --port 9000`
trên VPS, đặt sau HTTPS), khai báo trên Vercel rồi Redeploy:

| Name | Ví dụ |
|---|---|
| `VITE_PEER_HOST` | `peer.tenmien.vn` |
| `VITE_PEER_PORT` | `443` |
| `VITE_PEER_PATH` | `/` |
| `VITE_PEER_SECURE` | `true` |

## Các file liên quan

| File | Vai trò |
|---|---|
| `src/net/Net.ts` | Kết nối PeerJS/WebRTC: tạo/vào phòng, gửi/nhận tin, ping, phát hiện rớt mạng |
| `src/net/Mirror.ts` | Chủ phòng chụp "bức tranh" (chỉ phần thay đổi), máy khách dựng lại và làm mượt |
| `src/net/CoopHost.ts` | Phía chủ phòng: nhận phím của P2, gửi hình/thanh trạng thái/âm thanh 20 lần/giây |
| `src/scenes/CoopLobbyScene.ts` | Phòng chờ (giao diện HTML: mã phòng, chọn nhân vật, chọn màn) |
| `src/scenes/CoopGuestScene.ts` | Màn chơi phía máy khách |
| `api/ice.ts` | Vercel Function trả danh sách STUN/TURN |
