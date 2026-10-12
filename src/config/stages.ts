import type { StageConfig } from '../types/game';

/** The 10-stage campaign (GDD §9). Data only — scenes/systems read this. */
export const STAGES: StageConfig[] = [
  {
    id: 1, name: 'Phố Đêm Hỗn Loạn', theme: 'street', backgroundKey: 'bg-street', cardKey: 'card-city',
    story: 'Đội Đặc Nhiệm Hoàng Gia nhận tín hiệu cầu cứu: bọn côn đồ được tiếp sức bởi năng lượng lạ đang tấn công người dân!',
    waves: [
      { enemies: [{ type: 'grunt', count: 3 }] },
      { enemies: [{ type: 'grunt', count: 3 }, { type: 'runner', count: 2 }] },
      { enemies: [{ type: 'runner', count: 3 }, { type: 'brute', count: 1 }], maxAlive: 4 },
    ],
    bossId: 'streetBoss',
    objectives: ['Đánh bại Kẻ Cầm Đầu Phố', 'Phụ: giải cứu 3 người dân'],
    rewardScore: 2000, reward: 'Mở khóa Màn 2',
    hazards: [{ kind: 'falling', intervalMs: 7000, warningMs: 1100, damage: 10 }],
    rescueNpcs: 3, enemyHpMul: 1, enemyDmgMul: 1, music: 0, rain: true,
  },
  {
    id: 2, name: 'Trung Tâm Thương Mại Bị Chiếm', theme: 'mall', backgroundKey: 'bg-mall',
    story: 'Quái vật tràn vào trung tâm thương mại để cướp lõi năng lượng giấu trong kho hàng.',
    waves: [
      { enemies: [{ type: 'runner', count: 4 }] },
      { enemies: [{ type: 'grunt', count: 3 }, { type: 'spitter', count: 2 }] },
      { enemies: [{ type: 'brute', count: 1 }, { type: 'runner', count: 3 }], maxAlive: 4 },
    ],
    bossId: 'mechaBear',
    objectives: ['Đánh bại Gấu Máy', 'Né kệ hàng đổ và băng chuyền'],
    rewardScore: 2500, reward: 'Mảnh lõi năng lượng đầu tiên',
    hazards: [
      { kind: 'shelf', intervalMs: 8000, warningMs: 1100, damage: 11 },
      { kind: 'conveyor', intervalMs: 0, warningMs: 0, damage: 0 },
    ],
    enemyHpMul: 1.05, enemyDmgMul: 1.05, music: 1,
  },
  {
    id: 3, name: 'Đường Tàu Điện Ngầm', theme: 'subway', backgroundKey: 'bg-subway', cardKey: 'card-subway',
    story: 'Dấu vết năng lượng dẫn xuống mạng lưới tàu điện ngầm bỏ hoang...',
    waves: [
      { enemies: [{ type: 'grunt', count: 4 }] },
      { enemies: [{ type: 'leaper', count: 2 }, { type: 'runner', count: 2 }] },
      { enemies: [{ type: 'spitter', count: 2 }, { type: 'brute', count: 1 }] },
    ],
    bossId: 'spiderQueen',
    objectives: ['Đánh bại Nhện Chúa', 'Tránh khỏi đường ray khi đèn cảnh báo bật'],
    rewardScore: 3000, reward: 'Bản đồ đường dây vận chuyển',
    hazards: [{ kind: 'train', intervalMs: 11000, warningMs: 1800, damage: 18 }],
    enemyHpMul: 1.1, enemyDmgMul: 1.1, music: 2,
  },
  {
    id: 4, name: 'Nhà Máy Đột Biến', theme: 'factory', backgroundKey: 'bg-factory', cardKey: 'card-factory',
    story: 'Đội phát hiện dây chuyền biến đổi sinh vật ngay giữa lòng nhà máy.',
    waves: [
      { enemies: [{ type: 'brute', count: 2 }], maxAlive: 2 },
      { enemies: [{ type: 'grunt', count: 3 }, { type: 'spitter', count: 2 }] },
      { enemies: [{ type: 'brute', count: 1 }, { type: 'runner', count: 3 }] },
    ],
    bossId: 'giant',
    objectives: ['Phá 2 trụ năng lượng để giảm giáp boss', 'Đánh bại Người Khổng Lồ Đột Biến'],
    rewardScore: 3500, reward: 'Dữ liệu dây chuyền đột biến',
    hazards: [
      { kind: 'steam', intervalMs: 6500, warningMs: 1000, damage: 10 },
      { kind: 'conveyor', intervalMs: 0, warningMs: 0, damage: 0 },
    ],
    pillars: { count: 2, hp: 90, label: 'Trụ năng lượng' },
    enemyHpMul: 1.15, enemyDmgMul: 1.15, music: 3,
  },
  {
    id: 5, name: 'Cảng Hàng Hóa Bí Ẩn', theme: 'port', backgroundKey: 'bg-port', cardKey: 'card-port',
    story: 'Một chuyến tàu đêm đang vận chuyển lõi năng lượng ra khỏi thành phố. Phải chặn nó lại!',
    waves: [
      { enemies: [{ type: 'runner', count: 4 }] },
      { enemies: [{ type: 'grunt', count: 3 }, { type: 'leaper', count: 2 }] },
      { enemies: [{ type: 'brute', count: 1 }, { type: 'spitter', count: 3 }] },
    ],
    bossId: 'seaBeast',
    objectives: ['Đánh bại Thủy Quái', 'Tránh container rơi'],
    rewardScore: 4000, reward: 'Danh tính người mua lõi năng lượng',
    hazards: [{ kind: 'container', intervalMs: 8500, warningMs: 1300, damage: 16 }],
    enemyHpMul: 1.2, enemyDmgMul: 1.2, music: 4,
  },
  {
    id: 6, name: 'Phòng Thí Nghiệm Bí Mật', theme: 'lab', backgroundKey: 'bg-lab',
    story: 'Hồ sơ trong phòng thí nghiệm chứng minh: Tiến sĩ Hắc Ảnh đã tạo ra dịch quái vật.',
    waves: [
      { enemies: [{ type: 'robot', count: 4 }] },
      { enemies: [{ type: 'runner', count: 2 }, { type: 'screamer', count: 2 }] },
      { enemies: [{ type: 'clone', count: 4 }, { type: 'brute', count: 1 }] },
    ],
    bossId: 'madDoctor',
    objectives: ['Đánh bại Tiến Sĩ Điên', 'Đánh đúng bản thể để ngắt hồi phục'],
    rewardScore: 4500, reward: 'Chìa khóa vào căn cứ Hắc Ảnh',
    hazards: [{ kind: 'energyFloor', intervalMs: 7000, warningMs: 1200, damage: 9 }],
    enemyHpMul: 1.25, enemyDmgMul: 1.25, music: 5,
  },
  {
    id: 7, name: 'Truy Đuổi Trên Mái Nhà', theme: 'rooftop', backgroundKey: 'bg-rooftop',
    story: 'Sinh vật giữ chìa khóa cổng bỏ chạy qua các mái nhà giữa cơn giông.',
    waves: [
      { enemies: [{ type: 'flyer', count: 4 }] },
      { enemies: [{ type: 'runner', count: 3 }, { type: 'flyer', count: 2 }] },
      { enemies: [{ type: 'brute', count: 1 }, { type: 'flyer', count: 3 }, { type: 'summoner', count: 1 }] },
    ],
    bossId: 'batKing',
    objectives: ['Đánh bại Dơi Chúa', 'Phản công sau mỗi cú lao của boss'],
    rewardScore: 5000, reward: 'Chìa khóa không gian',
    hazards: [{ kind: 'wind', intervalMs: 9000, warningMs: 1200, damage: 0 }],
    enemyHpMul: 1.3, enemyDmgMul: 1.3, music: 6, rain: true,
  },
  {
    id: 8, name: 'Căn Cứ Băng Giá', theme: 'ice', backgroundKey: 'bg-ice', cardKey: 'card-ice',
    story: 'Trạm khuếch đại năng lượng ẩn trong núi tuyết đang nạp năng lượng cho Cổng Hỗn Mang.',
    waves: [
      { enemies: [{ type: 'runner', count: 4 }] },
      { enemies: [{ type: 'brute', count: 1 }, { type: 'leaper', count: 3 }] },
      { enemies: [{ type: 'screamer', count: 2 }, { type: 'brute', count: 2 }], maxAlive: 4 },
    ],
    bossId: 'iceKing',
    objectives: ['Đánh bại Băng Vương', 'Đứng gần lò sưởi hoặc phá trụ băng để rút ngắn đóng băng'],
    rewardScore: 5500, reward: 'Phá hủy bộ khuếch đại',
    hazards: [
      { kind: 'ice', intervalMs: 0, warningMs: 0, damage: 0 },
      { kind: 'icicle', intervalMs: 6500, warningMs: 1100, damage: 11 },
    ],
    pillars: { count: 2, hp: 70, label: 'Trụ băng' },
    enemyHpMul: 1.4, enemyDmgMul: 1.35, music: 7, snow: true,
  },
  {
    id: 9, name: 'Tòa Tháp Hắc Ảnh', theme: 'tower', backgroundKey: 'bg-tower', cardKey: 'card-tower',
    story: 'Đội đột nhập trung tâm điều khiển Cổng Hỗn Mang trên đỉnh tòa tháp.',
    waves: [
      { enemies: [{ type: 'brute', count: 2 }, { type: 'robot', count: 2 }], maxAlive: 4 },
      { enemies: [{ type: 'runner', count: 3 }, { type: 'screamer', count: 2 }] },
      { enemies: [{ type: 'elite', count: 2 }], maxAlive: 2 },
    ],
    bossId: 'twinA', secondBossId: 'twinB',
    objectives: ['Đánh bại Hộ Vệ Song Sinh', 'Né laser quét sàn'],
    rewardScore: 6500, reward: 'Quyền truy cập Cổng Hỗn Mang',
    hazards: [{ kind: 'laser', intervalMs: 8000, warningMs: 1300, damage: 12 }],
    enemyHpMul: 1.5, enemyDmgMul: 1.4, music: 8,
  },
  {
    id: 10, name: 'Cổng Hỗn Mang', theme: 'chaos', backgroundKey: 'bg-chaos',
    story: 'Trong chiều không gian Hỗn Mang, Tiến sĩ Hắc Ảnh chờ đợi. Đây là trận chiến cuối cùng!',
    waves: [
      { enemies: [{ type: 'leaper', count: 2 }, { type: 'spitter', count: 2 }, { type: 'runner', count: 2 }], maxAlive: 5 },
      { enemies: [{ type: 'brute', count: 2 }, { type: 'flyer', count: 2 }, { type: 'summoner', count: 1 }], maxAlive: 5 },
      { enemies: [{ type: 'elite', count: 1 }, { type: 'screamer', count: 2 }, { type: 'robot', count: 2 }], maxAlive: 5 },
    ],
    bossId: 'darkShadow',
    objectives: ['Đánh bại Tiến Sĩ Hắc Ảnh', 'Phase 3: phá 3 trụ năng lượng'],
    rewardScore: 10000, reward: 'Đóng Cổng Hỗn Mang — cứu thành phố!',
    hazards: [{ kind: 'chaos', intervalMs: 7000, warningMs: 1100, damage: 12 }],
    pillars: { count: 3, hp: 110, label: 'Trụ Hỗn Mang' },
    enemyHpMul: 1.6, enemyDmgMul: 1.45, music: 9,
  },
];

export function getStage(id: number): StageConfig {
  const s = STAGES.find((st) => st.id === id);
  if (!s) throw new Error(`Unknown stage: ${id}`);
  return s;
}

export const STAGE_COUNT = STAGES.length;
