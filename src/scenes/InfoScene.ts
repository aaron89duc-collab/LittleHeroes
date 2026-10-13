import Phaser from 'phaser';
import { FONT } from '../game/constants';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, MenuNav, panel, title } from '../ui/MenuComponents';

const HELP = [
  ['Di chuyển', 'A/D hoặc ◀▶: trái/phải • W/S hoặc ▲▼: tiến/lùi • Cảm ứng: joystick bên trái'],
  ['Đánh thường (J)', 'Nhấn liên tiếp để nối combo 3 đòn. Combo đứt nếu quá 0,7 giây không đánh tiếp.'],
  ['Nhảy (Space)', 'Nhấn J khi đang nhảy để tung đòn trên không. Nhảy để tránh sóng xung kích và laser.'],
  ['Né (L)', 'Lướt nhanh có khung bất tử ngắn. Hồi chiêu 0,55 giây.'],
  ['Kỹ năng (K)', 'Dùng kỹ năng đang chọn, tốn năng lượng (EN). Đổi kỹ năng bằng I/Q hoặc phím 1-2-3.'],
  ['Tuyệt kỹ (U)', 'Khi thanh EN đầy 100: tung chiêu cuối cực mạnh, bất tử trong lúc thi triển.'],
  ['Năng lượng', 'Đánh trúng +4 EN, đòn kết +7 EN, bị đánh +2 EN. Nhặt cầu xanh để +20 EN.'],
  ['Vật phẩm', 'Cầu đỏ +25 HP • Cầu xanh +20 EN • Ngôi sao +100 điểm.'],
  ['Cảnh báo', 'Vùng có dấu "!" và viền nhấp nháy sắp bị tấn công — hãy né ra ngoài!'],
  ['Tạm dừng', 'Esc / P hoặc nút II trên màn hình.'],
];

const CREDITS = [
  'LITTLE HEROES: ROYAL CITY BRAWL',
  '',
  'Thiết kế nhân vật: ảnh tham chiếu do người dùng cung cấp',
  '(Đậu Đậu, Shu Shu, Bắp và các đối thủ)',
  'Bối cảnh, boss, biểu tượng, chân dung chỉ huy: CraftPix.net (gói free của người dùng)',
  'Lập trình, đồ họa thủ tục & âm thanh tổng hợp: Claude',
  'Engine: Phaser 3 + TypeScript + Vite',
  '',
  'Toàn bộ tên gọi, cốt truyện, hình ảnh và âm thanh là nội dung riêng.',
  '',
  'Cảm ơn bạn đã chơi!',
];

export class InfoScene extends Phaser.Scene {
  constructor() {
    super('InfoScene');
  }

  create(d: { page: 'help' | 'credits' }): void {
    new Backdrop(this, d.page === 'help' ? 'subway' : 'chaos', 0.55);
    panel(this, 80, 40, 1120, 560);
    if (d.page === 'help') {
      title(this, 640, 82, 'HƯỚNG DẪN', 40);
      HELP.forEach(([k, v], i) => {
        this.add.text(120, 126 + i * 46, k, { fontFamily: FONT, fontSize: '21px', fontStyle: '800', color: '#ffd23f' });
        this.add.text(360, 126 + i * 46, v, { fontFamily: FONT, fontSize: '19px', color: '#ffffff', wordWrap: { width: 800 } });
      });
    } else {
      title(this, 640, 82, 'CREDITS', 40);
      CREDITS.forEach((l, i) =>
        this.add
          .text(640, 140 + i * 38, l, { fontFamily: FONT, fontSize: i === 0 ? '30px' : '22px', fontStyle: i === 0 ? '800' : '400', color: i === 0 ? '#ffd23f' : '#ffffff' })
          .setOrigin(0.5),
      );
    }
    const back = new MenuButton(this, 640, 650, '◀ Quay lại', () => this.scene.start('MenuScene'), { width: 260, height: 58, fontSize: 24 });
    new MenuNav(this, [back], 1, () => this.scene.start('MenuScene'));
  }
}
