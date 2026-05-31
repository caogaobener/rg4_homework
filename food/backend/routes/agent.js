const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

// 膳食诊断
router.post('/diagnosis', agentController.getDietDiagnosis);

// 生成配餐
router.post('/recipe', agentController.generateRecipe);

// 聊天
router.post('/chat', agentController.chat);

module.exports = router;