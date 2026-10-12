# ASSET MANIFEST

Trạng thái: **Ref** = cắt từ ảnh tham chiếu của người dùng · **Proc** = vẽ thủ tục bằng code lúc chạy · **Synth** = âm thanh tổng hợp · **Cần bổ sung** = nên thay bằng artwork/âm thanh cuối.

Game chơi được trọn vẹn với bộ asset hiện tại. Các mục "Proc" là placeholder chất lượng cao, có thể thay dần.

## Nhân vật chính

| Key | File / nguồn | Kích thước | Trạng thái | Ghi chú |
|---|---|---|---|---|
| head-dau-dau | public/assets/characters/dau-dau-head.png | 280×316 | Ref | Tóc xanh, tai mèo, ria mèo |
| head-shu-shu | public/assets/characters/shu-shu-head.png | 350×302 | Ref | Tóc nâu, kính, tai chó |
| head-bap | public/assets/characters/bap-head.png | 374×328 | Ref | Tóc nâu búi, kính, tai gấu |
| portrait-* | public/assets/characters/*-portrait.png | 210–226×324 | Ref | Thẻ chọn nhân vật (cắt phía trên súng trong ảnh gốc) |
| face-* | tạo từ head-* | 128×128 | Proc | Huy hiệu tròn trên HUD |
| rig-<id>-torso/upperArm/forearm/thigh/shin | src/art/PartArt.ts | ~48×46 (×2 supersample) | Proc | Áo đồng phục + áo giáp "POLICE", găng, ủng |
| tail-shu-shu | src/art/PartArt.ts | 40×30 | Proc | Đuôi lông xù |

Hoạt cảnh (rig + poses, `src/rig/Poses.ts`): idle, walk, jump (lên/xuống), punchA, punchB, hook, kickSide, lowKick,
sweep, jumpKick, stomp, dashStrike, multiKick, spinKick, shadowStep, palmWave, shoulder, shoulderDash, groundPound,
grabThrow, ultimate, dodge, hurt, knockdown, getup, frozen, victory.
**Cần bổ sung (tùy chọn):** sprite sheet vẽ tay 160×160 cho từng animation nếu muốn thay rig.

## Đối thủ

| Key | Nguồn | Trạng thái | Dùng cho |
|---|---|---|---|
| head-thug | Ref (Tội phạm đường phố) | Ref | Grunt |
| head-punk | Ref (Côn đồ) | Ref | Runner, Người Khổng Lồ |
| head-boss | Ref (Trùm cuối) | Ref | Brute, Bản sao trùm, Kẻ Cầm Đầu Phố |
| head-swat | Ref (Đặc nhiệm) | Ref | Leaper, Băng Vương |
| head-masked | Ref (Cướp) | Ref | Screamer, Hộ Vệ Thạch |
| head-robot | Ref (Robot) | Ref | Robot an ninh, Gấu Máy |
| head-sniper | Ref (Tay súng tỉa) | Ref | Summoner, Hộ Vệ Phong |
| head-mutant / head-scientist / head-shadow / head-civ0-2 | MiscArt.ts | Proc | Quái nhổ độc, Tiến Sĩ Điên, Hắc Ảnh, người dân |
| rig-* (thân địch) | registry.ts PART_SPECS | Proc | Áo ba lỗ, giáp, áo blouse, áo choàng... |
| enemy-bat-body / enemy-bat-wing | MiscArt.ts | Proc | Dơi máy, Dơi Chúa |
| Nhện Chúa, Thủy Quái | CreatureView.ts | Proc | Vẽ động bằng Graphics |

**Cần bổ sung (tùy chọn):** boss sprite 256–320px vẽ tay cho Nhện Chúa, Thủy Quái, Dơi Chúa, Hắc Ảnh dạng quái.

## Bối cảnh (3 layer parallax / màn)

| Theme | Màn | Layer far / mid / floor | Thẻ giới thiệu |
|---|---|---|---|
| street | 1 | Proc | card-city (Ref) |
| mall | 2 | Proc | render từ background |
| subway | 3 | Proc (có đường ray cho tàu) | card-subway (Ref) |
| factory | 4 | Proc | card-factory (Ref) |
| port | 5 | Proc | card-port (Ref) |
| lab | 6 | Proc | render từ background |
| rooftop | 7 | Proc | render từ background |
| ice | 8 | Proc | card-ice (Ref) |
| tower | 9 | Proc | card-tower (Ref) |
| chaos | 10 | Proc | render từ background |

Kích thước: far 1280×720, mid 1280×452 (lặp ngang), floor 512×308 (lặp ngang).
**Cần bổ sung (tùy chọn):** background vẽ tay WebP cùng kích thước.

## Hiệu ứng, vật phẩm, đạo cụ (Proc)

fx-shadow, fx-spark, fx-glow, fx-ring, fx-slash, fx-dust, fx-rain, fx-snow, fx-orb, fx-sonic,
pickup-health, pickup-energy, pickup-token, prop-sign, prop-icicle, prop-container, prop-shelf, prop-train,
prop-pillar, prop-heater, prop-vent.

## Âm thanh (Synth — `src/systems/AudioSystem.ts`)

SFX: punch, kick, heavy, whoosh, hurt, enemyHurt, down, jump, land, dodge, skill, ultimate, pickup, coin, warning,
explosion, roar, spit, train, freeze, ui, confirm, victory, defeat, guard, break.
Nhạc: 10 nhạc nền theo màn + 1 nhạc menu (sequencer).
**Cần bổ sung (tùy chọn):** file OGG/MP3 thu âm/sáng tác riêng.

## Font

"Baloo 2" (Google Fonts, hỗ trợ tiếng Việt) — tự fallback sang font hệ thống nếu không tải được.
