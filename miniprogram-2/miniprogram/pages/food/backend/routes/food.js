const express = require('express');
const router = express.Router();
const multer = require('multer');
const foodController = require('../controllers/foodController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 获取今日记录
router.get('/records/today', foodController.getTodayRecords);

// 获取指定日期记录
router.get('/records', foodController.getRecordsByDate);

// 创建记录
router.post('/records', foodController.createRecord);

// 上传图片识别
router.post('/upload', upload.single('file'), foodController.uploadFoodImage);

// 语音解析
router.post('/voice', foodController.analyzeVoice);

module.exports = router;