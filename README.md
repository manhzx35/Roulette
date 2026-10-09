# Roulette Đạo Đức

Game web ôn tập trắc nghiệm (20 câu, chủ đề tư tưởng Hồ Chí Minh về văn hóa và đạo đức) kết hợp vòng quay Roulette. Chơi trên điện thoại hoặc máy tính, có bảng xếp hạng realtime để chiếu lên màn hình lớn.

## Luật chơi

- Vòng quay 41 ô: 20 Đỏ, 20 Đen, 1 Xanh. Mỗi ô có xác suất như nhau.
- Mỗi câu đúng được **+300 điểm**, có **30 giây** mỗi câu. Sai hoặc hết giờ được 0 điểm, không bị trừ.
- Sau mỗi 3 câu hỏi có **3 lượt quay**, dù trả lời đúng hay sai. Mỗi lượt cược một màu:
  - Đỏ/Đen **×2**: cược 100, trúng thì nhận về 200.
  - Xanh **×35**: cược 100, trúng thì nhận về 3.500.
  - Thua thì mất tiền cược. Được cược 0 điểm.
- Còn điểm thì phải quay đủ 3 lượt mới được trả lời tiếp.
- Hết điểm (về 0) mà vẫn còn lượt quay thì bỏ qua các lượt còn lại và sang 3 câu hỏi tiếp. Lượt quay không cộng dồn.
- Tổng cộng 7 vòng, mỗi lượt chơi mất khoảng 12–15 phút.

## Chạy trên máy

Cần Node.js 18 trở lên.

```bash
npm install
npm start
```

- Trang chơi: http://localhost:3000
- Bảng xếp hạng (chiếu lên màn hình): http://localhost:3000/bxh. Trang này hiện link và mã QR để sinh viên quét vào chơi.
- Khi khởi động, server in ra địa chỉ LAN (VD `http://192.168.1.5:3000`). Máy chủ và điện thoại cùng một Wi-Fi là vào được. Nếu điện thoại không vào được, hãy cho phép Node.js qua Windows Firewall.

### Đặt lại trò chơi giữa các buổi

Khởi động server kèm mã quản trị (PowerShell):

```powershell
$env:ADMIN_KEY="matkhau-cua-ban"; npm start
```

Sau đó bấm nút ⚙ ở góc phải dưới trang `/bxh` và nhập mã. Không đặt `ADMIN_KEY` thì nút này bị khoá.

Dữ liệu người chơi được lưu vào `data/state.json` mỗi 5 giây, nên server khởi động lại không mất điểm. Xoá file này (khi server đang tắt) cũng là cách đặt lại.

## Đưa lên mạng

| Cách | Chi phí | Ghi chú |
|---|---|---|
| **Vercel + Upstash Redis** (khuyên dùng) | Miễn phí | Link cố định `….vercel.app`, không ngủ, không mất điểm khi deploy lại |
| Laptop + Cloudflare Tunnel | Miễn phí | Link `https://….trycloudflare.com` đổi mỗi lần chạy, laptop phải bật suốt buổi |
| Laptop + Wi-Fi chung | Miễn phí | Wi-Fi trường hay chặn các máy kết nối với nhau |
| Railway | Trial $5 | Không ngủ, link cố định `….up.railway.app` |
| Render | Miễn phí | Ngủ sau 15 phút không có truy cập, khởi động lại là mất điểm |

Server tự chọn nơi lưu dữ liệu: có biến môi trường Upstash (`KV_REST_API_URL`/`KV_REST_API_TOKEN` hoặc `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) thì lưu vào Upstash Redis, không có thì lưu trong bộ nhớ + `data/state.json`. Chỉ Vercel bắt buộc phải có Upstash, vì Vercel chạy nhiều bản server cùng lúc.

### Vercel + Upstash Redis

1. Đưa code lên GitHub (repo Private cũng được). `node_modules/` và `data/` đã nằm trong `.gitignore`.
2. Vào vercel.com → **Add New → Project** → chọn repo → giữ nguyên cấu hình mặc định → **Deploy**. Lần deploy đầu, các API sẽ báo "chưa kết nối Upstash Redis": đúng như dự kiến.
3. Trong project vừa tạo: tab **Storage** → **Create Database** → chọn **Upstash for Redis** (Marketplace, gói Free) → vùng **Singapore (ap-southeast-1)** → **Connect** vào project. Vercel tự thêm biến kết nối (`KV_REST_API_URL`/`KV_REST_API_TOKEN` hoặc `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, server nhận cả hai kiểu tên).
4. **Settings → Environment Variables** → thêm `ADMIN_KEY` = mã quản trị của bạn.
5. **Deployments** → bấm ⋯ ở bản mới nhất → **Redeploy**.
6. Mở `https://<tên-project>.vercel.app/bxh` trên máy chiếu: mã QR tự trỏ về link Vercel.

Đã cấu hình sẵn trong `vercel.json`: function chạy ở Singapore (`sin1`, gần Việt Nam và cùng vùng với Upstash), link `/bxh` không cần đuôi `.html`. Trên Vercel, BXH tự hỏi server 2 giây/lần, có CDN cache 1 giây nên nhiều màn hình cùng xem không tốn thêm. Mỗi buổi 60 người dùng khoảng 18.000 lệnh Redis, gói Free của Upstash cho 500.000 lệnh/tháng.

Thử chế độ Vercel ngay trên máy trước khi deploy (dùng Upstash giả lập, không cần tài khoản):

```bash
npm run dev:vercel
```

### Laptop + Cloudflare Tunnel

```powershell
winget install --id Cloudflare.cloudflared
```

Terminal 1: `npm start`. Terminal 2:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Chiếu BXH từ chính laptop bằng `http://localhost:3000/bxh?link=https://<link-vừa-in-ra>.trycloudflare.com` để mã QR trỏ đúng link công khai. Quick Tunnel không hỗ trợ SSE; trang BXH tự chuyển sang hỏi server mỗi 2 giây nếu mở qua đường hầm.

### Render

Build command `npm install`, start command `npm start`, region Singapore, biến môi trường `ADMIN_KEY` và `NODE_ENV=production`. Mở link khoảng 2 phút trước buổi học. Không deploy lại trong lúc đang chơi vì sẽ mất điểm (hoặc gắn thêm Upstash như Vercel để giữ điểm).

### Railway

```bash
npm install -g @railway/cli
```

Sau đó chạy `railway login`, `railway init`, `railway up` trong thư mục dự án, thêm biến `ADMIN_KEY` trong dashboard, rồi `railway domain` để lấy link công khai.

## Kiểm thử

```bash
npm test
```

```bash
npm run loadtest
```

- `npm test`: luật chơi, 2 kiểu lưu trữ (bộ nhớ và Upstash giả lập), khoá chống bấm trùng, 2 server dùng chung dữ liệu, cấu hình Vercel.
- `npm run loadtest`: 60 người chơi ảo chơi trọn game cùng lúc trên 1 server tạm.
- Chế độ Vercel (PowerShell): `$env:MODE="vercel"; npm run loadtest` chạy 3 server dùng chung Upstash giả lập, mỗi request rơi ngẫu nhiên vào một server.
- Bắn vào server thật: `$env:URL="https://link-cua-ban"; npm run loadtest`. Nhớ đặt lại BXH bằng nút ⚙ sau khi test.

Muốn thử hiệu ứng JACKPOT khi phát triển thì chạy với `FORCE_SLOT=0` (mọi lượt quay ra ô Xanh). Biến này bị bỏ qua khi `NODE_ENV=production`.

## Cấu trúc

```
index.js           điểm vào cho Vercel
vercel.json        vùng Singapore, link không đuôi .html
server/
  index.js         chạy server thường (npm start)
  app.js           Express: API, BXH (SSE hoặc CDN cache), mã QR, đặt lại
  game.js          luật chơi, chạy hoàn toàn ở server
  questions.js     20 câu hỏi + đáp án, không bao giờ gửi xuống trình duyệt
  stores/memory.js lưu trong bộ nhớ + data/state.json (1 server)
  stores/upstash.js lưu trong Upstash Redis (nhiều server, Vercel)
public/
  index.html, css/style.css
  js/main.js       luồng màn hình
  js/api.js        gọi API, tự thử lại khi mạng chập chờn
  js/wheel.js      vòng quay Canvas 2D (quay ngay khi bấm, dừng đúng ô server trả về)
  js/sfx.js        âm thanh + nhạc nền tổng hợp bằng Web Audio
  js/fx.js         pháo giấy, đồng xu, số chạy
  bxh.html, js/bxh.js   bảng xếp hạng
scripts/
  loadtest.js      người chơi ảo
  dev-vercel.js    chạy thử chế độ Vercel trên máy
test/              unit test + Upstash giả lập
```
