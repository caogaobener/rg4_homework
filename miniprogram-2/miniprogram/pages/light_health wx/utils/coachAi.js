/**
 * 运动教练 AI：优先走 wx.cloud.extend.AI（不受云函数 3 秒默认超时限制）
 * 失败时由 api.js 回退到 agent 云函数
 */
const SYSTEM_PROMPT = `你是「轻养派」小程序的专属 AI 运动教练，具备运动科学、体能训练与运动营养背景。
请用简体中文回答用户关于运动、健身、拉伸、减脂、增肌、饮食搭配、运动损伤预防等问题。
要求：
1. 先准确理解用户问题，直接给出可执行建议，不要答非所问，不要重复介绍小程序功能或麦克风用法
2. 涉及疾病、伤病或用药时，提醒用户咨询医生，不要替代医疗诊断
3. 条理清晰，可分点说明，单次回复 200-400 字
4. 语气亲切务实，像靠谱私教`

// hunyuan-exp 已于 2026-05-30 下架，改用 hunyuan-v3 + hy3-preview
const EXTEND_MODELS = [
  { provider: 'hunyuan-v3', model: 'hy3-preview' },
  { provider: 'cloudbase', model: 'hy3-preview' },
  { provider: 'cloudbase', model: 'deepseek-v4-flash' }
]

function canUseExtendAI() {
  try {
    return !!(wx.cloud && wx.cloud.extend && wx.cloud.extend.AI && wx.cloud.extend.AI.createModel)
  } catch (e) {
    return false
  }
}

function buildMessages(message, history) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  ;(history || []).forEach((item) => {
    if (!item || !item.role || !item.content) return
    const role = item.role === 'assistant' || item.role === 'user' ? item.role : null
    const content = String(item.content).trim()
    if (role && content) messages.push({ role, content })
  })
  messages.push({ role: 'user', content: message })
  return messages
}

function extractReply(res) {
  if (!res) return ''
  if (res.choices && res.choices[0] && res.choices[0].message) {
    return String(res.choices[0].message.content || '').trim()
  }
  if (typeof res.text === 'string') return res.text.trim()
  return ''
}

function tryExtendModel(provider, modelId, messages) {
  const chatModel = wx.cloud.extend.AI.createModel(provider)
  return chatModel.generateText({ model: modelId, messages })
    .then((res) => {
      const reply = extractReply(res)
      if (!reply) throw new Error('AI 返回内容为空')
      return reply
    })
}

function agentChatViaExtendAI(message, history) {
  const messages = buildMessages(message, history)
  let lastErr = null

  function tryNext(index) {
    if (index >= EXTEND_MODELS.length) {
      return Promise.reject(lastErr || new Error('extend.AI 不可用，请检查云开发 AI 能力是否已开通'))
    }
    const attempt = EXTEND_MODELS[index]
    console.log('[教练] 尝试 extend.AI', attempt.provider, attempt.model)
    return tryExtendModel(attempt.provider, attempt.model, messages)
      .then((reply) => {
        console.log('[教练] extend.AI 成功', attempt.provider)
        return { reply }
      })
      .catch((err) => {
        console.warn('[教练] extend.AI 失败', attempt.provider, err.message || err)
        lastErr = err
        return tryNext(index + 1)
      })
  }

  return tryNext(0)
}

module.exports = {
  SYSTEM_PROMPT,
  canUseExtendAI,
  agentChatViaExtendAI
}
