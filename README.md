# Little Heroes: Royal City Brawl

Game hành động đi cảnh ngang 2D (beat 'em up) cho trình duyệt — **Phaser 3 + TypeScript + Vite**, deploy lên **Vercel**.
Chọn **Đậu Đậu**, **Shu Shu** hoặc **Bắp**, chiến đấu qua 10 màn để ngăn Tiến sĩ Hắc Ảnh mở Cổng Hỗn Mang.

> Ba nhân vật chính và các đối thủ dùng khuôn mặt cắt trực tiếp từ ảnh tham chiếu (`tools/src/reference.png`).
> Thân, tay, chân được vẽ thủ tục và ghép thành "rối" (cut-out rig) để có hoạt cảnh đấm/đá/nhảy/né mượt mà.
> Toàn bộ đòn đánh là tay chân + kỹ năng võ thuật — không có súng/vũ khí (theo GDD).

## Yêu cầu

- Node.js ≥ 18 (đã kiểm thử với Node 22)
- npm

## Cài đặt & chạy

```bash
npm install          # cài phụ thuộc (phiên bản đã khóa trong package-lock.json)
npm run dev          # chạy dev server: http://localhost:5173
npm run typecheck    # kiểm tra TypeScript (strict)
npm test             # unit test (Vitest)
npm run build        # build production vào dist/
npm run preview      # xem thử bản build: http://localhost:4173
```

## Deploy lên Vercel

**Cách 1 – Dashboard:** đẩy thư mục này lên GitHub → vào vercel.com → *Add New Project* → chọn repo.
Vercel tự nhận cấu hình trong `vercel.json` (Framework: Vite, Build: `npm run build`, Output: `dist`). Bấm **Deploy**.

**Cách 2 – CLI:**

```bash
npm i -g vercel
vercel          # lần đầu: đăng nhập + tạo project
vercel --prod   # deploy production
```

Game là web tĩnh (không cần backend/database). Tiến trình và cài đặt được lưu bằng `localStorage`.

## Chơi Co-op online (2 người)

Menu → **🤝 Chơi cùng bạn (online)** → một người **Tạo phòng**, gửi mã/link mời cho người kia.
Hai máy kết nối thẳng với nhau (WebRTC qua PeerJS), máy chủ phòng chạy trận đấu, Vercel chỉ phát game
và chạy hàm nhỏ `api/ice.ts` (danh sách STUN/TURN).

Hướng dẫn đầy đủ (TURN miễn phí, luật chơi, sửa lỗi): **[docs/COOP.md](docs/COOP.md)**.

## Điều khiển

| Hành động | Bàn phím | Cảm ứng |
|---|---|---|
| Di chuyển (8 hướng, có trục sâu) | Phím mũi tên ◀▲▼▶ | Joystick ảo bên trái |
| Đánh thường / combo 3 đòn | **A** (hoặc J) | ĐÁNH |
| Kỹ năng đang chọn | **S** (hoặc K) | KỸ |
| Né / lướt (có khung bất tử) | **D** (hoặc L) | NÉ |
| Nhảy (A trên không = đòn nhảy) | **Z** (hoặc Space) | NHẢY |
| Tuyệt kỹ (100 EN) | **X** (hoặc U) | TUYỆT |
| Đổi kỹ năng | **C** (hoặc Q / I), hoặc phím 1-2-3 | ⟳ |
| Tạm dừng | Esc / P | nút II |
| Xác nhận menu | Enter / Space / A / Z | chạm |

Trên điện thoại hãy xoay ngang; khi màn hình dọc game hiện lời nhắc xoay máy. Nút cảm ứng có thể bật/tắt và chỉnh độ trong trong **Cài đặt**.

## Nội dung đã có

- Menu chính, chọn nhân vật (preview động tác trực tiếp), chọn màn, giới thiệu màn, tạm dừng, cài đặt, hướng dẫn, credits, màn kết quả (xếp hạng S/A/B/C), cảnh kết thúc chiến dịch.
- 3 nhân vật với chỉ số/moveset riêng (combo 3 đòn, đòn nhảy, 3 kỹ năng, tuyệt kỹ) đúng thông số GDD §5.
- 11 loại địch thường (Grunt, Runner, Brute có thế thủ, Leaper, Flyer, Spitter, Screamer, Robot, Summoner, Nhện con, Bản sao, Bản sao trùm) với AI telegraph → attack → recover và giới hạn số kẻ tấn công cùng lúc.
- 10 màn, mỗi màn ≥ 3 đợt quái, hazard riêng (biển hiệu rơi, kệ đổ, băng chuyền, tàu điện, hơi nóng, container, sàn điện, gió, sàn băng, băng rơi, laser quét, sóng Hỗn Mang), khu an toàn + checkpoint trước boss.
- 11 boss (Màn 9 có 2 boss song sinh) với nhiều giai đoạn, cảnh báo đòn ≥ 500 ms, cơ chế đặc biệt: trụ năng lượng giảm giáp, bản sao hồi máu, lò sưởi chống đóng băng, hộ vệ nổi giận, Hắc Ảnh biến hình + 3 trụ ở phase 3.
- Vật phẩm: cầu HP (+25), cầu EN (+20), ngôi sao (+100 điểm).
- 3 mạng mỗi màn, chơi lại từ checkpoint, gợi ý + tùy chọn hỗ trợ giảm 10% sát thương sau 3 lần thua.
- Âm thanh & nhạc nền tổng hợp bằng Web Audio (không cần file âm thanh), có chỉnh âm lượng.
- Accessibility: tắt rung màn hình, giảm nháy sáng, cảnh báo dùng hình dạng + dấu "!" (không chỉ màu đỏ).
- Chế độ Khó mở khóa sau khi phá đảo.

## Cấu trúc thư mục

```
public/assets/          ảnh cắt từ ảnh tham chiếu (đầu nhân vật, portrait, đầu địch, thẻ bối cảnh)
src/
  art/                  vẽ thủ tục: thân/tay/chân, đầu địch phụ, hiệu ứng, đạo cụ, background 10 màn
  rig/                  Rig (rối cut-out), Poses, CreatureView (nhện/cua/dơi)
  config/               characters, moves, enemies, bosses, stages — toàn bộ chỉ số nằm ở đây
  combat/               DamageSystem, ComboSystem, SkillSystem (EN/cooldown), Hitbox, CombatSystem
  entities/             Actor, Player, Enemy, Boss, Projectile, Pickup, Pillar, Npc
  ai/                   EnemyAI, BossAI
  systems/              GameWorld, StageManager, WaveTracker, HazardSystem, TelegraphSystem,
                        EffectsSystem (pooling), InputSystem, SaveSystem, AudioSystem
  input/                KeyboardController, TouchController
  ui/                   HUD components, VirtualJoystick, MenuComponents, Backdrop
  scenes/               Boot, Preload, Menu, CharacterSelect, StageSelect, StageIntro, Game, HUD,
                        Pause, Settings, Result, Ending, Info
tests/                  Vitest unit tests (damage, EN, combo, hitbox, waves, save, config)
tools/                  extract.py (cắt + tách nền ảnh tham chiếu), script kiểm thử tự động
```

## Thay asset

- **Khuôn mặt nhân vật/địch:** thay các file PNG trong `public/assets/characters` và `public/assets/enemies`
  (giữ tên file; nền trong suốt). Chiều cao hiển thị & điểm neo cổ chỉnh trong `src/art/registry.ts → HEADS`.
- **Màu trang phục:** `src/config/characters.ts → palette` và `src/art/registry.ts → PART_SPECS`.
- **Background:** hiện được vẽ thủ tục trong `src/art/BackgroundArt.ts`. Để dùng ảnh vẽ tay, nạp 3 layer
  (`bg-<theme>-far/mid/floor`) trong `PreloadScene` — `paintBackground` sẽ bỏ qua khi texture đã tồn tại.
- **Âm thanh:** `src/systems/AudioSystem.ts` (có thể thay bằng file OGG/MP3 qua `this.load.audio`).
- Danh sách đầy đủ asset & trạng thái: xem `ASSET_MANIFEST.md`.
- Tạo lại ảnh cắt từ ảnh tham chiếu: `pip install rembg onnxruntime pillow scipy` rồi `cd tools && python3 heads.py && python3 extract.py`.

## Chơi toàn màn hình trên điện thoại

- **Android (Chrome):** chạm lần đầu là game tự vào toàn màn hình và khóa ngang; có nút ⛶ ở menu và trong trận.
- **iPhone (Safari):** Safari không cho trang web toàn màn hình → bấm **Chia sẻ → Thêm vào Màn hình chính**, mở từ biểu tượng đó (game là PWA, `display: fullscreen`).

## Ứng dụng Android (APK)

Project Android (Capacitor) đã có sẵn trong `android/`: xoay ngang, toàn màn hình, chơi offline, Co-op online vẫn chạy.
Build APK ngay trên GitHub (**Actions → Android APK → Run workflow**) hoặc bằng Android Studio
(`npm run android:sync` → `npm run android:open`). Hướng dẫn đầy đủ: **[docs/ANDROID.md](docs/ANDROID.md)**.

## Ghi chú kỹ thuật

- Logic game chạy theo "thời gian thế giới" riêng (`GameWorld.now`), nên tạm dừng sẽ dừng mọi timer, telegraph, hazard.
- Không dùng `setTimeout` cho combat; hitbox chỉ tồn tại trong active frames và mỗi hit chỉ trúng một mục tiêu một lần.
- Thêm `?renderer=canvas` vào URL để ép dùng Canvas renderer (debug / máy rất yếu).
