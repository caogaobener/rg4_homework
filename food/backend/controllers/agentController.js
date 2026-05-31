const cozeService = require('../services/cozeService');

// 膳食诊断
exports.getDietDiagnosis = async (req, res) => {
  try {
    const { records } = req.body;
    const result = await cozeService.getDietDiagnosis(records);
    
    res.json({
      code: 0,
      message: 'success',
      data: result
    });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
};

// 生成定制配餐
exports.generateRecipe = async (req, res) => {
  try {
    const { totalCalories, totalProtein, totalCarbs, totalFat } = req.body;
    const result = await cozeService.generateRecipe(totalCalories, totalProtein, totalCarbs, totalFat);
    
    res.json({
      code: 0,
      message: 'success',
      data: result
    });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
};

// AI聊天
exports.chat = async (req, res) => {
  try {
    const { question } = req.body;
    const answer = await cozeService.chat(question);
    
    res.json({
      code: 0,
      message: 'success',
      data: { answer }
    });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
};