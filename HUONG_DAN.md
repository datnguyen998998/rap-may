# ☁️ Rạp Mây — Hướng dẫn từng bước

Rạp chiếu phim 3D online cho cả nhóm bạn: 100 ghế đơn/đôi/ba, xem YouTube cùng lúc, vòng bình chọn video, chat, emoji, động tác nhân vật, sân khấu, quả cầu disco, đèn laser, chiếu ảnh lên màn hình, ném bỏng ngô, bot ngồi sẵn cho rạp đông vui — và tài khoản riêng với điểm 🍿, hạng, tủ đồ 18 món.

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


### Cách C — Đưa rạp lên tên miền riêng (khuyên dùng khi mở cho mọi người)
Dùng Render gói **Starter** (khoảng 7 USD/tháng) + ổ lưu dữ liệu 1 GB (khoảng 0,25 USD/tháng). Rạp chạy 24/7, không "ngủ", tài khoản và 🍿 không bị mất, có HTTPS miễn phí.

**Bước 1 — Đưa code lên GitHub (để riêng tư)**
1. Vào https://github.com → **New repository** → tên `rap-may` → chọn **Private** → **Create repository**.
2. Bấm **uploading an existing file** → kéo vào: `server.js`, `package.json`, `bot-chat.txt`, `tu-cam.txt`, `config.example.json`, `README.md`, `HUONG_DAN.md`, thư mục `lib` và `public` → **Commit changes**.
3. ⚠️ **KHÔNG kéo** `config.json` (có mật khẩu, số tài khoản), thư mục `data`, `node_modules`. Kéo thả trên web không tự bỏ qua các file này như `.gitignore`, bạn phải tự chừa ra.

**Bước 2 — Tạo dịch vụ trên Render**
1. https://render.com → đăng nhập bằng GitHub → **New +** → **Web Service** → chọn repository `rap-may` (nếu không thấy: bấm **Configure account** để cho Render đọc repo riêng tư).
2. Điền: **Name** `rap-may` · **Runtime** Node · **Build Command** `npm install` · **Start Command** `node server.js` · **Instance Type** **Starter**.
3. Mục **Environment Variables**, thêm:

| Tên biến | Giá trị |
|---|---|
| `DATA_DIR` | `/var/data` |
| `ADMIN_PASSWORD` | mật khẩu trang quản trị (đặt mới, dài, khó đoán) |
| `HOST_USERS` | tên đăng nhập của bạn (chủ rạp) |
| `SUPPORT_BANK_ID`, `SUPPORT_BANK_NAME`, `SUPPORT_ACCOUNT_NO`, `SUPPORT_ACCOUNT_NAME` | thông tin nhận ủng hộ (như trong `config.json` của bạn) |

4. Mục **Advanced** → **Add Disk**: Name `data`, Mount Path `/var/data`, Size `1` GB.
5. Bấm **Create Web Service**, đợi vài phút đến khi thấy **Live**. Mở thử `https://rap-may.onrender.com` (tên thật hiện ở đầu trang dịch vụ).

**Bước 3 — Gắn tên miền**
1. Trong dịch vụ trên Render → **Settings** → **Custom Domains** → **Add Custom Domain** → nhập `tenmiencuaban.com` → **Save**. Render thường tự thêm cả `www.tenmiencuaban.com`.
2. Vào trang quản lý tên miền nơi bạn mua (Mắt Bão, PA Việt Nam, iNET, Tenten, Namecheap…) → phần **Quản lý DNS / Bản ghi DNS**:
   - **Xoá** bản ghi `A` cũ của `@`, bản ghi `AAAA` (nếu có), bản ghi/chuyển hướng cũ của `www`.
   - Thêm bản ghi **A**: Tên/Host `@` → Giá trị `216.24.57.1`.
   - Thêm bản ghi **CNAME**: Tên/Host `www` → Giá trị `rap-may.onrender.com` (đúng địa chỉ Render của bạn).
   - TTL: chọn nhỏ nhất có thể (1–5 phút).
   - Nếu tên miền đang dùng **Cloudflare**: dùng **CNAME** cho cả `@` lẫn `www` (trỏ về `rap-may.onrender.com`) và tắt đám mây cam (để xám).
3. Quay lại Render → bấm **Verify** cạnh tên miền. Có thể mất từ vài phút đến vài giờ. Khi xong, Render tự cấp HTTPS (ổ khoá xanh).
4. Mở `https://tenmiencuaban.com`, tạo tài khoản đúng tên đã ghi ở `HOST_USERS`, kiểm tra nút **Quản lý** và trang `/admin.html`.

**Cập nhật rạp về sau:** sửa file trên máy → lên GitHub, vào đúng thư mục, **Add file → Upload files** kéo file mới đè lên → **Commit**. Render tự cập nhật sau 1–2 phút. Dữ liệu trên ổ `/var/data` vẫn giữ nguyên. Khi đổi biến môi trường (ví dụ mật khẩu), Render tự khởi động lại rạp.

**Dữ liệu cũ trên máy:** rạp trên mạng bắt đầu với dữ liệu trống (tài khoản, 🍿 trên máy bạn không tự chuyển lên).

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
| **Gửi video** | Dán link YouTube → **Xem trước video** (hiện ảnh, tên, kênh, thời lượng) → chọn **không khí**: 🎬 Bình thường · ⚡ Sôi động (disco, laser theo nhịp **BPM**) · 👻 Kinh dị (rạp tối hẳn, đèn thỉnh thoảng chập chờn, ánh xanh lạnh) · 🌹 Lãng mạn (ánh hồng, cánh hoa rơi khắp rạp) → **Thêm vào hàng chờ**. Mỗi người tối đa 5 video đang chờ |
| **Chiếu ảnh** | Chọn ảnh, viết lời nhắn, chọn thời gian 6 / 10 / 15 / 20 / 30 / 45 / 60 giây. Phí: **6 giây = 10 🍿**, từ 10 giây trở lên **2 🍿 mỗi giây**. Ảnh hiện trên màn chiếu cho cả rạp |
| **Hàng chờ** (số video đang chờ) | Ngăn **Danh sách chờ**: thứ hạng 01, 02…, ảnh video, người gửi, thời lượng. Bấm **👍** để bình chọn (bấm lại để thu hồi). Video của bạn có nút **⚡ Chen · 20 🍿** (đưa lên trước các video chưa chen) và **Xoá**. Nút **Thêm video YouTube** ở cuối |
| **Trò chuyện** (số tin chưa đọc) | Ngăn chat: tên + huy hiệu hạng + giờ gửi, tin của bạn màu xanh, tin toàn emoji hiện to. Gõ ở **ô chat dưới cùng** (luôn hiện, tối đa 160 ký tự, nút 😀 mở bảng emoji). Khi thu gọn thanh menu, số tin chưa đọc hiện trên nút ˄ |
| **Bạn bè** (chấm đỏ = lời mời kết bạn) | Danh sách bạn bè và ai đang online ở phòng nào · lời mời kết bạn · người đang ở cùng phòng (kết bạn, tặng quà) |
| **Quản lý** (chỉ chủ rạp / chủ phòng mới thấy) | Chuyển bài, khoá chat, ghim tin nhắn, tắt chat một người (xem Phần 4e) |
| **Tủ đồ** | Đổi biệt danh, nhân vật, màu áo; mặc mũ / trang phục / phụ kiện; xem hạng và cách kiếm 🍿 |
| **Ủng hộ** | Ủng hộ chủ rạp qua mã QR ngân hàng để nhận 🍿 (xem Phần 4) |

### Các nút khác
| Vị trí | Nút |
|---|---|
| Góc trên bên trái | Nhãn **📅 Đêm phim** (sắp diễn ra trong 24 giờ, có đếm ngược) hoặc **🎬 ĐÊM PHIM … 🍿 x2** (đang diễn ra) — bấm để mở lịch chiếu. **TRÊN MÀN ẢNH**: tên video, người đề xuất, thời gian. **Vote bỏ qua**: phải **trên 35% số người thật** đang ở trong rạp đồng ý thì mới chuyển bài (bot không tính; 2 người cần 1 phiếu, 3 người cần 2, 10 người cần 4). Nút hiện "Vote bỏ qua 0/2 · 3 người" để biết rạp đang tính bao nhiêu người. Lưu ý: một tài khoản vào rạp trên nhiều máy chỉ tính là **1 người** (máy vào trước sẽ bị mời ra). Người gửi video có thêm nút **Chuyển bài tiếp theo**. Nhãn **Disco · BPM** khi đang chiếu nhạc sôi động |
| Góc trên bên phải | Số ghế đang có người · **🍿 còn dùng được** (bấm để xem hạng) · **⚙️**: độ nét Cao/Mượt, toàn màn hình, mời bạn bè (sao chép link), đăng xuất · nút tròn = **Tủ đồ** |
| Góc dưới bên trái | **4 góc nhìn** (phím **V**): toàn cảnh rạp · từ ghế · tập trung màn hình · nhìn khán giả. Phía trên: thả emoji bay lên (phím 1–6) · **🙌 Tương tác** (nhảy / vẫy / vỗ tay) · **🎤 Lên sân khấu** 1 phút · **🍿** ném bỏng ngô (phím P; bấm vào bạn bè để ném họ) |
| Tên người xem | Không hiện trên đầu nhân vật — chỉ hiện trong phần **Trò chuyện** |
| Nhân vật đi lại | Người mới vào: đi từ **cửa sau** (góc cuối rạp, dưới biển EXIT) theo lối đi có đèn LED dưới sàn rồi ngồi vào ghế. Đổi ghế: đứng dậy, đi theo lối giữa các hàng tới ghế mới. Lên sân khấu: đi lên phía trước, nhảy lên sân khấu, đứng vào vòng LED; hết giờ thì đi về ghế. Rời rạp: đi ra cửa rồi mới biến mất |
| Sân khấu | 5 chỗ nhảy, dưới chân mỗi chỗ có **vòng đèn LED tròn** (sáng mạnh và đổi màu theo nhịp khi có người đứng). Có người trên sân khấu là **laser, đèn tường, đèn rọi tự quẩy theo nhịp** — càng đông càng rực |
| Tắt đèn | Video chạy được 10 giây thì đèn rạp mờ dần như rạp thật (màn chiếu vẫn sáng rõ), hết video / bình chọn thì đèn sáng lại. Tắt ở **⚙️ → 💡 Tắt đèn khi chiếu phim** (video kinh dị vẫn luôn tắt đèn) |
| Ném lên màn hình | **🍿** bỏng ngô (phím P) · **🍅** cà chua khi video dở (phím T) — vỡ toé, dính lại vài giây rồi chảy xuống · **🌹** hoa hồng khi video hay (phím R) — dính lên màn rồi xoay rơi xuống |
| Phát lại khoảnh khắc hot | Video chiếu **hết tự nhiên** (không bị bỏ qua) và có ít nhất 5 emoji trong cùng 10 giây: rạp tự tua lại 10 giây đó cho cả rạp xem lại, thanh "Trên màn ảnh" hiện **⏪ PHÁT LẠI KHOẢNH KHẮC HOT** |
| Pháo sáng | 6 máy phun ở mép sân khấu. Khi sân khấu **kín 5 người liên tục 30 giây** thì pháo phun 7 giây (cả rạp thấy cùng lúc), còn kín tiếp thì cứ 30 giây phun một lần. Người và bot đều được tính |
| Dưới phải | **⛶** toàn màn hình (phím **F**) · **👁 gạch chéo** ẩn giao diện (phím **H**) · **⚡** bật/tắt laser trên máy bạn · **CC** phụ đề · **🔊** tắt tiếng + thanh âm lượng. Trên điện thoại, nút toàn màn hình và ẩn giao diện nằm ở góc trên bên phải |
| Ẩn giao diện | Ẩn hết các nút, chỉ còn nút **Trò chuyện** (bấm để mở khung chat + ô gõ) và nút **con mắt** để hiện lại. Phím **H** hoặc **Esc** cũng hiện lại |
| Tự làm mờ | Khi đang chiếu phim mà bạn không đụng chuột/bàn phím 4 giây, các nút tự mờ đi để nhìn rạp và màn hình rõ hơn. Đụng chuột là hiện lại ngay. Tắt/bật ở **⚙️ → 🌙 Tự làm mờ nút khi xem** |
| Phím tắt | **Enter**: gõ chat · **Esc**: đóng cửa sổ / ngăn đang mở · **V**: đổi góc nhìn · **F**: toàn màn hình · **H**: ẩn / hiện giao diện · **P / T / R**: ném bỏng ngô / cà chua / hoa hồng |

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

Bấm nút **🎯 Nhiệm vụ** ở góc trên bên phải, cạnh số ghế (chấm đỏ = số phần thưởng đang chờ nhận). Lần đầu vào rạp mỗi ngày, bảng này tự mở để nhắc điểm danh. Mọi mốc thời gian theo **giờ Việt Nam**.

**1. Điểm danh (chuỗi 7 ngày).** Ngày 1 đến ngày 7 nhận lần lượt +5, +10, +15, +20, +25, +30, **+50 🍿**, sau đó quay lại ngày 1. Bỏ 1 ngày thì chuỗi tính lại từ đầu.

**2. Nhiệm vụ hằng ngày.** Mỗi ngày có 3 nhiệm vụ (giống nhau cho cả rạp, đổi lúc 0:00): luôn có 1 nhiệm vụ xem phim (30 hoặc 60 phút), cộng 2 nhiệm vụ ngẫu nhiên như gửi video, bình chọn 👍, ném bỏng ngô, thả emoji, chat, tương tác, lên sân khấu. Làm xong thì bấm **Nhận**. Xong cả 3 thì nhận thêm **+20 🍿**.

**3. Lịch chiếu "Đêm phim"** (chủ rạp tạo):
- Mở `http://địa-chỉ-rạp/admin.html`, đăng nhập bằng mật khẩu quản trị, kéo xuống mục **📅 Lịch chiếu**.
- Nhập tên buổi chiếu, mô tả, giờ bắt đầu (giờ Việt Nam), thời lượng (15–600 phút) và hệ số 🍿 (x1 / x1.5 / x2 / x3), rồi bấm **Tạo lịch chiếu**. Cả rạp nhận thông báo trong khung chat.
- Người xem bấm **🔔 Nhắc tôi**: rạp hiện thông báo trước 10 phút và lúc bắt đầu, kèm thông báo của trình duyệt nếu họ cho phép. Thông báo chỉ hiện khi trang rạp đang mở.
- Trong giờ chiếu, mỗi phút xem phim được nhân 🍿 theo hệ số. Bảng quản trị có cột **Người hẹn** để bạn biết bao nhiêu người sẽ đến.

**4. Xếp hạng tuần** (nút **🏆 Xếp hạng** ngay cạnh nút Nhiệm vụ; tính từ 0:00 thứ Hai):

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

## Phần 4d — Phòng riêng, bạn bè, tặng quà

**1. Phòng riêng.**
- Bấm **Phòng riêng** ở góc dưới bên trái (cạnh các nút đổi góc nhìn) → nhập tên phòng, mật khẩu (để trống thì ai cũng vào được) → **Tạo phòng và vào luôn**.
- Phòng riêng có ghế, hàng chờ video, chat, sân khấu, câu đoán riêng. Người ở sảnh chính không thấy, không nghe gì trong phòng. Phòng riêng không có bot.
- Trong phòng riêng, xem phim **vẫn được cộng 🍿**, vẫn tính nhiệm vụ và xếp hạng tuần.
- Chủ phòng được ra câu đoán bất cứ lúc nào (như chủ rạp). Pháo sáng: chỉ cần cả nhóm cùng lên sân khấu (ít nhất 2 người) quẩy 30 giây.
- Bấm **🔗 Sao chép link phòng** để gửi cho bạn bè (link dạng `…/?phong=ABC123`), nhớ gửi kèm mật khẩu. Bạn bè mở link, vào rạp xong sẽ được đưa thẳng vào phòng (hỏi mật khẩu nếu có).
- Ô nhỏ cạnh số ghế ở góc trên (ví dụ **🔒 Hội bạn thân**) cho biết bạn đang ở phòng riêng. Bấm vào để mở danh sách phòng hoặc **🏛️ Về sảnh chính**.
- Mỗi người mở 1 phòng một lúc, tối đa 30 phòng cùng lúc. Phòng không còn ai trong 3 phút thì tự đóng.

**2. Kết bạn và ai đang online.**
- Bấm **Bạn bè** → tab **Trong phòng** → **Kết bạn** với người đang xem cùng. Hoặc gõ **tên đăng nhập** của bạn ấy ở ô cuối tab Bạn bè.
- Người kia thấy chấm đỏ trên nút Bạn bè, vào tab **Lời mời** bấm **Đồng ý**.
- Tab **Bạn bè**: ai đang online hiện chấm xanh và đang ở phòng nào. Người cùng phòng có thêm nút **Ngồi cạnh**: rạp tự tìm ghế trống gần nhất, ưu tiên cùng ghế đôi/ghế ba, ghế bot đang ngồi cũng được vì bot sẽ nhường. Người ở phòng khác có nút **Vào phòng**.
- Bấm **⭐** để đánh dấu **bạn thân**: khi bạn thân vào rạp, bạn được báo ngay, kèm thông báo của trình duyệt nếu bạn cho phép và đang mở tab khác.
- Bấm **✕** hai lần để huỷ kết bạn.

**3. Tặng quà.**
- Bấm **🎁** cạnh tên một người cùng phòng (tab Bạn bè hoặc Trong phòng) → chọn quà → **Tặng**:

| Quà | Giá | Hiệu ứng |
|---|---|---|
| 💐 Bó hoa | 20 🍿 | Lơ lửng trên đầu người nhận 3 phút |
| 🧋 Ly trà sữa | 30 🍿 | Lơ lửng trên đầu người nhận 3 phút |
| 👑 Vương miện | 80 🍿 | Người nhận **đội vương miện thật** 10 phút (đè lên mũ đang đội) |

- Quà bay từ người tặng sang người nhận và toả lấp lánh, cả phòng thấy và chat báo "🎁 A tặng B …".
- Quà vẫn theo người nhận khi họ đổi phòng.

## Phần 4e — Dành cho chủ rạp: quản lý, chặn từ xấu, thống kê

**Ai là chủ rạp trong rạp?** Những tên đăng nhập ghi trong `hostUsers` của `config.json` (hoặc biến `HOST_USERS` trên Render), cách nhau bằng dấu phẩy, ví dụ `"hostUsers": "minhanh,tuan"`. Họ quản lý được sảnh chính và mọi phòng. Trong phòng riêng, **chủ phòng** cũng có quyền này nhưng chỉ trong phòng của mình. Sửa xong nhớ chạy lại server.

**1. Bảng điều khiển trong rạp.** Chủ rạp thấy thêm nút **Quản lý** (hình khiên) ở menu phải:
- **⏭ Chuyển bài ngay:** bỏ qua video đang chiếu, không cần ai vote.
- **Xoá video bất kỳ:** mở **Hàng chờ**, mỗi video có thêm nút 🗑.
- **🔒 Tạm khoá chat cả phòng:** người xem không gửi được tin nhắn (vẫn thả emoji được), chủ rạp vẫn chat bình thường. Bấm lần nữa để mở lại.
- **📌 Ghim tin nhắn:** tin ghim hiện ở đầu khung Trò chuyện và một dải nhỏ giữa phía trên màn hình. Người vào sau cũng thấy. Bấm **Bỏ ghim** để gỡ.
- **🔇 Tắt chat một người:** 5 phút, 15 phút, 1 giờ hoặc 1 ngày. Có thể bấm ngay nút 🔇 cạnh tên người đó trong khung Trò chuyện. Người bị tắt chat nhận thông báo còn bao nhiêu phút, thoát ra vào lại vẫn bị tắt. Bấm **Mở chat** để gỡ.

**2. Chặn từ ngữ xấu.** File **`tu-cam.txt`** (đặt cạnh `server.js`), mỗi dòng 1 từ hoặc cụm từ:
- Tin nhắn chat, tin ghim, chữ trên ảnh chiếu, câu đoán có từ cấm thì từ đó tự bị che thành `***`. Biệt danh và tên phòng có từ cấm thì không đặt được.
- Không phân biệt chữ hoa thường, nhưng **có phân biệt dấu**. Nếu bỏ dấu khi so, "dị" sẽ trùng "đĩ", "dù" sẽ trùng "đụ". Muốn chặn cả kiểu viết không dấu thì ghi thêm một dòng (file mẫu đã có cả "đm" và "dm").
- Chỉ che khi đứng thành từ riêng: ghi "dm" thì chữ "admin" vẫn bình thường.
- Sửa file lúc nào cũng được, khoảng 3 giây sau rạp tự đọc lại. Nhớ lưu bằng mã **UTF-8**.

**3. Thống kê.** Mở `/admin.html`, mục **📊 Thống kê** (hoặc bấm **Xem thống kê** trong bảng Quản lý). Chọn xem 7, 14 hoặc 30 ngày:
- Các số chính: bao nhiêu người đang online, bao nhiêu người vào hôm nay, lúc đông nhất hôm nay, tổng số tài khoản.
- **Số người vào rạp mỗi ngày:** mỗi người chỉ tính 1 lần trong ngày. Rê chuột lên cột để xem lượt vào và lúc đông nhất.
- **Trung bình số người online theo giờ (giờ Việt Nam):** rạp ghi lại số người online mỗi 5 phút. 3 giờ đông nhất được tô sáng, kèm gợi ý nên đặt Đêm phim lúc mấy giờ.
- **Video được xem nhiều nhất:** số lượt chiếu, tổng số phút người xem (2 người xem 10 phút = 20 phút) và lúc đông người xem nhất.
- Bấm **Xem dạng bảng** để xem số liệu dạng bảng. Rạp giữ thống kê 60 ngày gần nhất trong `data/db.json`.

## Phần 4f — An ninh: chống tài khoản clone và phá hoại (DDoS)

Rạp có sẵn các lớp bảo vệ sau, **tự chạy, không cần cài gì** (trừ ô "Tôi không phải robot" ở bước 3):

**1. Chống tài khoản clone gian lận vote**
- Tài khoản mới phải **tạo được 30 phút** và **xem phim đủ 10 phút** mới được vote (cả 👍 hàng chờ lẫn vote bỏ qua). Bấm vote sớm sẽ được báo còn thiếu bao nhiêu phút. Chủ rạp luôn được vote.
- Vote bỏ qua chỉ tính những người **được vote**, nên clone mới tạo không làm tăng số phiếu cần.
- Mỗi IP (một nhà / một wifi) tối đa **2 phiếu** cho cùng một video.
- Mỗi IP tạo tối đa **3 tài khoản mỗi giờ, 5 tài khoản mỗi ngày** (chỉ tính lần tạo thành công).

**2. Chống phá hoại / DDoS nhỏ** (Render đã chặn sẵn tấn công tầng mạng qua Cloudflare, rạp chặn thêm tầng ứng dụng):
- Mỗi IP tối đa **12 kết nối** cùng lúc và **300 lượt tải mỗi phút**. Vượt nhiều lần → IP đó **tự bị chặn 15 phút**.
- Gửi tin dồn dập (hơn 40 tin/giây) → bị ngắt kết nối.
- Gửi ảnh: rạp kiểm tra quyền, 🍿, thời gian chờ và **dung lượng khai báo trước khi nhận dữ liệu**; tệp quá lớn bị từ chối ngay. Tối đa 2 ảnh đang tải cùng lúc mỗi IP.
- Kết nối cố tình gửi rất chậm để "giữ" server bị ngắt sau 15–30 giây.

**3. Ô "Tôi không phải robot" khi tạo tài khoản (Cloudflare Turnstile, miễn phí) — nên bật khi mở công khai**
1. Vào https://dash.cloudflare.com → tạo tài khoản miễn phí (không cần thẻ) → menu trái chọn **Turnstile** → **Add widget**.
2. **Widget name:** `Rạp Mây` · **Hostname:** tên miền của bạn (ví dụ `xemgihay.online`) · **Widget Mode:** Managed → **Create**.
3. Cloudflare hiện 2 khoá: **Site Key** và **Secret Key**. Vào Render → dịch vụ của bạn → **Environment** → thêm 2 biến:
   - `TURNSTILE_SITE_KEY` = Site Key
   - `TURNSTILE_SECRET` = Secret Key (giữ kín, không gửi cho ai)
4. Bấm **Save Changes**. Rạp tự khởi động lại; trong Logs thấy dòng `🤖 Chống bot khi tạo tài khoản (Turnstile): đã bật` là xong. Form **Tạo tài khoản** sẽ có thêm ô xác minh (thường chỉ cần đợi 1–2 giây là tự hiện dấu ✓).

**4. Trang quản trị → mục 🛡️ An ninh**
- **IP tạo nhiều tài khoản:** mỗi dòng là một IP đã tạo từ 2 tài khoản trở lên. Có nhãn **đáng ngờ** khi tạo từ 3 tài khoản trong 24 giờ. Bấm "3 tài khoản" để xem từng tài khoản (tạo lúc nào, đã xem bao nhiêu phút) và **Khoá** từng cái, hoặc bấm **Chặn + khoá TK** để chặn IP 1 ngày và khoá hết tài khoản tạo từ IP đó.
- **Chặn một IP:** nhập IP, chọn thời hạn (1 giờ / 1 ngày / 7 ngày / vĩnh viễn). Mọi kết nối đang mở từ IP đó bị ngắt ngay.
- **Khoá một tài khoản theo tên đăng nhập:** người đó bị đá ra ngay, không đăng nhập lại được cho tới khi bạn bấm **Mở khoá**.
- Lưu ý: nhiều người có thể dùng chung một IP (cùng wifi, cùng mạng 4G). Nên chặn **có thời hạn**, và xem kỹ trước khi chặn.
- Chặn cố định không cần vào trang quản trị: trên Render thêm biến `BLOCK_IPS` = `1.2.3.4,5.6.7.8`.

**5. (Nâng cao) Đặt Cloudflare của riêng bạn phía trước** — khi bị tấn công lớn, chuyển tên miền từ Nhân Hòa sang Cloudflare (gói Free) để dùng tường lửa, giới hạn tốc độ và chế độ "Under Attack". Bật proxy (đám mây cam) **sau khi** Render đã cấp chứng chỉ, và đặt SSL/TLS ở chế độ **Full**. Cần thì hỏi mình hướng dẫn chi tiết.

## Phần 5 — Tuỳ chỉnh nhanh

| Muốn đổi | Sửa ở đâu |
|---|---|
| Tên rạp | `public/index.html` và `public/admin.html` — tìm chữ `Rạp Mây` |
| Logo | `public/img/logo.svg` (biểu tượng, cũng là icon trên tab trình duyệt), `logo-full.svg` (biểu tượng + chữ), ảnh PNG cho Facebook: `rap-may-fb.png`, `rap-may-avatar.png` |
| Số bot (ngẫu nhiên trong khoảng, đổi sau mỗi 4–9 phút; đặt cả hai = 0 để tắt bot) | `server.js` → `BOT_MIN`, `BOT_MAX` (mặc định 30–50), `BOT_REROLL_MIN` |
| Tên của bot | `server.js` → `BOT_NAMES` |
| Câu chat của bot | File `bot-chat.txt` (cạnh `server.js`): mỗi dòng 1 câu, `{ten}` = tên một người thật đang trong rạp. Sửa xong rạp tự đọc lại sau vài giây, không cần tắt server |
| Bot chat nhanh / chậm, tắt bot chat | `server.js` → `BOT_CHAT_MIN_S`, `BOT_CHAT_MAX_S` (đặt `BOT_CHAT_MAX_S = 0` để tắt) |
| Thời gian vòng bình chọn | `server.js` → `VOTE_SECONDS` |
| Thời gian trên sân khấu, số chỗ | `server.js` → `STAGE_MS`, `STAGE_SPOTS` |
| Thời gian chờ giữa 2 lần gửi ảnh | `server.js` → `POST_COOLDOWN_MS` |
| Số video tối đa mỗi người trong hàng chờ | `server.js` → `MAX_QUEUE_PER_USER` (mặc định 5) |
| Độ dài tin nhắn chat | `server.js` → `CHAT_MAX` (mặc định 160) |
| Tỉ lệ vote bỏ qua | `server.js` → `SKIP_PERCENT` (mặc định: phải trên 35%) |
| Điều kiện vote (chống clone) | Biến môi trường `VOTE_MIN_AGE_MIN` (mặc định 30 phút tuổi), `VOTE_MIN_WATCH_MIN` (mặc định 10 phút xem), `VOTES_PER_IP` (mặc định 2 phiếu / IP / video) |
| Giới hạn tạo tài khoản | `SIGNUP_PER_IP_HOUR` (mặc định 3), `SIGNUP_PER_IP_DAY` (mặc định 5) |
| Giới hạn chống phá hoại | `WS_PER_IP` (12 kết nối), `HTTP_PER_MIN` (300 lượt / phút), `WS_MSG_PER_SEC` (40 tin / giây), `AUTO_BAN_MINUTES` (15 phút), `BLOCK_IPS` (IP chặn cố định) |
| Ô "Tôi không phải robot" | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` (xem Phần 4f) |
| Loa, đèn rọi, tấm tiêu âm, LED sân khấu | `public/js/decor.js` |
| Tốc độ đi bộ, vị trí cửa ra vào | `public/js/theater.js` → `WALK_SPEED`, `STAGE_WALK_SPEED`, `DOOR_X`, `BACK_Z` |
| Phát lại khoảnh khắc hot: dài bao lâu, cần bao nhiêu emoji | `server.js` → `REPLAY_SECONDS`, `REPLAY_MIN_EMOJI` |
| Độ tối khi tắt đèn | `public/js/theater.js` → `toneMappingExposure` trong hàm `updateDisco` (0.55 = thường, 0.72 = kinh dị) |
| Số người cần để bắn pháo, khoảng cách giữa 2 lần, thời gian phun | `server.js` → `PYRO_DANCERS` (hoặc biến môi trường `PYRO_DANCERS`, đặt `1` để tự thử một mình), `PYRO_EVERY_MS`, `PYRO_MS` |
| Độ cao / độ dày tia pháo | `public/js/theater.js` → hàm `updatePyro` (`rate` = số tia mỗi giây, `9.5 + …` = tốc độ phun lên) |
| Màu laser, kiểu quét | `public/js/theater.js` → `PARTY_HUES`, hàm `updateLasers` |
| Đèn chớp cả phòng (khi phát bài chế độ Sôi động) | `public/js/theater.js` → hàm `updateStrobe`: `0.85 * pulse` = độ mạnh ánh màu theo nhịp, `1.1` = độ sáng chớp trắng, `every` = chớp trắng mỗi mấy nhịp. Vị trí dàn đèn: hàm `buildStrobe`. Người xem tắt được trên máy mình bằng nút ⚡ |
| Tường, trần, bóng đèn tường | `public/js/decor.js` → mục 1 (tường) và 2 (trần) |
| Giá chiếu ảnh, giá chen video, các mức thời gian chiếu | `lib/wardrobe.js` → `PRICES` (đặt `0` để miễn phí) |
| Tỉ lệ đổi tiền ủng hộ ra 🍿, các mức ủng hộ gợi ý | `lib/wardrobe.js` → `POINTS.vndPerPoint`, `SUPPORT_AMOUNTS` |
| Ngân hàng nhận ủng hộ, mật khẩu trang duyệt | `config.json` (máy bạn) hoặc biến môi trường (Render) — xem Phần 4 |
| Danh sách emoji | `server.js` → `EMOJI_GROUPS` (bảng đầy đủ) và `QUICK_EMOJIS` (thanh nhanh) |
| Màu ghế đơn / đôi / ba | `public/js/theater.js` → `SEAT_COLORS` |
| Góc toàn cảnh mặc định (camera) | `public/js/theater.js` → `OVERVIEW_POS` (vị trí camera: tăng số giữa = cao hơn, tăng số cuối = lùi xa hơn → thấy nhiều hơn nhưng màn chiếu nhỏ đi) và `OVERVIEW_LOOK` (điểm nhìn: số giữa nhỏ hơn = cúi xuống nhiều hơn) |
| Độ to của nhân vật | `public/js/theater.js` → `AVATAR_SCALE` (mặc định 1.3; 1 = cỡ cũ) |
| Khoảng cách hàng ghế | `public/js/theater.js` → `ROW0` (vị trí hàng A) và `ROW_GAP` (khoảng cách giữa 2 hàng) |
| Điểm thưởng, hạng, giá các món đồ, bảng màu | `lib/wardrobe.js` → `POINTS`, `TIERS`, `ITEMS`, `COLORS` |
| Thêm món đồ mới | Thêm vào `ITEMS` trong `lib/wardrobe.js`, rồi vẽ hình 3D cùng `id` trong `public/js/outfits.js` (mục `HATS`, `BODIES` hoặc `ACCS`) |
| Thưởng mời bạn, số phút cần xem, món hiếm, giới hạn mỗi ngày | `server.js` → `INVITE_BONUS`, `INVITE_WATCH_MINUTES`, `INVITE_DONE_BONUS`, `INVITE_RARE_ITEM`, `INVITE_PER_DAY` |
| Thưởng ngồi chung sofa | `server.js` → `SOFA_BONUS` |
| Thưởng đoán đúng, các mức thời gian câu đoán | `lib/polls.js` → `POLL_REWARD`, `POLL_SECONDS` |
| Số người cần để nổ chùm emoji | `lib/moments.js` → hàm `burstNeeded` |
| Người được ra câu đoán bất cứ lúc nào | `config.json` → `hostUsers` (hoặc biến `HOST_USERS`) |
| Giá quà, thời gian hiệu lực, thêm quà mới | `server.js` → `GIFTS` (thêm quà mới: thêm một dòng với `name`, `icon`, `price`, `minutes`) |
| Số phòng riêng tối đa, phòng trống bao lâu thì đóng | `server.js` → `MAX_ROOMS`, `ROOM_EMPTY_MINUTES` |
| Số bạn bè / lời mời tối đa | `server.js` → `MAX_FRIENDS`, `MAX_FRIEND_REQUESTS` |
| Phần thưởng điểm danh 7 ngày | `lib/engage.js` → `CHECKIN_REWARDS` |
| Danh sách nhiệm vụ, phần thưởng, thưởng hoàn thành hết | `lib/engage.js` → `MISSION_POOL`, `MISSION_BONUS` |
| Các bảng xếp hạng tuần, giải thưởng top 1–2–3 | `lib/engage.js` → `LEADER_CATS`, `LEADER_PRIZES` |
| Thời gian chờ giữa 2 lần ném bỏng ngô | `server.js` → tìm `rateLimited(client, 'popcorn'` |
| Thời gian ghi nhớ đăng nhập | `lib/accounts.js` → `SESSION_DAYS` |
| Nơi lưu dữ liệu | Biến môi trường `DATA_DIR` (mặc định thư mục `data`) |
| Màu sắc giao diện | `public/style.css` → phần `:root` ở đầu file |
| Độ trong suốt của nút / bảng, phông chữ | `public/style.css` → khối "GIAO DIỆN KÍNH MỜ" ở cuối file: `--glass` (nút), `--glass-strong` (ngăn chat, hàng chờ), `--glass-card` (cửa sổ), `--font`. Số cuối trong `rgba(…, .38)` càng nhỏ càng trong suốt |
| Thời gian chờ trước khi các nút tự mờ | `public/js/main.js` → `IDLE_MS` (mặc định 4000 = 4 giây) |
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
├── lib/moderation.js    ← chặn từ ngữ xấu (đọc tu-cam.txt)
├── lib/guard.js         ← chống phá hoại: giới hạn theo IP, chặn IP, khoá tài khoản
├── lib/stats.js         ← thống kê người vào, giờ đông, video xem nhiều
├── lib/config.js        ← đọc config.json / biến môi trường
├── bot-chat.txt         ← câu chat của bot, mỗi dòng 1 câu
├── tu-cam.txt           ← từ ngữ bị che thành *** trong chat, mỗi dòng 1 từ
├── config.example.json  ← mẫu cấu hình ngân hàng + mật khẩu duyệt (copy thành config.json)
├── data/db.json         ← (tự tạo khi chạy) tài khoản, điểm, tủ đồ — nhớ sao lưu!
├── package.json
└── public/              ← phần chạy trên trình duyệt
    ├── index.html
    ├── admin.html       ← trang quản trị: duyệt ủng hộ, thống kê, lịch Đêm phim
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
