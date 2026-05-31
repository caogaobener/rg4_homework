/**
 * 轻养派 - 运动教练 AI 云函数
 * 环境变量：ZHIPU_API_KEY
 */
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MODEL_NAME = 'glm-4-flash'
const ASR_MODEL = 'glm-asr-2512'
const DEFAULT_WEIGHT = 60

const SYSTEM_PROMPT = `你是「轻养派」小程序的专属 AI 运动教练，具备运动科学、体能训练与运动营养背景。
请用简体中文回答用户关于运动、健身、拉伸、减脂、增肌、饮食搭配、运动损伤预防等问题。
要求：
1. 先准确理解用户问题，直接给出可执行建议，不要答非所问，不要重复介绍小程序功能或麦克风用法
2. 涉及疾病、伤病或用药时，提醒用户咨询医生，不要替代医疗诊断
3. 条理清晰，可分点说明，单次回复 200-400 字
4. 语气亲切务实，像靠谱私教`

const CALORIE_PROMPT = '你是运动热量估算助手。必须只回复 JSON：{"calorie": 数字}，不要 markdown。'

const MET_TABLE = {
  跑步: 9.8, 散步: 3.5, 游泳: 8.0, 瑜伽: 3.0, 健身: 6.0, 骑行: 7.5, 其他: 5.0
}

function ok(data, message = 'success') {
  return { code: 200, message, data }
}

function fail(message, code = 400) {
  return { code, message, data: null }
}

function getApiKey() {
  return process.env.ZHIPU_API_KEY || ''
}

function httpsRequest(options, postData, timeoutMs = 55000) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        let data
        try {
          data = JSON.parse(body)
        } catch (e) {
          reject(new Error(body || '响应解析失败'))
          return
        }
        if (res.statusCode >= 400) {
          const msg = (data.error && data.error.message) || data.message || body || `HTTP ${res.statusCode}`
          reject(new Error(msg))
          return
        }
        resolve(data)
      })
    })
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error('AI 接口响应超时'))
    })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

function extractMessageContent(message) {
  if (!message || message.content == null) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part.text === 'string') return part.text
        return ''
      })
      .join('')
  }
  return String(message.content)
}

async function zhipuChat(messages, temperature = 0.55) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('未配置 ZHIPU_API_KEY，请在云函数环境变量中设置')

  const payload = JSON.stringify({
    model: MODEL_NAME,
    messages,
    temperature,
    top_p: 0.85,
    max_tokens: 800
  })

  const data = await httpsRequest({
    hostname: 'open.bigmodel.cn',
    path: '/api/paas/v4/chat/completions',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload)

  if (data.error) throw new Error(data.error.message || 'AI 调用失败')
  const reply = extractMessageContent(data.choices && data.choices[0] && data.choices[0].message)
  if (!reply) throw new Error('AI 返回内容为空')
  return reply.trim()
}

async function zhipuTranscribe(fileBuffer) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('未配置 ZHIPU_API_KEY')

  const boundary = `----Boundary${Date.now()}`
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${ASR_MODEL}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]
  const body = Buffer.concat(parts)

  const data = await httpsRequest({
    hostname: 'open.bigmodel.cn',
    path: '/api/paas/v4/audio/transcriptions',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    }
  }, body)

  if (data.error) throw new Error(data.error.message || '语音识别失败')
  const text = (data.text || '').trim()
  if (!text) throw new Error('语音识别结果为空')
  return text
}

function localEstimate(exerciseType, duration, weight) {
  let met = MET_TABLE[exerciseType]
  if (met == null) {
    Object.keys(MET_TABLE).forEach((key) => {
      if (key !== '其他' && exerciseType.includes(key)) met = MET_TABLE[key]
    })
  }
  met = met || MET_TABLE['其他']
  return Math.round(met * weight * (duration / 60) * 10) / 10
}

function parseCalorie(text) {
  if (!text) return null
  try {
    const obj = JSON.parse(text.trim())
    if (obj.calorie != null) return parseFloat(obj.calorie)
  } catch (e) { /* ignore */ }
  const m = text.match(/"calorie"\s*:\s*(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

async function handleChat(params) {
  const message = (params.message || '').trim()
  if (!message) return fail('message 不能为空')

  const history = (params.history || [])
    .slice(-10)
    .filter((item) => item && item.role && item.content)
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  history.forEach((item) => {
    const role = item.role === 'assistant' || item.role === 'user' ? item.role : null
    const content = String(item.content || '').trim()
    if (role && content) messages.push({ role, content })
  })
  messages.push({ role: 'user', content: message })

  const reply = await zhipuChat(messages)
  return ok({ reply })
}

async function handleSpeechToText(params) {
  if (!params.fileID) return fail('缺少 fileID')
  const download = await cloud.downloadFile({ fileID: params.fileID })
  const text = await zhipuTranscribe(download.fileContent)
  return ok({ text })
}

async function handleEstimateCalorie(params) {
  const exerciseType = (params.exercise_type || '').trim()
  const custom = (params.custom_exercise_type || '').trim()
  const duration = parseInt(params.duration, 10)
  const weight = parseFloat(params.weight) || DEFAULT_WEIGHT

  let resolved = exerciseType
  if (exerciseType === '其他') {
    if (!custom) return fail('选择「其他」时请填写自定义运动类型')
    resolved = custom
  }
  if (!resolved || !duration || duration <= 0) return fail('缺少运动类型或时长')

  let calorie = null
  let source = 'formula'

  try {
    const raw = await zhipuChat([
      { role: 'system', content: CALORIE_PROMPT },
      { role: 'user', content: `运动类型：${resolved}\n时长：${duration} 分钟\n体重：${weight} kg` }
    ], 0.2)
    const parsed = parseCalorie(raw)
    if (parsed != null && parsed > 0) {
      calorie = Math.round(parsed * 10) / 10
      source = 'ai'
    }
  } catch (e) {
    console.warn('AI 估算失败，使用公式', e.message)
  }

  if (calorie == null) {
    calorie = localEstimate(resolved, duration, weight)
    source = 'formula'
  }

  return ok({ calorie, source, exercise_type: resolved, duration })
}

exports.main = async (event) => {
  const action = event.action || 'chat'
  try {
    switch (action) {
      case 'ping':
        return ok({
          ts: Date.now(),
          hasApiKey: !!getApiKey(),
          hint: '若 chat 仍超时，请在云开发控制台将 agent 云函数超时改为 60 秒'
        })
      case 'chat': return await handleChat(event)
      case 'speechToText': return await handleSpeechToText(event)
      case 'estimateCalorie': return await handleEstimateCalorie(event)
      default: return fail(`未知 action: ${action}`, 404)
    }
  } catch (err) {
    console.error(`agent/${action}:`, err)
    return fail(err.message || 'AI 服务错误', 500)
  }
}
