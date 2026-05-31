const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

// 导入路由
const foodRoutes = require('./routes/food');
const agentRoutes = require('./routes/agent');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// // 全局中间件：JWT认证
// app.use((req, res, next) => {
//   // 跳过不需要认证的路由（如登录）
//   if (req.path === '/api/auth/login') {
//     return next();
//   }
  
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     // 开发环境跳过认证
//     if (process.env.NODE_ENV === 'development') {
//       req.user = { userId: 'test-user-id' };
//       return next();
//     }
//     return res.status(401).json({ code: 1, message: '未授权访问' });
//   }
  
//   // 验证JWT
//   try {
//     const token = authHeader.split(' ')[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     return res.status(401).json({ code: 1, message: '无效的token' });
//   }
// });

// 注册路由
app.use('/api/food', foodRoutes);
app.use('/api/agent', agentRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ code: 1, message: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});