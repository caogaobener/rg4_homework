/**
 * 轻养派 - 运动数据云函数
 * action: login | createRecord | listRecords | deleteRecord | clearRecords | getTrend | syncWerun | importData
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COL = {
  USERS: 'app_users',
  RECORDS: 'exercise_records',
  WERUN: 'werun_data'
}

function ok(data, message = 'success') {
  return { code: 200, message, data }
}

function fail(message, code = 400) {
  return { code, message, data: null }
}

function genId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

const TZ = 'Asia/Shanghai'

function formatDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function getYesterdayStr() {
  const parts = formatDate(new Date()).split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

function parseStepDate(item) {
  const dec = item.dec || ''
  if (dec) {
    const normalized = String(dec).replace(/\./g, '-')
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  }
  if (item.timestamp) {
    const ts = Number(item.timestamp)
    const ms = ts > 1e12 ? ts : ts * 1000
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(ms))
    return formatted
  }
  return null
}

/** 兼容 CloudID 解密后的多种数据结构 */
function normalizeWeRunData(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch (e) {
      return null
    }
  }
  if (raw.stepInfoList && raw.stepInfoList.length) return raw
  if (raw.data && raw.data.stepInfoList && raw.data.stepInfoList.length) return raw.data
  return null
}

function parseStepList(werunData) {
  const list = (werunData && werunData.stepInfoList) || []
  const dayMap = {}
  list.forEach((item) => {
    const statDate = parseStepDate(item)
    if (statDate) {
      const step = Number(item.step || 0)
      dayMap[statDate] = Math.max(dayMap[statDate] || 0, step)
    }
  })
  return Object.keys(dayMap)
    .sort()
    .map((d) => ({ stat_date: d, step_count: dayMap[d] }))
}

/** 取 stepInfoList 中 timestamp 最新的一条 */
function getLatestFromRaw(werunRaw) {
  const list = (werunRaw && werunRaw.stepInfoList) || []
  let best = { step: 0, date: null, ts: 0 }
  list.forEach((item) => {
    const ts = Number(item.timestamp) || 0
    const step = Number(item.step || 0)
    if (ts >= best.ts) {
      best = { step, date: parseStepDate(item), ts }
    }
  })
  return best
}

/**
 * 修复「今日步数为 0」：仅当最新记录日期就是今天时才采用
 */
async function enrichTodaySteps(openid, stepEntries, werunRaw, devFallback) {
  const todayStr = formatDate(new Date())
  let idx = stepEntries.findIndex((e) => e.stat_date === todayStr)
  let todaySteps = idx >= 0 ? stepEntries[idx].step_count : null

  const latest = werunRaw ? getLatestFromRaw(werunRaw) : null

  if ((todaySteps === 0 || todaySteps === null) && latest && latest.date === todayStr && latest.step > 0) {
    todaySteps = latest.step
    console.log('今日步数取自最新微信记录:', latest.step)
  }

  if (todaySteps === 0 || todaySteps === null) {
    const dev = Number(devFallback)
    if (dev > 0) {
      todaySteps = dev
    } else {
      const existing = await db.collection(COL.WERUN)
        .where({ _openid: openid, stat_date: todayStr })
        .limit(1)
        .get()
      if (existing.data.length && existing.data[0].step_count > 0) {
        todaySteps = existing.data[0].step_count
      }
    }
  }

  if (todaySteps != null && todaySteps > 0) {
    if (idx >= 0) {
      stepEntries[idx].step_count = todaySteps
    } else {
      stepEntries.push({ stat_date: todayStr, step_count: todaySteps })
      stepEntries.sort((a, b) => a.stat_date.localeCompare(b.stat_date))
    }
  }

  return stepEntries
}

/** 修复昨天与今天步数相同（微信最新一条日期偏移导致） */
function fixYesterdayTodayDuplicate(stepEntries, werunRaw, todayStr) {
  const yesterdayStr = getYesterdayStr()
  const yIdx = stepEntries.findIndex((e) => e.stat_date === yesterdayStr)
  const tIdx = stepEntries.findIndex((e) => e.stat_date === todayStr)
  if (yIdx < 0 || tIdx < 0) return stepEntries
  if (stepEntries[yIdx].step_count !== stepEntries[tIdx].step_count) return stepEntries

  const list = [...((werunRaw && werunRaw.stepInfoList) || [])]
    .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))

  if (list.length < 2) return stepEntries

  const prev = list[1]
  const prevDate = parseStepDate(prev)
  const prevStep = Number(prev.step || 0)

  if (prevDate === yesterdayStr && prevStep > 0 && prevStep !== stepEntries[tIdx].step_count) {
    stepEntries[yIdx].step_count = prevStep
    console.log('修正昨日步数:', prevStep)
  }

  return stepEntries
}

function filterLastNDays(stepEntries, days = 7) {
  const end = formatDate(new Date())
  const startParts = end.split('-')
  const startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]))
  startDate.setDate(startDate.getDate() - (days - 1))
  const startStr = formatDate(startDate)
  return stepEntries.filter((e) => e.stat_date >= startStr && e.stat_date <= end)
}

/** 同步前清空近 N 天旧数据，避免历史脏数据残留 */
async function clearWerunInRange(openid, days = 7) {
  const end = formatDate(new Date())
  const startParts = end.split('-')
  const startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]))
  startDate.setDate(startDate.getDate() - (days - 1))
  const startStr = formatDate(startDate)

  const col = db.collection(COL.WERUN)
  const batch = await col
    .where({
      _openid: openid,
      stat_date: _.gte(startStr).and(_.lte(end))
    })
    .limit(100)
    .get()

  await Promise.all(batch.data.map((doc) => col.doc(doc._id).remove()))
  return batch.data.length
}

function generateMockSteps(baseCount, days = 7) {
  const offsets = [0.82, 0.91, 0.76, 1.05, 0.88, 0.95]
  const today = new Date()
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const statDate = formatDate(d)
    let steps = baseCount
    if (i > 0) {
      const ratio = offsets[(days - 1 - i) % offsets.length]
      steps = Math.round(baseCount * ratio)
    }
    result.push({ stat_date: statDate, step_count: Math.max(steps, 0) })
  }
  return result
}

async function ensureUser(openid) {
  const col = db.collection(COL.USERS)
  const found = await col.where({ _openid: openid }).limit(1).get()
  if (found.data.length) return found.data[0]

  const user = {
    _openid: openid,
    user_id: openid,
    nickname: '',
    create_time: db.serverDate()
  }
  await col.add({ data: user })
  return user
}

async function handleLogin(openid) {
  const user = await ensureUser(openid)
  return ok({
    user_id: user.user_id,
    openid,
    session_key: '',
    mock: false
  }, '登录成功')
}

async function handleCreateRecord(openid, params) {
  const { exercise_type, duration, calorie, record_time } = params
  if (!exercise_type || !duration || calorie == null) {
    return fail('缺少运动类型、时长或热量')
  }

  await ensureUser(openid)
  const recordId = genId()
  const now = new Date()
  const doc = {
    _openid: openid,
    user_id: openid,
    record_id: recordId,
    exercise_type: String(exercise_type).slice(0, 30),
    duration: parseInt(duration, 10),
    calorie: parseFloat(calorie),
    record_time: record_time || now.toISOString(),
    create_time: db.serverDate()
  }

  await db.collection(COL.RECORDS).add({ data: doc })
  return ok({
    record_id: recordId,
    user_id: openid,
    exercise_type: doc.exercise_type,
    duration: doc.duration,
    calorie: doc.calorie,
    record_time: doc.record_time,
    create_time: now.toISOString()
  }, '运动记录创建成功')
}

async function handleListRecords(openid, params) {
  const limit = Math.min(parseInt(params.limit, 10) || 50, 200)
  const res = await db.collection(COL.RECORDS)
    .where({ _openid: openid })
    .orderBy('record_time', 'desc')
    .limit(limit)
    .get()

  const records = res.data.map((r) => ({
    record_id: r.record_id,
    user_id: r.user_id,
    exercise_type: r.exercise_type,
    duration: r.duration,
    calorie: r.calorie,
    record_time: r.record_time,
    create_time: r.create_time
  }))

  return ok({ user_id: openid, total: records.length, records })
}

async function handleDeleteRecord(openid, params) {
  const recordId = String(params.record_id || '').trim()
  if (!recordId) return fail('记录ID不能为空')

  const found = await db.collection(COL.RECORDS)
    .where({ _openid: openid, record_id: recordId })
    .limit(1)
    .get()

  if (!found.data.length) return fail('记录不存在', 404)

  await db.collection(COL.RECORDS).doc(found.data[0]._id).remove()
  return ok({ record_id: recordId }, '删除成功')
}

async function handleClearRecords(openid) {
  const MAX = 100
  let total = 0
  let hasMore = true

  while (hasMore) {
    const batch = await db.collection(COL.RECORDS)
      .where({ _openid: openid })
      .limit(MAX)
      .get()

    if (!batch.data.length) {
      hasMore = false
      break
    }

    await Promise.all(batch.data.map((doc) =>
      db.collection(COL.RECORDS).doc(doc._id).remove()
    ))
    total += batch.data.length
    if (batch.data.length < MAX) hasMore = false
  }

  return ok({ deleted_count: total }, '清空成功')
}

async function handleGetTrend(openid, params) {
  const days = Math.min(Math.max(parseInt(params.days, 10) || 7, 1), 90)
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  const startStr = formatDate(start)
  const endStr = formatDate(end)

  const res = await db.collection(COL.WERUN)
    .where({
      _openid: openid,
      stat_date: _.gte(startStr).and(_.lte(endStr))
    })
    .orderBy('stat_date', 'asc')
    .limit(100)
    .get()

  const stepMap = {}
  res.data.forEach((r) => { stepMap[r.stat_date] = r.step_count })

  const trend = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const statDate = formatDate(d)
    trend.push({ stat_date: statDate, step_count: stepMap[statDate] || 0 })
  }

  return ok({ user_id: openid, days, trend })
}

async function upsertWerunSteps(openid, stepEntries) {
  const col = db.collection(COL.WERUN)
  const todayStr = formatDate(new Date())

  for (const entry of stepEntries) {
    // 不允许用 0 覆盖今日已有步数
    if (entry.stat_date === todayStr && entry.step_count === 0) {
      const existing = await col
        .where({ _openid: openid, stat_date: todayStr })
        .limit(1)
        .get()
      if (existing.data.length && existing.data[0].step_count > 0) {
        continue
      }
    }

    const found = await col
      .where({ _openid: openid, stat_date: entry.stat_date })
      .limit(1)
      .get()

    if (found.data.length) {
      await col.doc(found.data[0]._id).update({
        data: {
          step_count: entry.step_count,
          update_time: db.serverDate()
        }
      })
    } else {
      await col.add({
        data: {
          _openid: openid,
          user_id: openid,
          data_id: genId(),
          step_count: entry.step_count,
          stat_date: entry.stat_date,
          create_time: db.serverDate(),
          update_time: db.serverDate()
        }
      })
    }
  }

  const todayEntry = stepEntries.find((e) => e.stat_date === todayStr)
  if (todayEntry) return todayEntry.step_count
  if (stepEntries.length) return stepEntries[stepEntries.length - 1].step_count
  return 0
}

async function handleSyncWerun(openid, params) {
  await ensureUser(openid)

  let stepEntries = []
  let usedMock = false

  const werunRaw = normalizeWeRunData(params.weRunData)
  if (werunRaw) {
    stepEntries = parseStepList(werunRaw)
    console.log('微信步数解密成功，天数:', stepEntries.length)

    const todayStr = formatDate(new Date())
    stepEntries = await enrichTodaySteps(openid, stepEntries, werunRaw, params.dev_step_count)
    stepEntries = fixYesterdayTodayDuplicate(stepEntries, werunRaw, todayStr)
    stepEntries = filterLastNDays(stepEntries, 7)

    await clearWerunInRange(openid, 7)
  } else {
    console.log('未拿到有效 weRunData')
    if (params.dev_step_count != null) {
      stepEntries = generateMockSteps(Number(params.dev_step_count), 7)
      usedMock = true
      await clearWerunInRange(openid, 7)
    }
  }

  if (!stepEntries.length) {
    return fail('未能获取微信运动数据，请真机授权「微信运动」后重试')
  }

  const stepCount = await upsertWerunSteps(openid, stepEntries)
  const todayStr = formatDate(new Date())

  return ok({
    user_id: openid,
    step_count: stepCount,
    stat_date: todayStr,
    synced: true,
    synced_days: stepEntries.length,
    used_mock: usedMock
  }, usedMock
    ? `已同步 ${stepEntries.length} 天（模拟数据，真机可获真实步数）`
    : `微信步数同步成功，已更新 ${stepEntries.length} 天`)
}

async function handleImportData(openid, params) {
  const token = params.migrate_token || ''
  if (!process.env.MIGRATE_TOKEN || token !== process.env.MIGRATE_TOKEN) {
    return fail('迁移令牌无效', 403)
  }

  const records = params.exercise_records || []
  const werun = params.werun_data || []
  let recordCount = 0
  let werunCount = 0

  for (const r of records) {
    const exists = await db.collection(COL.RECORDS)
      .where({ record_id: r.record_id })
      .limit(1)
      .get()
    if (exists.data.length) continue

    await db.collection(COL.RECORDS).add({
      data: {
        _openid: openid,
        user_id: r.user_id || openid,
        record_id: r.record_id || genId(),
        exercise_type: r.exercise_type,
        duration: r.duration,
        calorie: r.calorie,
        record_time: r.record_time,
        create_time: r.create_time ? new Date(r.create_time) : db.serverDate()
      }
    })
    recordCount++
  }

  for (const w of werun) {
    const statDate = String(w.stat_date).slice(0, 10)
    const exists = await db.collection(COL.WERUN)
      .where({ _openid: openid, stat_date: statDate })
      .limit(1)
      .get()

    if (exists.data.length) {
      await db.collection(COL.WERUN).doc(exists.data[0]._id).update({
        data: { step_count: w.step_count, update_time: db.serverDate() }
      })
    } else {
      await db.collection(COL.WERUN).add({
        data: {
          _openid: openid,
          user_id: w.user_id || openid,
          data_id: w.data_id || genId(),
          step_count: w.step_count,
          stat_date: statDate,
          create_time: db.serverDate(),
          update_time: db.serverDate()
        }
      })
    }
    werunCount++
  }

  return ok({ recordCount, werunCount }, `迁移完成：${recordCount} 条运动记录，${werunCount} 条步数`)
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return fail('未获取到用户 openid，请使用真机或开发者工具登录态调试', 401)
  }

  const action = event.action || 'login'

  try {
    switch (action) {
      case 'login':
        return await handleLogin(openid)
      case 'createRecord':
        return await handleCreateRecord(openid, event)
      case 'listRecords':
        return await handleListRecords(openid, event)
      case 'deleteRecord':
        return await handleDeleteRecord(openid, event)
      case 'clearRecords':
        return await handleClearRecords(openid)
      case 'getTrend':
        return await handleGetTrend(openid, event)
      case 'syncWerun':
        return await handleSyncWerun(openid, event)
      case 'importData':
        return await handleImportData(openid, event)
      default:
        return fail(`未知 action: ${action}`, 404)
    }
  } catch (err) {
    console.error(`api/${action} 错误:`, err)
    return fail(err.message || '服务器错误', 500)
  }
}
