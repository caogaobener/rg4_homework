Page({
  data: {
    remindSwitch: false,
    duration: 30,
    isReminding: false,
    statusText: '准备就绪',
    statusType: 'ready',
    timerId: null
  },

  onLoad() {
    const settings = wx.getStorageSync('remind_settings')
    if (settings && settings.duration) {
      const duration = Number(settings.duration)
      if (duration > 0) {
        this.setData({ duration })
      }
    }
  },

  onUnload() {
    this.clearTimer()
    wx.setKeepScreenOn({ keepScreenOn: false })
  },

  clearTimer() {
    if (this.data.timerId) {
      clearTimeout(this.data.timerId)
      this.data.timerId = null
    }
  },

  /** 加长震动提醒 */
  vibrateRemind() {
    wx.vibrateLong({})
    setTimeout(() => wx.vibrateLong({}), 500)
    setTimeout(() => wx.vibrateShort({ type: 'heavy' }), 1000)
    setTimeout(() => wx.vibrateShort({ type: 'heavy' }), 1300)
    setTimeout(() => wx.vibrateShort({ type: 'heavy' }), 1600)
  },

  /** 弹窗 + 震动提醒（小程序内弹窗，需保持在前台或从后台返回可见） */
  showRemindAlert(duration) {
    this.vibrateRemind()
    wx.showModal({
      title: '久坐提醒',
      content: `您已经坐了 ${duration} 分钟啦！\n快起来活动一下，伸展筋骨、喝杯水吧～`,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#00C896'
    })
  },

  updateStatusType(statusText, isReminding, remindSwitch) {
    if (isReminding) return 'active'
    if (statusText === '已停止') return 'idle'
    if (remindSwitch) return 'ready'
    return 'idle'
  },

  onSwitchChange(e) {
    const remindSwitch = e.detail.value
    const updates = { remindSwitch }

    if (!remindSwitch && this.data.isReminding) {
      this.clearTimer()
      wx.setKeepScreenOn({ keepScreenOn: false })
      updates.isReminding = false
      updates.statusText = '已停止'
    } else if (!this.data.isReminding) {
      updates.statusText = remindSwitch ? '准备就绪' : '未开始'
    }

    updates.statusType = this.updateStatusType(
      updates.statusText || this.data.statusText,
      updates.isReminding !== undefined ? updates.isReminding : this.data.isReminding,
      remindSwitch
    )

    this.setData(updates)
  },

  onDurationInput(e) {
    this.setData({ duration: e.detail.value })
  },

  toggleReminder() {
    if (!this.data.remindSwitch) {
      wx.showToast({ title: '请先开启提醒', icon: 'none' })
      return
    }

    if (this.data.isReminding) {
      this.clearTimer()
      wx.setKeepScreenOn({ keepScreenOn: false })
      this.setData({
        isReminding: false,
        statusText: '已停止',
        statusType: 'idle'
      })
      wx.showToast({ title: '提醒已取消', icon: 'none' })
      return
    }

    const duration = Number(this.data.duration)
    if (!duration || duration <= 0) {
      wx.showToast({ title: '请输入有效的间隔时间', icon: 'none' })
      return
    }

    wx.setStorageSync('remind_settings', { duration })
    wx.setKeepScreenOn({ keepScreenOn: true })

    wx.showLoading({ title: '开始计时...' })

    this.clearTimer()

    const timerId = setTimeout(() => {
      this.data.timerId = null
      wx.setKeepScreenOn({ keepScreenOn: false })
      this.showRemindAlert(duration)

      this.setData({
        isReminding: false,
        statusText: '准备就绪',
        statusType: this.updateStatusType('准备就绪', false, this.data.remindSwitch)
      })

      wx.showToast({ title: '本轮提醒已送达', icon: 'none' })
    }, duration * 60 * 1000)

    this.data.timerId = timerId

    this.setData({
      duration,
      isReminding: true,
      statusText: '提醒中',
      statusType: 'active'
    })

    wx.hideLoading()
    wx.showToast({ title: `已设置，${duration}分钟后提醒`, icon: 'none' })
  }
})
