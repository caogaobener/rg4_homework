const axios = require('axios');

// 配置你的Gemini API Key
// 方法1：在系统环境变量中设置GEMINI_API_KEY（推荐）
// 方法2：直接替换下面的process.env.GEMINI_API_KEY为你的实际key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '你的Gemini API Key在这里';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

// 【重要】后端访问Gemini需要配置代理
// 把下面的代理地址改成你本地代理的地址和端口
const PROXY_URL = 'http://127.0.0.1:7890';

// 拍照识食Prompt
const FOOD_ANALYSIS_PROMPT = `
你是一位拥有10年临床经验的"注册营养师(RD)"兼智能健康管家。你精通中国食物成分表。
分析食物，识别其名称并严格估算它的热量(kcal)、蛋白质(g)、碳水(g)、脂肪(g)，以及搭配贴士。
你必须且只能输出一个合法的 JSON 对象的字符串，不能包含任何 Markdown 格式包裹（严禁带 \`\`\`json 标记）。
确保数据结构完全符合如下：
{"foodName": "食物中文名", "calories": 250, "protein": 12.0, "carbs": 35.0, "fat": 8.0, "advice": "搭配意见"}
`;

// 膳食诊断Prompt
const DIAGNOSIS_PROMPT = `
根据用户今天的饮食记录，分析用户摄入的主要营养素、比例和食物组合。
列举优点和需要改善的问题，给出健康的微调替代建议。
请严格按照以下 JSON 格式返回，不可掺杂任何 Markdown 包裹符或前后多余解释：
{
  "score": 85, // 0-100 综合评分
  "pros": ["优点列表1", "优点列表2"], // 至少2个优点
  "cons": ["红榜避坑点1", "红榜避坑点2"], // 至少2个不足
  "alternatives": "针对性的替代升级方案，比如白米饭升级为燕麦饭"
}
`;

// 配餐生成Prompt
const RECIPE_PROMPT = `
用户今日已录入热量 {totalCalories}kcal，蛋白质 {totalProtein}g，碳水 {totalCarbs}g，脂肪 {totalFat}g。
今日限额1800kcal，当前还剩下 {leftCalories}kcal 的配额。
请为他量身定制下一餐的健康低脂且具有超强饱腹感的黄金菜谱。
请严格按照以下 JSON 格式返回，不可掺杂任何多余修饰：
{
  "recipeName": "菜谱名称",
  "targetCalories": 400, // 推荐的单餐热量
  "protein": 25.0,
  "carbs": 35.0,
  "fat": 8.0,
  "ingredients": "原料明细，如：龙利鱼 150g，芦笋 100g",
  "steps": "极简烹饪步骤，控制在3步以内"
}
`;

// 聊天Prompt
const CHAT_PROMPT = `
你是轻养派小程序的AI高级营养顾问。请用亲切简明的语气解答问题（100字内，多换行）。
你是中国注册营养师，擅长轻量食谱、控卡、饮食平衡指导。
`;

// 创建带代理的axios实例
const axiosInstance = axios.create({
  proxy: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890 // 改成你代理的实际端口
  },
  timeout: 30000
});

// 调用Gemini API
async function callGemini(prompt, base64Image = null, systemInstruction = null) {
  const maxRetries = 5;
  let delay = 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };
      
      // 添加图片（支持png和jpg格式）
      if (base64Image) {
        payload.contents[0].parts.push({
          inlineData: {
            mimeType: "image/jpeg", // 改成jpeg，兼容大多数图片
            data: base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
          }
        });
      }
      
      // 添加系统指令
      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }
      
      const response = await axiosInstance.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const textResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        throw new Error("AI响应异常空值");
      }
      
      return cleanAndLoadJson(textResponse);
    } catch (error) {
      console.error(`Gemini请求失败 (第${attempt}次):`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

// 清洗并加载JSON
function cleanAndLoadJson(rawText) {
  let cleaned = rawText.trim();
  
  // 移除Markdown代码块
  if (cleaned.startsWith("```")) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      cleaned = match[1].trim();
    }
  }
  
  // 提取JSON对象
  if (!(cleaned.startsWith("{") && cleaned.endsWith("}"))) {
    const match = cleaned.match(/({[\s\S]*})/);
    if (match) {
      cleaned = match[1].trim();
    }
  }
  
  return JSON.parse(cleaned);
}

module.exports = {
  analyzeFood: async (base64Image) => {
    return callGemini(FOOD_ANALYSIS_PROMPT, base64Image);
  },
  
  getDietDiagnosis: async (records) => {
    const foodListString = records.map(r => 
      `${r.type}: ${r.name} (热量:${r.calories}kcal, 蛋:${r.protein}g, 碳水:${r.carbs}g, 脂肪:${r.fat}g)`
    ).join("\n");
    
    const prompt = `根据用户今天的饮食记录：\n${foodListString}\n${DIAGNOSIS_PROMPT}`;
    return callGemini(prompt, null, "你是一个专业的营养膳食诊断专家。你必须只返回满足结构的JSON数据，严禁Markdown标记。");
  },
  
  generateRecipe: async (totalCalories, totalProtein, totalCarbs, totalFat) => {
    const leftCalories = Math.max(1800 - totalCalories, 0);
    const prompt = RECIPE_PROMPT
      .replace('{totalCalories}', totalCalories)
      .replace('{totalProtein}', totalProtein)
      .replace('{totalCarbs}', totalCarbs)
      .replace('{totalFat}', totalFat)
      .replace('{leftCalories}', leftCalories);
    
    return callGemini(prompt, null, "你是一位擅长定制减脂低卡、控糖膳食的五星级健康大厨。你必须只返回满足结构的JSON数据。");
  },
  
  chat: async (question) => {
    const prompt = `${CHAT_PROMPT}\n用户问题：${question}`;
    try {
      const response = await axiosInstance.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        contents: [{ parts: [{ text: prompt }] }]
      });
      
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我现在有点累了，请稍后再问我吧。";
    } catch (error) {
      console.error('聊天接口错误:', error.message);
      return "抱歉，网络有点问题，请稍后再试。";
    }
  }
};