[HUONG_DAN.md](https://github.com/user-attachments/files/34354001/HUONG_DAN.md)
# 🎬 Rạp Của Chúng Mình — Hướng dẫn từng bước

Rạp chiếu phim 3D online cho cả nhóm bạn: 100 ghế đơn/đôi/ba, xem YouTube cùng lúc, vòng bình chọn video, chat, emoji, động tác nhân vật, sân khấu, quả cầu disco, đèn laser, chiếu ảnh lên màn hình, ném bỏng ngô, bot ngồi sẵn cho rạp đông vui — và tài khoản riêng với điểm 🍿, hạng, tủ đồ 17 món.

---

## Phần 1 — Chạy thử trên máy của bạn (10 phút)

### Bước 1. Cài Node.js
1. Vào **https://nodejs.org** → tải bản **LTS** (nút màu xanh bên trái) → cài đặt, cứ bấm *Next* đến hết.
2. Kiểm tra: mở **Terminal** (macOS) hoặc **Command Prompt / PowerShell** (Windows), gõ:
   ```
   node -v
   ```
   Hiện ra kiểu `v22.x.x` (số đầu từ 18 trở lên) là được.

### Bước 2. Giải nén dự án
Giải nén file `rap-phim.zip` vào một thư mục dễ nhớ, ví dụ `Documents/rap-phim`.

### Bước 3. Mở rạp
Trong Terminal, đi vào thư mục dự án rồi chạy:
```
cd Documents/rap-phim
node server.js
```
Thấy dòng `🎬 Rạp phim đã mở cửa tại http://localhost:3000` là thành công.

> Dự án **không cần** `npm install` — không dùng thư viện ngoài nào.

### Bước 4. Tạo tài khoản và vào rạp
Mở trình duyệt (Chrome/Edge/Firefox) → vào **http://localhost:3000** → chọn **Tạo tài khoản**:
- **Tài khoản**: 4–20 ký tự, chữ không dấu, số, `_` hoặc `.` (dùng để đăng nhập)
- **Mật khẩu**: ít nhất 6 ký tự
- **Biệt danh**: tên hiện trong rạp (có dấu thoải mái, đổi được sau)
- Chọn nhân vật, tích đồng ý nội quy → **Tạo tài khoản** → **Vào rạp**

Lần sau mở lại trang là tự đăng nhập (ghi nhớ 30 ngày). Muốn thử nhiều người: mở thêm một cửa sổ ẩn danh (Ctrl+Shift+N) rồi tạo tài khoản khác.

### Bước 5. Chiếu phim
Bấm **Gửi video** ở thanh menu bên phải → dán link YouTube → **Xem trước video** → **Thêm vào hàng chờ**. Nếu rạp đang trống, video sẽ chiếu sau 2 giây.

Tắt rạp: quay lại Terminal, bấm **Ctrl + C**.

---

## Phần 2 — Mời bạn bè vào xem

Có 2 cách. Chọn cách A nếu chỉ thỉnh thoảng tổ chức "đêm phim"; chọn cách B nếu muốn rạp luôn có địa chỉ cố định.

### Cách A — Mở thẳng từ máy bạn bằng Cloudflare Tunnel (miễn phí, 5 phút)
Máy bạn phải bật và đang chạy `node server.js` trong lúc mọi người xem.

1. Cài `cloudflared`:
   - **Windows:** mở PowerShell, gõ `winget install --id Cloudflare.cloudflared`
   - **macOS:** `brew install cloudflared` (cần có Homebrew)
2. Giữ cửa sổ đang chạy `node server.js`, mở **thêm một** cửa sổ Terminal và gõ:
   ```
   cloudflared tunnel --url http://localhost:3000
   ```
3. Sau vài giây sẽ hiện một địa chỉ dạng `https://abc-xyz-123.trycloudflare.com`. Gửi link đó cho bạn bè là xong.

Lưu ý: mỗi lần chạy lại, địa chỉ sẽ đổi. Không cần tài khoản Cloudflare.

### Cách B — Đưa lên mạng bằng Render.com (miễn phí, địa chỉ cố định)
1. Tạo tài khoản **https://github.com** → bấm **New repository** → đặt tên `rap-phim` → **Create**.
2. Trên trang repository vừa tạo, bấm **uploading an existing file** → kéo **toàn bộ nội dung** thư mục dự án vào (gồm `server.js`, `package.json`, thư mục `lib` và `public`) → **Commit changes**.
3. Vào **https://render.com** → đăng nhập bằng GitHub → **New +** → **Web Service** → chọn repository `rap-phim`.
4. Điền:
   - **Runtime:** Node
   - **Build Command:** `npm install` (để mặc định cũng được)
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Bấm **Create Web Service**, đợi 2–3 phút. Render sẽ cho bạn địa chỉ dạng `https://rap-phim.onrender.com`.

> ⚠️ **QUAN TRỌNG — tài khoản trên Render miễn phí sẽ bị mất.** Gói miễn phí của Render xoá mọi file mỗi khi server khởi động lại, cập nhật hoặc "ngủ" (sau 15 phút không có ai). Vì tài khoản, điểm 🍿 và tủ đồ được lưu trong file `data/db.json`, chúng sẽ bị xoá theo. Bạn có 2 lựa chọn:
> - **Dùng Cách A** (chạy trên máy bạn + Cloudflare Tunnel): dữ liệu nằm trong thư mục `data` trên máy bạn, không bao giờ mất. **Khuyên dùng cho nhóm bạn bè.**
> - **Render trả phí**: chọn Instance Type trả phí → mục **Disks** → **Add Disk**, Mount Path `/var/data` → mục **Environment** thêm biến `DATA_DIR` = `/var/data`. Khi đó dữ liệu được giữ lại.

Lưu ý với gói miễn phí: nếu 15 phút không có ai trong rạp, server sẽ "ngủ". Người đầu tiên vào lại sẽ phải chờ khoảng 1 phút để rạp "thức dậy". Khi đang có người xem, rạp tự giữ thức (code đã xử lý việc này). Nếu muốn rạp luôn thức, nâng lên gói trả phí khoảng 7 USD/tháng.

---

## Phần 3 — Giao diện trong rạp

```
 ┌ Tên rạp · Ghế của bạn ─────────────────────────────────────── 👥 · 🍿 · ⚙️ · Tủ đồ ┐
 │ TRÊN MÀN ẢNH                                                                               │
 │ Tên video · người gửi · 01:23 / 04:56                                                      │
 │ [Vote bỏ qua 1/2]  1/3 người thật đồng ý · 33%                                             │
 │                                                                                    ┌──────┐ │
 │                              MÀN CHIẾU 3D                                          │  ˄   │ │
 │                                                                                    │ Ghế  │ │
 │                                                      ┌ Ngăn trượt ─────────┐       │ Gửi  │ │
 │                                                      │ Hàng chờ / Trò chuyện│      │ Ảnh  │ │
 │                                                      └──────────────────────┘      │ Chờ  │ │
 │                                                                                    │ Chat │ │
 │                                                                                    │ Đồ   │ │
 │                                                                                    │ ♥    │ │
 │                                                                                    └──────┘ │
 │ 😂😍😱 🙌 🎤 🍿                                                                            │
 └ [⛶ 🛋 🖥 👥] ───────── [😀 Nói gì với cả rạp đi… 0/160 ➤] ──────── ⚡ CC 🔊 ━━━ ┘
```

### Thanh menu bên phải (bấm ˄ để thu gọn / mở)
| Nút | Chức năng |
|---|---|
| **Chọn ghế** (hiện mã ghế của bạn, ví dụ E05) | Mở **sơ đồ 100 ghế** hàng A–J. Ô xanh chanh ✓ là ghế của bạn, ô đỏ là đã có người, ô xám xanh là bot (bấm vào thì bot nhường ghế). Bấm ô trống để chuyển chỗ. Vẫn có thể bấm trực tiếp lên ghế trong rạp 3D |
| **Gửi video** | Dán link YouTube → **Xem trước video** (hiện ảnh, tên, kênh, thời lượng) → tuỳ chọn **Nhạc remix / sôi động** + nhịp **BPM** (bật disco và laser nháy theo nhịp khi video chiếu) → **Thêm vào hàng chờ**. Mỗi người tối đa 5 video đang chờ |
| **Chiếu ảnh** | Chọn ảnh, viết lời nhắn, chọn thời gian 6 / 10 / 15 / 20 / 30 / 45 / 60 giây. Phí: **6 giây = 10 🍿**, từ 10 giây trở lên **2 🍿 mỗi giây**. Ảnh hiện trên màn chiếu cho cả rạp |
| **Hàng chờ** (số video đang chờ) | Ngăn **Danh sách chờ**: thứ hạng 01, 02…, ảnh video, người gửi, thời lượng. Bấm **👍** để bình chọn (bấm lại để thu hồi). Video của bạn có nút **⚡ Chen · 20 🍿** (đưa lên trước các video chưa chen) và **Xoá**. Nút **Thêm video YouTube** ở cuối |
| **Trò chuyện** (số tin chưa đọc) | Ngăn chat: tên + huy hiệu hạng + giờ gửi, tin của bạn màu xanh, tin toàn emoji hiện to. Gõ ở **ô chat dưới cùng** (luôn hiện, tối đa 160 ký tự, nút 😀 mở bảng emoji). Khi thu gọn thanh menu, số tin chưa đọc hiện trên nút ˄ |
| **Nhiệm vụ** 🎯 (chấm đỏ = số phần thưởng đang chờ nhận) | Điểm danh, nhiệm vụ hằng ngày, lịch chiếu Đêm phim, xếp hạng tuần (xem Phần 4b) |
| **Tủ đồ** | Đổi biệt danh, nhân vật, màu áo; mặc mũ / trang phục / phụ kiện; xem hạng và cách kiếm 🍿 |
| **Ủng hộ** | Ủng hộ chủ rạp qua mã QR ngân hàng để nhận 🍿 (xem Phần 4) |

### Các nút khác
| Vị trí | Nút |
|---|---|
| Góc trên bên trái | Nhãn **📅 Đêm phim** (sắp diễn ra trong 24 giờ, có đếm ngược) hoặc **🎬 ĐÊM PHIM … 🍿 x2** (đang diễn ra) — bấm để mở lịch chiếu. **TRÊN MÀN ẢNH**: tên video, người đề xuất, thời gian. **Vote bỏ qua**: đủ **35% số người thật** trong rạp đồng ý thì chuyển bài (hiện "x/y người thật đồng ý · z%"). Người gửi video có thêm nút **Chuyển bài tiếp theo**. Nhãn **Disco · BPM** khi đang chiếu nhạc sôi động |
| Góc trên bên phải | Số ghế đang có người · **🍿 còn dùng được** (bấm để xem hạng) · **⚙️**: độ nét Cao/Mượt, toàn màn hình, mời bạn bè (sao chép link), đăng xuất · nút tròn = **Tủ đồ** |
| Góc dưới bên trái | **4 góc nhìn** (phím **V**): toàn cảnh rạp · từ ghế · tập trung màn hình · nhìn khán giả. Phía trên: thả emoji bay lên (phím 1–6) · **🙌 Tương tác** (nhảy / vẫy / vỗ tay) · **🎤 Lên sân khấu** 1 phút · **🍿** ném bỏng ngô (phím P; bấm vào bạn bè để ném họ) |
| Tên người xem | Không hiện trên đầu nhân vật — chỉ hiện trong phần **Trò chuyện** |
| Dưới phải | **⚡** bật/tắt laser trên máy bạn · **CC** phụ đề · **🔊** tắt tiếng + thanh âm lượng |
| Phím tắt | **Enter**: gõ chat · **Esc**: đóng cửa sổ / ngăn đang mở · **V**: đổi góc nhìn |

---

## Phần 4 — Tài khoản, 🍿, tủ đồ và ủng hộ

### Hai loại 🍿 (cách tính giống choigivui: quà theo tổng, phần còn lại để tiêu)
| | Dùng để | Có giảm không? |
|---|---|---|
| **🍿 tích luỹ** | Lên **hạng** và **mở khoá tủ đồ** | Không bao giờ giảm |
| **🍿 còn dùng được** (hiện ở góc trên phải) | **Chiếu ảnh**, **chen video** | Giảm khi tiêu |

### Cách có 🍿
| Cách | 🍿 |
|---|---|
| Mỗi phút ngồi trong rạp khi đang có video chiếu | +1 (trong giờ **Đêm phim**: x1.5 / x2 / x3) |
| Điểm danh mỗi ngày (chuỗi 7 ngày) | +5 → +50 |
| Ngồi chung ghế đôi / ghế ba với bạn khi đang chiếu phim | +1 thêm mỗi phút |
| Đoán đúng câu đoán | +15 |
| Bạn bè tạo tài khoản qua link mời của bạn | +30 cho cả hai |
| Bạn bè được mời xem đủ 1 giờ | +50 và món hiếm 💘 Kính trái tim |
| Nhiệm vụ hằng ngày + thưởng hoàn thành hết | +10 → +30 mỗi nhiệm vụ, +20 thưởng thêm |
| Top 1–2–3 bảng xếp hạng tuần | +100 / +60 / +40 |
| Video bạn gửi được đem ra chiếu | +5 |
| **Ủng hộ chủ rạp**: 1.000đ | +10 (10.000đ = 100 🍿, 20.000đ = 200 🍿…) |

### Hạng
| Hạng | 🍿 tích luỹ | Tương đương ủng hộ |
|---|---|---|
| Khán giả | 0 | — |
| 🎟️ Fan cứng | 60 | ~6.000đ (hoặc 1 giờ xem phim) |
| ⭐ Ngôi sao | 200 | 20.000đ |
| 🌟 Siêu sao | 500 | 50.000đ |
| 👑 Huyền thoại | 1000 | 100.000đ |

Mỗi hạng có huy hiệu trước tên, viền màu cho bảng tên và bong bóng chat.

### Tủ đồ
| Mũ | Trang phục | Phụ kiện |
|---|---|---|
| 🧢 Mũ lưỡi trai — miễn phí | 👕 Áo phông — miễn phí | 🎀 Nơ cổ — miễn phí |
| 🧶 Mũ len — 20 🍿 | 🧥 Áo hoodie — 30 🍿 | 🧣 Khăn quàng — 15 🍿 |
| 🥳 Mũ sinh nhật — 40 🍿 | 🤵 Vest lịch lãm — 60 🍿 | 🕶️ Kính râm — 50 🍿 |
| 🎧 Tai nghe — 90 🍿 | 🛡️ Giáp hiệp sĩ — 200 🍿 | 😇 Vầng hào quang — 300 🍿 |
| 🧙 Mũ phù thuỷ — 250 🍿 | 🦁 Áo choàng hoàng gia — 500 🍿 | 🪽 Cánh thiên thần — 700 🍿 |
| 👑 Vương miện — 600 🍿 | 🌌 Áo tinh tú — 1000 🍿 | |

Món chưa đủ điểm vẫn **mặc thử** được (nhân vật xoay 3D) nhưng chưa lưu. Trong tủ đồ có nút **💖 Ủng hộ để mở nhanh**.

### Tài khoản
- Đăng ký bằng tài khoản + mật khẩu (mật khẩu được mã hoá). Ghi nhớ đăng nhập 30 ngày.
- Một tài khoản chỉ ngồi được một chỗ: mở ở tab/máy khác thì tab cũ tự thoát.
- Sai mật khẩu quá 8 lần trong 15 phút sẽ bị khoá tạm.

### 💖 Cài đặt nhận ủng hộ (dành cho chủ rạp)
Nếu chưa cài, nút **Ủng hộ** sẽ báo "Chủ rạp chưa mở chức năng ủng hộ" (mọi thứ khác vẫn chạy bình thường).

**Bước 1 — Điền thông tin ngân hàng**
- **Chạy trên máy bạn**: copy file `config.example.json` thành `config.json` (cùng thư mục với `server.js`), rồi sửa:
  ```json
  {
    "bankId": "MB",
    "bankName": "MB Bank",
    "accountNo": "số tài khoản của bạn",
    "accountName": "TEN CHU TAI KHOAN VIET HOA KHONG DAU",
    "adminPassword": "mật khẩu trang duyệt (đặt khó đoán)",
    "hostUsers": "tên đăng nhập của bạn (để ra câu đoán bất cứ lúc nào)",
    "telegramBotToken": "",
    "telegramChatId": ""
  }
  ```
  `bankId` là mã ngân hàng theo VietQR, ví dụ: `MB`, `VCB` (Vietcombank), `TCB` (Techcombank), `ACB`, `BIDV`, `ICB` (VietinBank), `TPB`, `VPB`… hoặc mã BIN 6 số (MB = `970422`). File `config.json` đã nằm trong `.gitignore` nên **không bị đẩy lên GitHub**.
- **Chạy trên Render**: vào **Environment** của dịch vụ, thêm các biến `SUPPORT_BANK_ID`, `SUPPORT_BANK_NAME`, `SUPPORT_ACCOUNT_NO`, `SUPPORT_ACCOUNT_NAME`, `ADMIN_PASSWORD`, `HOST_USERS` (và nếu muốn: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).

Tắt server (Ctrl+C) rồi chạy lại `node server.js`.

**Bước 2 — Người xem ủng hộ thế nào?**
Bấm **Ủng hộ** → chọn mức (10.000đ, 20.000đ, 50.000đ, 100.000đ, 200.000đ hoặc **Số khác**) → quét **mã QR** bằng app ngân hàng (số tiền và nội dung đã điền sẵn) → tích "Tôi đã chuyển…" → **Đã chuyển tiền · Báo chủ rạp**. Mỗi tài khoản có **mã nội dung riêng** dạng `RAPxxxxxx UNG HO RAP` để chủ rạp biết ai đã chuyển.

**Bước 3 — Chủ rạp duyệt**
Mở **http://localhost:3000/admin.html** (hoặc `https://địa-chỉ-rạp/admin.html`) → nhập `adminPassword` → mở app ngân hàng, thấy giao dịch có **đúng số tiền và đúng mã RAPxxxxxx** thì bấm **Duyệt** (sai thì **Từ chối**). Người ủng hộ được cộng 🍿 ngay lập tức, cả rạp thấy lời cảm ơn, hạng và tủ đồ tự cập nhật.

**(Không bắt buộc) Báo về Telegram**: tạo bot với @BotFather để lấy `telegramBotToken`; nhắn cho bot một tin, rồi lấy `telegramChatId` của bạn (ví dụ qua @userinfobot). Mỗi lần có người bấm "Đã chuyển tiền", bạn nhận tin nhắn Telegram.

> ⚠️ Rạp **không tự xác nhận tiền** — luôn kiểm tra trong app ngân hàng trước khi duyệt. Tiền ủng hộ là thu nhập của bạn; nếu nhận nhiều, hãy tìm hiểu nghĩa vụ thuế theo quy định.

### Quản lý dữ liệu (cho chủ rạp)
- Toàn bộ tài khoản, 🍿, lịch sử ủng hộ nằm trong **`data/db.json`**. **Sao lưu** = copy file này ra chỗ khác (tắt server trước khi copy).
- **Xoá tài khoản / tặng 🍿**: tắt server, sửa `data/db.json` (mục `accounts` → `points` là tích luỹ, `balance` là còn dùng được), rồi bật lại.

---

## Phần 4b — Điểm danh, nhiệm vụ, Đêm phim, xếp hạng tuần

Bấm nút **🎯 Nhiệm vụ** trên thanh menu bên phải. Lần đầu vào rạp mỗi ngày, bảng này tự mở để nhắc điểm danh. Mọi mốc thời gian theo **giờ Việt Nam**.

**1. Điểm danh (chuỗi 7 ngày).** Ngày 1 đến ngày 7 nhận lần lượt +5, +10, +15, +20, +25, +30, **+50 🍿**, sau đó quay lại ngày 1. Bỏ 1 ngày thì chuỗi tính lại từ đầu.

**2. Nhiệm vụ hằng ngày.** Mỗi ngày có 3 nhiệm vụ (giống nhau cho cả rạp, đổi lúc 0:00): luôn có 1 nhiệm vụ xem phim (30 hoặc 60 phút), cộng 2 nhiệm vụ ngẫu nhiên như gửi video, bình chọn 👍, ném bỏng ngô, thả emoji, chat, tương tác, lên sân khấu. Làm xong thì bấm **Nhận**. Xong cả 3 thì nhận thêm **+20 🍿**.

**3. Lịch chiếu "Đêm phim"** (chủ rạp tạo):
- Mở `http://địa-chỉ-rạp/admin.html`, đăng nhập bằng mật khẩu quản trị, kéo xuống mục **📅 Lịch chiếu**.
- Nhập tên buổi chiếu, mô tả, giờ bắt đầu (giờ Việt Nam), thời lượng (15–600 phút) và hệ số 🍿 (x1 / x1.5 / x2 / x3), rồi bấm **Tạo lịch chiếu**. Cả rạp nhận thông báo trong khung chat.
- Người xem bấm **🔔 Nhắc tôi**: rạp hiện thông báo trước 10 phút và lúc bắt đầu, kèm thông báo của trình duyệt nếu họ cho phép. Thông báo chỉ hiện khi trang rạp đang mở.
- Trong giờ chiếu, mỗi phút xem phim được nhân 🍿 theo hệ số. Bảng quản trị có cột **Người hẹn** để bạn biết bao nhiêu người sẽ đến.

**4. Xếp hạng tuần** (tính từ 0:00 thứ Hai):

| Bảng | Tính theo |
|---|---|
| 🎬 Mọt phim | Số phút xem phim |
| 👍 Đạo diễn được yêu thích | Số 👍 người khác bấm cho video bạn gửi |
| 🍿 Thánh ném bỏng ngô | Số lần ném bỏng ngô |

Hết tuần, top 1–2–3 mỗi bảng nhận **+100 / +60 / +40 🍿** và huy hiệu **🥇🥈🥉** hiện cạnh tên trong Trò chuyện suốt tuần sau. Kết quả tuần trước được công bố trong chat và trong tab Xếp hạng.

## Phần 4c — Xem cùng nhau: cảm xúc, câu đoán, mời bạn, ghế đôi

**1. Emoji bùng nổ và "khoảnh khắc hot".**
- Khi nhiều người cùng thả **một loại emoji** trong 3 giây, giữa màn hình nổ một chùm emoji lớn kèm dòng "N người cùng thả!". Số người cần là 20% số người thật trong rạp, ít nhất 2, nhiều nhất 5. Mỗi loại emoji nổ cách nhau ít nhất 8 giây.
- Mỗi emoji thả trong lúc chiếu phim được ghi lại theo giây của video. Ở góc trái, ngay trên thanh tiến độ, có **biểu đồ cảm xúc**: cột càng cao là đoạn cả rạp thả càng nhiều. 3 đoạn hot nhất có emoji nổi trên đầu, vạch xanh chanh là chỗ đang chiếu.
- Lần sau chiếu lại video đó, ai vào cũng thấy biểu đồ cũ. Rạp nhớ 300 video gần nhất.

**2. Câu đoán trong lúc xem** (ví dụ "Ai là hung thủ?", "Đội nào ghi bàn?").
- Ai được ra câu đoán: **người gửi video đang chiếu**, và **chủ rạp**. Để bạn ra câu đoán bất cứ lúc nào, ghi tên đăng nhập của bạn vào `hostUsers` trong `config.json` (nhiều người thì cách nhau bằng dấu phẩy), hoặc biến `HOST_USERS` trên Render, rồi chạy lại server.
- Bấm **🔮 Ra câu đoán** ở góc trái → nhập câu hỏi, 2–4 lựa chọn, thời gian cho đoán (30 giây đến 10 phút).
- Mọi người bấm chọn đáp án và được đổi ý cho tới khi hết giờ. Trong lúc đó chỉ hiện số người đã đoán, chưa lộ ai chọn gì.
- Hết giờ (hoặc bạn bấm **⏹ Khoá ngay**), người ra câu hỏi **bấm 2 lần vào đáp án đúng** để công bố. Ai đoán đúng được **+15 🍿**. Mỗi lúc chỉ có 1 câu đoán; người thường phải chờ 1 phút mới ra câu mới.

**3. Mời bạn bè có thưởng.**
- Mở **🎯 Nhiệm vụ → 🤝 Mời bạn** (hoặc **⚙️ → Mời bạn bè**) để sao chép **link mời riêng** (dạng `…/?moi=ABC123`).
- Bạn bè mở link sẽ thấy "X mời bạn vào rạp!". Họ tạo tài khoản là **cả hai được +30 🍿**.
- Khi người được mời **xem đủ 60 phút**, người mời được **+50 🍿** và món hiếm **💘 Kính trái tim** (Tủ đồ → Phụ kiện). Món này không mua được bằng điểm.
- Chống tạo tài khoản ảo: mỗi người tối đa 5 lời mời được thưởng 🍿 mỗi ngày, và quà xem đủ 1 giờ chỉ đến khi bạn bè thật sự ngồi xem.

**4. Ngồi chung ghế đôi / ghế ba.**
- Hai người thật trở lên ngồi cùng một cụm sofa: chat báo "💞 A và B đang ngồi chung ghế đôi", tim bay lên định kỳ trên đầu, ô ghế ở góc trên hiện **💞 ngồi cùng bạn**.
- Khi đang chiếu phim, mỗi người trên sofa được **+1 🍿 thêm mỗi phút**.
- Có thể xuất hiện nhiệm vụ ngày "Ngồi chung ghế đôi/ba với bạn 10 phút".

## Phần 5 — Tuỳ chỉnh nhanh

| Muốn đổi | Sửa ở đâu |
|---|---|
| Tên rạp | `public/index.html` — tìm chữ `Rạp Của Chúng Mình` |
| Số bot (0 = tắt bot) | `server.js` → `BOT_TARGET` |
| Tên của bot | `server.js` → `BOT_NAMES` |
| Thời gian vòng bình chọn | `server.js` → `VOTE_SECONDS` |
| Thời gian trên sân khấu, số chỗ | `server.js` → `STAGE_MS`, `STAGE_SPOTS` |
| Thời gian chờ giữa 2 lần gửi ảnh | `server.js` → `POST_COOLDOWN_MS` |
| Số video tối đa mỗi người trong hàng chờ | `server.js` → `MAX_QUEUE_PER_USER` (mặc định 5) |
| Độ dài tin nhắn chat | `server.js` → `CHAT_MAX` (mặc định 160) |
| Tỉ lệ vote bỏ qua | `server.js` → `SKIP_PERCENT` (mặc định 35%) |
| Loa, đèn rọi, tấm tiêu âm, LED sân khấu | `public/js/decor.js` |
| Giá chiếu ảnh, giá chen video, các mức thời gian chiếu | `lib/wardrobe.js` → `PRICES` (đặt `0` để miễn phí) |
| Tỉ lệ đổi tiền ủng hộ ra 🍿, các mức ủng hộ gợi ý | `lib/wardrobe.js` → `POINTS.vndPerPoint`, `SUPPORT_AMOUNTS` |
| Ngân hàng nhận ủng hộ, mật khẩu trang duyệt | `config.json` (máy bạn) hoặc biến môi trường (Render) — xem Phần 4 |
| Danh sách emoji | `server.js` → `EMOJI_GROUPS` (bảng đầy đủ) và `QUICK_EMOJIS` (thanh nhanh) |
| Màu ghế đơn / đôi / ba | `public/js/theater.js` → `SEAT_COLORS` |
| Điểm thưởng, hạng, giá các món đồ, bảng màu | `lib/wardrobe.js` → `POINTS`, `TIERS`, `ITEMS`, `COLORS` |
| Thêm món đồ mới | Thêm vào `ITEMS` trong `lib/wardrobe.js`, rồi vẽ hình 3D cùng `id` trong `public/js/outfits.js` (mục `HATS`, `BODIES` hoặc `ACCS`) |
| Thưởng mời bạn, số phút cần xem, món hiếm, giới hạn mỗi ngày | `server.js` → `INVITE_BONUS`, `INVITE_WATCH_MINUTES`, `INVITE_DONE_BONUS`, `INVITE_RARE_ITEM`, `INVITE_PER_DAY` |
| Thưởng ngồi chung sofa | `server.js` → `SOFA_BONUS` |
| Thưởng đoán đúng, các mức thời gian câu đoán | `lib/polls.js` → `POLL_REWARD`, `POLL_SECONDS` |
| Số người cần để nổ chùm emoji | `lib/moments.js` → hàm `burstNeeded` |
| Người được ra câu đoán bất cứ lúc nào | `config.json` → `hostUsers` (hoặc biến `HOST_USERS`) |
| Phần thưởng điểm danh 7 ngày | `lib/engage.js` → `CHECKIN_REWARDS` |
| Danh sách nhiệm vụ, phần thưởng, thưởng hoàn thành hết | `lib/engage.js` → `MISSION_POOL`, `MISSION_BONUS` |
| Các bảng xếp hạng tuần, giải thưởng top 1–2–3 | `lib/engage.js` → `LEADER_CATS`, `LEADER_PRIZES` |
| Thời gian chờ giữa 2 lần ném bỏng ngô | `server.js` → tìm `rateLimited(client, 'popcorn'` |
| Thời gian ghi nhớ đăng nhập | `lib/accounts.js` → `SESSION_DAYS` |
| Nơi lưu dữ liệu | Biến môi trường `DATA_DIR` (mặc định thư mục `data`) |
| Màu sắc giao diện | `public/style.css` → phần `:root` ở đầu file |
| Thêm nhân vật mới | `public/js/avatars.js` (thêm vào `CHARACTER_INFO` và `createCharacter`), rồi thêm tên vào `CHARACTERS` trong `server.js` |

Sửa file xong: tắt server (Ctrl+C), chạy lại `node server.js`, rồi tải lại trang. Nếu dùng Render: upload file đã sửa lên GitHub, Render sẽ tự cập nhật.

Lưu ý: ảnh chiếu lên màn hình chỉ lưu tạm trong bộ nhớ server và tự xoá sau khi chiếu xong 1 phút.

---

## Phần 6 — Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| `node` không phải là lệnh | Chưa cài Node.js, hoặc phải mở lại Terminal sau khi cài |
| `EADDRINUSE` khi chạy | Cổng 3000 đang bị dùng. Chạy `PORT=4000 node server.js` (macOS) hoặc `set PORT=4000 && node server.js` (Windows), rồi vào `localhost:4000` |
| Màn hình rạp màu đen, không có gì | Mạng chặn `cdn.jsdelivr.net` (nơi tải thư viện 3D). Thử mạng khác hoặc tắt trình chặn quảng cáo |
| "Không tải được YouTube" | Tắt trình chặn quảng cáo cho trang này, kiểm tra mạng |
| "Video này không cho phép phát trên trang khác" | Chủ video đã tắt chế độ nhúng (hay gặp với MV ca nhạc của hãng lớn, phim có bản quyền). Hãy chọn video khác |
| Video mỗi người lệch nhau vài giây | Bình thường khi mạng chậm; rạp tự chỉnh lại sau vài giây |
| Máy yếu bị giật | Nút ⚙️ → chọn **Độ nét: Mượt**, tắt đèn laser; đóng bớt tab, dùng Chrome/Edge |
| Bật phụ đề mà không thấy chữ | Video đó không có phụ đề trên YouTube |
| Quên mật khẩu | Chưa có chức năng lấy lại mật khẩu. Chủ rạp xoá tài khoản cũ trong `data/db.json` để bạn đăng ký lại |
| Đang xem thì bị đưa ra màn hình "Vào rạp" | Tài khoản của bạn vừa được mở ở tab/thiết bị khác. Bấm **Vào rạp** để xem tiếp ở đây |
| Tài khoản biến mất hết | Bạn đang dùng Render miễn phí — xem cảnh báo ở Phần 2, Cách B |
| Nút Ủng hộ báo "chưa mở chức năng" | Chưa điền ngân hàng trong `config.json` / biến môi trường (Phần 4) |
| Trang /admin.html báo "chưa đặt mật khẩu" | Điền `adminPassword` trong `config.json` (hoặc biến `ADMIN_PASSWORD`) rồi chạy lại server |
| Mã QR không hiện | Kiểm tra `bankId` đúng mã ngân hàng VietQR và mạng không chặn img.vietqr.io |
| Không chiếu ảnh / không chen được video | Hết 🍿 còn dùng được — xem phim thêm hoặc ủng hộ rạp |
| Ảnh HEIC (iPhone) báo lỗi trên máy tính | Chụp màn hình ảnh đó rồi gửi lại, hoặc gửi từ chính iPhone (Safari đọc được HEIC) |

---

## Cấu trúc dự án

```
rap-phim/
├── server.js            ← máy chủ: ghế, bot, sân khấu, chat, hàng chờ, bình chọn, chiếu ảnh, đồng bộ phát
├── lib/websocket.js     ← kết nối thời gian thực (tự viết, không cần thư viện)
├── lib/db.js            ← lưu dữ liệu vào data/db.json
├── lib/accounts.js      ← đăng ký, đăng nhập, mã hoá mật khẩu, phiên đăng nhập
├── lib/wardrobe.js      ← danh sách món đồ, hạng, điểm, bảng giá 🍿
├── lib/support.js       ← ủng hộ qua VietQR, duyệt ủng hộ
├── lib/engage.js        ← điểm danh, nhiệm vụ, lịch Đêm phim, xếp hạng tuần
├── lib/moments.js       ← khoảnh khắc hot (emoji theo giây video), chùm emoji bùng nổ
├── lib/polls.js         ← câu đoán trong lúc xem
├── lib/config.js        ← đọc config.json / biến môi trường
├── config.example.json  ← mẫu cấu hình ngân hàng + mật khẩu duyệt (copy thành config.json)
├── data/db.json         ← (tự tạo khi chạy) tài khoản, điểm, tủ đồ — nhớ sao lưu!
├── package.json
└── public/              ← phần chạy trên trình duyệt
    ├── index.html
    ├── admin.html       ← trang quản trị: duyệt ủng hộ + tạo lịch Đêm phim
    ├── style.css
    └── js/
        ├── main.js      ← giao diện + kết nối server
        ├── theater.js   ← rạp 3D, ghế đơn/đôi/ba, sân khấu, disco, laser, camera, bỏng ngô
        ├── avatars.js   ← 8 nhân vật, động tác nhảy/vẫy/vỗ tay, bảng tên, bong bóng chat
        ├── outfits.js   ← vẽ 3D mũ, trang phục, phụ kiện
        ├── decor.js     ← loa treo tường, loa sân khấu, đèn rọi, tấm tiêu âm
        └── player.js    ← trình phát YouTube đồng bộ
```

**Cách đồng bộ phim:** server chỉ ghi nhớ "video X bắt đầu lúc mấy giờ". Mỗi trình duyệt tự tính phim đang ở giây thứ mấy rồi tua cho khớp, và cứ 2 giây kiểm tra lại một lần. Phim phát trực tiếp từ YouTube nên server gần như không tốn băng thông.

**Lưu ý nội dung:** rạp chỉ phát video YouTube cho phép nhúng. Đừng dùng rạp để chiếu phim lậu hoặc nội dung vi phạm bản quyền.
