/**
 * 统一 API 层：云开发模式 / 本地 FastAPI 模式自动切换
 */
const { canUseExtendAI, agentChatViaExtendAI } = require('./coachAi')
const USE_CLOUD = true
const DEFAULT_HOST = 'http://192.168.43.70'  
const API_PORT = 8001
const LOCAL_USER_ID = 'test_user_001'

/** 是否使用云开发（以 USE_CLOUD 为准，避免 getApp 时机导致误判） */
function isCloudMode() {
  if (!USE_CLOUD) return false
  if (!wx.cloud) {
    console.error('当前基础库不支持 wx.cloud，请升级微信开发者工具')
    return false
  }
  return true
}

function getCloudEnv() {
  try {
    const app = getApp()
    return (app && app.globalData && app.globalData.cloudEnv) || ''
  } catch (e) {
    return ''
  }
}

function normalizeBase(url) {
  let base = (url || DEFAULT_HOST).trim().replace(/\/$/, '')
  if (!/^https?:\/\//i.test(base)) base = 'http://' + base
  if (!/:\d+(\/|$)/.test(base.replace(/^https?:\/\//, ''))) {
    base = `${base}:${API_PORT}`
  }
  return base
}

function getBaseUrl() {
  const app = getApp()
  return normalizeBase(app && app.globalData && app.globalData.baseUrl)
}

function getCoachBaseUrl() {
  const app = getApp()
  const coach = app && app.globalData && app.globalData.coachBaseUrl
  return normalizeBase(coach || getBaseUrl())
}

function getUserId() {
  const app = getApp()
  if (isCloudMode() && app.globalData.openid) {
    return app.globalData.openid
  }
  return LOCAL_USER_ID
}

/** wx.request 成功判断（本地模式） */
function isApiOk(res) {
  return res && res.statusCode === 200 && res.data && res.data.code === 200
}

/** 云函数 / 本地 统一成功判断 */
function isResultOk(result) {
  return result && result.code === 200
}

function parseApiError(res, fallback = '请求失败') {
  if (!res) return fallback
  if (res.message) return res.message
  if (res.data) {
    if (typeof res.data.message === 'string' && res.data.message) return res.data.message
    if (typeof res.data.detail === 'string' && res.data.detail) return res.data.detail
  }
  if (res.statusCode === 404) {
    return '接口未找到，请确认后端已启动且地址端口正确（如 :8001）'
  }
  return `${fallback}（${res.statusCode || '网络'}）`
}

function formatCloudError(err, fallback) {
  const msg = (err && err.errMsg) || ''
  if (/504003|timed out|timeout|FUNCTIONS_TIME_LIMIT_EXCEEDED/i.test(msg)) {
    return 'AI 回复超时：请在云开发控制台将 agent 云函数超时改为 60 秒'
  }
  return msg || fallback
}

function callCloud(name, data, options = {}) {
  return new Promise((resolve, reject) => {
    const env = getCloudEnv()
    const opts = { name, data }

    if (env) {
      opts.config = { env }
    }

    if (options.timeout) {
      opts.timeout = options.timeout
    }

    wx.cloud.callFunction({
      ...opts,
      success(res) {
        const result = res.result
        console.log(`[云函数] ${name} 返回`, result)
        if (isResultOk(result)) {
          resolve(result)
        } else {
          reject(new Error((result && result.message) || '云函数调用失败'))
        }
      },
      fail(err) {
        console.error(`[云函数] ${name} 失败:`, err)
        reject(new Error(formatCloudError(
          err,
          '云函数调用失败：请确认已在工具栏选择云环境，且 api/agent 已部署'
        )))
      }
    })
  })
}

function localRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success(res) {
        if (isApiOk(res)) {
          resolve(res.data)
        } else {
          reject(new Error(parseApiError(res, options.failMsg || '请求失败')))
        }
      },
      fail() {
        reject(new Error(options.networkMsg || '无法连接服务器'))
      }
    })
  })
}

function ensureWxLogin() {
  if (isCloudMode()) {
    return callCloud('api', { action: 'login' }).then((result) => {
      const app = getApp()
      app.globalData.openid = result.data.openid
      app.globalData.sessionKey = result.data.session_key || ''
      app.globalData.wxMock = !!result.data.mock
      return result.data
    })
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('wx.login 未返回 code'))
          return
        }
        localRequest({
          url: `${getBaseUrl()}/api/wechat/session`,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: { code: loginRes.code, user_id: LOCAL_USER_ID },
          failMsg: '微信登录失败',
          networkMsg: '无法连接后端'
        }).then((data) => {
          const app = getApp()
          app.globalData.sessionKey = data.data.session_key
          app.globalData.wxMock = !!data.data.mock
          app.globalData.openid = data.data.openid
          resolve(data.data)
        }).catch(reject)
      },
      fail: reject
    })
  })
}

function postRecord(payload) {
  if (isCloudMode()) {
    return callCloud('api', {
      action: 'createRecord',
      exercise_type: payload.exercise_type,
      duration: payload.duration,
      calorie: payload.calorie,
      record_time: payload.record_time
    })
  }

  return localRequest({
    url: `${getBaseUrl()}/api/exercise/record`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: payload,
    failMsg: '保存失败',
    networkMsg: '无法连接服务器，请确认已启动「启动后端服务.bat」'
  })
}

function fetchRecords(limit = 50) {
  const userId = getUserId()

  if (isCloudMode()) {
    return callCloud('api', { action: 'listRecords', limit }).then((r) => r.data)
  }

  return localRequest({
    url: `${getBaseUrl()}/api/exercise/record/${userId}`,
    method: 'GET',
    data: { limit, offset: 0 },
    failMsg: '获取记录失败'
  }).then((r) => r.data)
}

function fetchTrend(days = 7) {
  const userId = getUserId()

  if (isCloudMode()) {
    return callCloud('api', { action: 'getTrend', days }).then((r) => r.data)
  }

  return localRequest({
    url: `${getBaseUrl()}/api/exercise/trend`,
    data: { user_id: userId, days },
    failMsg: '获取趋势失败'
  }).then((r) => r.data)
}

function syncWerunPayload(payload) {
  if (isCloudMode()) {
    return callCloud('api', { action: 'syncWerun', ...payload }).then((r) => r.data)
  }

  return localRequest({
    url: `${getBaseUrl()}/api/exercise/werun/sync`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { user_id: LOCAL_USER_ID, ...payload },
    failMsg: '步数同步失败',
    networkMsg: '无法连接后端'
  }).then((r) => r.data)
}

function deleteRecord(recordId) {
  if (isCloudMode()) {
    return callCloud('api', { action: 'deleteRecord', record_id: recordId })
  }

  return localRequest({
    url: `${getBaseUrl()}/api/exercise/record/${encodeURIComponent(recordId)}`,
    method: 'DELETE',
    failMsg: '删除失败'
  })
}

function clearRecords() {
  if (isCloudMode()) {
    return callCloud('api', { action: 'clearRecords' })
  }

  return localRequest({
    url: `${getBaseUrl()}/api/exercise/record/clear`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { user_id: LOCAL_USER_ID },
    failMsg: '清空失败'
  })
}

const AGENT_CLOUD_TIMEOUT = 60000

function agentChatViaCloud(message, history) {
  return callCloud('agent', { action: 'chat', message, history }, { timeout: AGENT_CLOUD_TIMEOUT })
    .then((r) => r.data)
}

function agentChat(message, history) {
  if (isCloudMode()) {
    if (canUseExtendAI()) {
      return agentChatViaExtendAI(message, history).catch((err) => {
        console.warn('[教练] extend.AI 不可用，回退 agent 云函数', err.message || err)
        return agentChatViaCloud(message, history)
      })
    }
    return agentChatViaCloud(message, history)
  }

  return localRequest({
    url: `${getCoachBaseUrl()}/api/agent/chat`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { message, user_id: LOCAL_USER_ID, history },
    failMsg: '教练暂时无法回复'
  }).then((r) => r.data)
}

function estimateCalorieRemote(payload) {
  if (isCloudMode()) {
    return callCloud('agent', { action: 'estimateCalorie', ...payload }, { timeout: AGENT_CLOUD_TIMEOUT })
      .then((r) => r.data)
  }

  return localRequest({
    url: `${getCoachBaseUrl()}/api/agent/estimate-calorie`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: payload,
    failMsg: '热量估算失败'
  }).then((r) => r.data)
}

function speechToText(filePath) {
  if (isCloudMode()) {
    const cloudPath = `voice/${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success(uploadRes) {
          callCloud('agent', { action: 'speechToText', fileID: uploadRes.fileID }, { timeout: AGENT_CLOUD_TIMEOUT })
            .then((r) => resolve(r.data))
            .catch(reject)
        },
        fail(err) {
          reject(new Error(err.errMsg || '语音上传失败'))
        }
      })
    })
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${getCoachBaseUrl()}/api/agent/speech-to-text`,
      filePath,
      name: 'file',
      success(res) {
        let body = res.data
        if (typeof body === 'string') {
          try { body = JSON.parse(body) } catch (e) { body = null }
        }
        if (res.statusCode === 200 && body && body.code === 200 && body.data) {
          resolve(body.data)
        } else {
          reject(new Error(parseApiError({ statusCode: res.statusCode, data: body }, '语音识别失败')))
        }
      },
      fail: reject
    })
  })
}

module.exports = {
  USE_CLOUD,
  LOCAL_USER_ID,
  USER_ID: LOCAL_USER_ID,
  API_PORT,
  normalizeBase,
  getBaseUrl,
  getCoachBaseUrl,
  getUserId,
  isCloudMode,
  isApiOk,
  isResultOk,
  parseApiError,
  ensureWxLogin,
  postRecord,
  fetchRecords,
  fetchTrend,
  syncWerunPayload,
  deleteRecord,
  clearRecords,
  agentChat,
  estimateCalorieRemote,
  speechToText
}
