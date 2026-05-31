import * as echarts from '../../ec-canvas/echarts'

// 全局变量：存储图表实例与待渲染数据
let chartInstance = null
let pendingTrend = null

function buildEmptyTrendLabels(days = 7) {
  const labels = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    labels.push(`${m}-${day}`)
  }
  return labels
}

function applyChartData(xAxisData, seriesData) {
  if (!chartInstance) {
    pendingTrend = { xAxisData, seriesData }
    return
  }

  chartInstance.setOption({
    xAxis: { data: xAxisData },
    series: [{
      data: seriesData,
      type: 'line',
      smooth: true
    }]
  })
}

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  })
  canvas.setChart(chart)

  const emptyLabels = buildEmptyTrendLabels(7)
  const option = {
    color: ['#00C896'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: 40,
      right: 16,
      top: 24,
      bottom: 28
    },
    xAxis: {
      type: 'category',
      data: emptyLabels,
      axisLabel: { color: '#666', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#999', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eee' } }
    },
    series: [{
      type: 'line',
      smooth: true,
      data: new Array(7).fill(0),
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(0, 200, 150, 0.3)' },
          { offset: 1, color: 'rgba(0, 200, 150, 0.05)' }
        ])
      },
      lineStyle: { color: '#00C896', width: 2 },
      itemStyle: { color: '#00C896', borderWidth: 2 },
      symbolSize: 6
    }]
  }
  chart.setOption(option)

  chartInstance = chart

  if (pendingTrend) {
    applyChartData(pendingTrend.xAxisData, pendingTrend.seriesData)
    pendingTrend = null
  }

  return chart
}

const {
  ensureWxLogin,
  fetchRecords: apiFetchRecords,
  fetchTrend,
  syncWerunPayload,
  deleteRecord,
  clearRecords,
  isCloudMode
} = require('../../utils/api')

Page({
  data: {
    stepCount: 0,
    currentDate: '',
    records: [],
    trendLoading: false,
    ec: {
      onInit: initChart
    }
  },

  onLoad() {
    console.log('运动页面加载')
    this.setData({ currentDate: this.getTodayStr() })
  },

  getTodayStr() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },

  onShow() {
    // 每次显示页面时都刷新数据
    this.fetchTrendData();
    this.fetchRecords();
  },

  // ==================== 图表相关函数 ====================

  // 从后端获取折线图数据
  fetchTrendData() {
    this.setData({ trendLoading: true })

    fetchTrend(7)
      .then((data) => {
        this.setData({ trendLoading: false })
        const trendList = data.trend || []
        const xAxisData = trendList.map((item) => this.formatTrendLabel(item.stat_date))
        const seriesData = trendList.map((item) => item.step_count || 0)

        const todayStr = this.getTodayStr()
        const todayItem = trendList.find((item) => String(item.stat_date).slice(0, 10) === todayStr)
        const stepCount = todayItem
          ? (todayItem.step_count || 0)
          : (seriesData.length > 0 ? seriesData[seriesData.length - 1] : 0)

        this.setData({ stepCount })
        this.updateChart(xAxisData, seriesData)
      })
      .catch((err) => {
        this.setData({ trendLoading: false })
        console.error('趋势数据失败:', err)
      })
  },

  formatTrendLabel(statDate) {
    if (!statDate) return ''
    const str = String(statDate)
    if (str.length >= 10) {
      return str.substring(5, 10)
    }
    if (str.length >= 5) {
      return str.substring(0, 5)
    }
    return str
  },

  updateChart(xAxisData, seriesData) {
    console.log('更新图表，xAxis:', xAxisData, 'series:', seriesData)
    applyChartData(xAxisData, seriesData)
  },

  // ==================== 运动记录相关函数 ====================

  // 从后端获取运动记录
  fetchRecords() {
    apiFetchRecords(50)
      .then((data) => {
        const raw = data.records || []
        const records = raw.map((item) => ({
          ...item,
          record_time: this.formatRecordTime(item.record_time)
        }))
        this.setData({ records })
      })
      .catch((err) => {
        console.error('获取记录失败:', err)
      })
  },

  formatRecordTime(timeStr) {
    if (!timeStr) return ''
    const d = new Date(timeStr)
    if (Number.isNaN(d.getTime())) return String(timeStr)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  // ==================== 交互功能 ====================

    // 同步微信步数（真机专用）
    syncWeRun() {
      console.log('开始同步微信步数...')
      wx.showLoading({ title: '获取授权...' })
      
      // 1. 先检查权限
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.werun']) {
            // 已有权限，直接获取数据
            this._getWerunData()
          } else {
            // 没有权限，先申请
            wx.authorize({
              scope: 'scope.werun',
              success: () => {
                this._getWerunData()
              },
              fail: () => {
                wx.hideLoading()
                wx.showModal({
                  title: '需要授权',
                  content: '请开启微信运动权限以同步步数',
                  success: (res) => {
                    if (res.confirm) {
                      wx.openSetting({
                        success: (settingRes) => {
                          if (settingRes.authSetting['scope.werun']) {
                            this._getWerunData()
                          }
                        }
                      })
                    }
                  }
                })
              }
            })
          }
        },
        fail: (err) => {
          wx.hideLoading()
          console.error('获取设置失败', err)
          wx.showToast({ title: '授权失败', icon: 'none' })
        }
      })
    },
  
    // 内部函数：真正获取步数数据（先刷新 login 再 getWeRunData，避免 session_key 过期）
    _getWerunData() {
      wx.showLoading({ title: '登录验证...' })

      const doSync = (payload) => {
        wx.showLoading({ title: '同步中...' })
        syncWerunPayload(payload)
          .then((data) => {
            wx.hideLoading()
            const syncedDays = data.synced_days || 1
            this.setData({ stepCount: data.step_count })
            this.fetchTrendData()
            wx.showToast({
              title: data.used_mock
                ? `已同步${syncedDays}天(模拟)`
                : `已同步${syncedDays}天`,
              icon: 'success'
            })
          })
          .catch((err) => {
            wx.hideLoading()
            wx.showModal({
              title: '同步失败',
              content: err.message || '步数同步失败',
              showCancel: false
            })
          })
      }

      ensureWxLogin()
        .then((loginData) => {
          wx.showLoading({ title: '读取步数...' })
          wx.getWeRunData({
            success: (runRes) => {
              const payload = {}

              if (isCloudMode()) {
                if (runRes.cloudID) {
                  payload.weRunData = wx.cloud.CloudID(runRes.cloudID)
                } else {
                  payload.dev_step_count = 8888
                }
              } else {
                payload.encryptedData = runRes.encryptedData
                payload.iv = runRes.iv
                payload.session_key = loginData.session_key
                if (loginData.mock) payload.dev_step_count = 8888
              }

              doSync(payload)
            },
            fail: (err) => {
              console.warn('getWeRunData 失败，尝试模拟步数', err)
              if (isCloudMode()) {
                doSync({ dev_step_count: 8888 })
                return
              }
              wx.hideLoading()
              wx.showModal({
                title: '无法读取微信运动',
                content: '请在手机「设置 → 微信 → 运动」中开启步数，并在小程序里授权微信运动权限。',
                showCancel: false
              })
            }
          })
        })
        .catch((err) => {
          wx.hideLoading()
          wx.showModal({
            title: '登录失败',
            content: String(err.message || err) + '\n\n请确认云函数 api 已部署，且工具栏已选择云环境。',
            showCancel: false
          })
        })
    },
  // 跳转到添加记录页面
  goToAddRecord() {
    wx.navigateTo({
      url: '/pages/manual-record/manual-record'
    })
  },

  // 点击查看详情（弹窗显示）
  viewDetail(e) {
    const id = String(e.currentTarget.dataset.id)
    const record = this.data.records.find(
      (item) => String(item.record_id) === id
    )
    
    if (record) {
      wx.showModal({
        title: '运动详情',
        content: `类型：${record.exercise_type}\n时长：${record.duration}分钟\n热量：${record.calorie}千卡\n时间：${record.record_time}`,
        showCancel: false
      })
    }
  },

  // 从列表中移除一条（乐观更新）
  removeRecordLocally(id) {
    const targetId = String(id)
    const records = this.data.records.filter(
      (item) => String(item.record_id) !== targetId
    )
    this.setData({ records })
  },

  // 点击删除按钮 / 长按删除单条
  deleteOneRecord(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({ title: '记录ID无效', icon: 'none' })
      return
    }

    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecordFromApi(id)
        }
      }
    })
  },

  // 清空全部
  clearAllRecords() {
    if (this.data.records.length === 0) {
      wx.showToast({ title: '暂无记录可清空', icon: 'none' })
      return
    }

    wx.showModal({
      title: '清空记录',
      content: '确定要删除所有运动记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          this.clearAllRecordsFromApi()
        }
      }
    })
  },

  /** 调用后端清空接口 */
  clearAllRecordsFromApi() {
    wx.showLoading({ title: '清空中...' })
    clearRecords()
      .then(() => {
        wx.hideLoading()
        this.setData({ records: [] })
        wx.showToast({ title: '已清空', icon: 'success' })
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '清空失败', icon: 'none' })
        this.fetchRecords()
      })
  },

  /** 调用后端删除单条记录 */
  deleteRecordFromApi(id, showToast = true) {
    const recordId = String(id).trim()
    if (!recordId) {
      if (showToast) wx.showToast({ title: '记录ID无效', icon: 'none' })
      return
    }

    if (showToast) wx.showLoading({ title: '删除中...' })

    deleteRecord(recordId)
      .then(() => {
        if (showToast) wx.hideLoading()
        this.removeRecordLocally(recordId)
        if (showToast) wx.showToast({ title: '删除成功', icon: 'success' })
      })
      .catch((err) => {
        if (showToast) wx.hideLoading()
        if (showToast) wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        this.fetchRecords()
      })
  }
})