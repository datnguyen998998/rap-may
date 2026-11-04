// ===============================================================
//  CẤU HÌNH CỦA CHỦ RẠP
//  Đọc từ biến môi trường (dùng trên Render) hoặc file config.json (dùng trên máy bạn).
//  Biến môi trường được ưu tiên hơn file.
// ===============================================================
const fs = require('fs');
const path = require('path');

let file = {};
const FILE = path.join(__dirname, '..', 'config.json');
let fileStatus = 'missing';
try {
  if (fs.existsSync(FILE)) {
    // bỏ ký tự BOM mà Notepad đôi khi tự thêm vào đầu file
    file = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, ''));
    fileStatus = 'ok';
  } else if (fs.existsSync(FILE + '.txt')) {
    fileStatus = 'txt';
  }
} catch (e) {
  fileStatus = 'bad';
  console.error('⚠️  config.json bị lỗi định dạng:', e.message);
}

const pick = (envKey, fileKey, def = '') => {
  const v = (process.env[envKey] || '').trim();
  if (v) return v;
  const f = file[fileKey];
  return f !== undefined && f !== null && String(f).trim() !== '' ? String(f).trim() : def;
};

const config = {
  // Ngân hàng nhận ủng hộ (mã ngân hàng theo VietQR, ví dụ: MB, VCB, TCB, ACB, 970422…)
  bankId: pick('SUPPORT_BANK_ID', 'bankId'),
  bankName: pick('SUPPORT_BANK_NAME', 'bankName'),
  accountNo: pick('SUPPORT_ACCOUNT_NO', 'accountNo'),
  accountName: pick('SUPPORT_ACCOUNT_NAME', 'accountName'),
  // Mật khẩu trang duyệt ủng hộ /admin.html (để trống = tắt trang duyệt)
  adminPassword: pick('ADMIN_PASSWORD', 'adminPassword'),
  // Tài khoản "chủ rạp" trong rạp: được tạo câu đoán bất cứ lúc nào (tên đăng nhập, cách nhau bởi dấu phẩy)
  hostUsers: pick('HOST_USERS', 'hostUsers').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  // (Không bắt buộc) báo về Telegram khi có người bấm "Đã chuyển tiền"
  telegramBotToken: pick('TELEGRAM_BOT_TOKEN', 'telegramBotToken'),
  telegramChatId: pick('TELEGRAM_CHAT_ID', 'telegramChatId'),
};

config.supportEnabled = !!(config.bankId && config.accountNo && config.accountName);

// Báo tình trạng cấu hình khi mở rạp (không bao giờ in mật khẩu ra)
config.describe = () => {
  const lines = [];
  if (fileStatus === 'ok') lines.push('📄 Đã đọc config.json');
  else if (fileStatus === 'txt') lines.push('⚠️  Thấy file "config.json.txt" — hãy đổi tên thành đúng "config.json" (bỏ đuôi .txt)');
  else if (fileStatus === 'bad') lines.push('⚠️  config.json sai định dạng nên bị bỏ qua (xem lỗi ở trên)');
  else lines.push('📄 Không thấy config.json ở ' + FILE);
  if (!config.adminPassword) lines.push('🔐 Trang quản trị /admin.html: CHƯA đặt mật khẩu (adminPassword)');
  else lines.push(`🔐 Trang quản trị /admin.html: đã bật — mật khẩu lấy từ ${(process.env.ADMIN_PASSWORD || '').trim() ? 'biến môi trường ADMIN_PASSWORD' : 'config.json'} (${config.adminPassword.length} ký tự)`);
  lines.push(config.hostUsers.length ? `🎙️ Chủ rạp trong phòng (được tạo câu đoán): ${config.hostUsers.join(', ')}` : '🎙️ Chưa đặt hostUsers — chỉ người gửi video đang chiếu mới tạo được câu đoán');
  return lines.join('\n');
};

module.exports = config;
