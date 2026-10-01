// Điểm vào cho Vercel: Vercel nhận diện file này (có import express + export default app)
// và chạy app như một Vercel Function. Thư mục public/ được CDN của Vercel phục vụ trực tiếp.
// Chạy trên máy thì dùng `npm start` (server/index.js).
import express from 'express';
import { createApp } from './server/app.js';

const app = express();
app.use(createApp().app);

export default app;
