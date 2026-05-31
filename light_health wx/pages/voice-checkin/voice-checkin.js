const { estimateCalorie } = require('../../utils/calorie')
const { USER_ID, postRecord, speechToText } = require('../../utils/api')
const { NUMBER_TOKEN, parseNumberToken } = require('../../utils/chineseNumber')

const TYPE_KEYWORDS = ['跑步', '散步', '游泳', '瑜伽', '健身', '骑行']
const MAX_RECORD_MS = 29000
const MIN_RECORD_MS = 800

Page({
  data: {
    recognizedText: '',
    isRecording: false,
    isTranscribing: false,
    exercise_type: '',
    duration: '',
    calorie: '',
    calorieSource: '',
    estimatingCalorie: false
  },

  onLoad() {
    this.recorderManager = wx.getRecorderManager()
    this._recordStartAt = 0

    this.recorderManager.onStart(() => {
      this._recordStartAt = Date.now()
      this.setData({ isRecording: true })
    })

    this.recorderManager.onStop((res) => {
      this.setData({ isRecording: false })
      this.handleRecordStop(res)
    })

    this.recorderManager.onError((err) => {
      console.error('录音失败', err)
      this.setData({ isRecording: false, isTranscribing: false })
      wx.showToast({ title: '录音失败，请重试', icon: 'none' })
    })
  },

  startRecord() {
    if (this.data.isRecording || this.data.isTranscribing) return

    wx.authorize({
      scope: 'scope.record',
      success: () => this.doStartRecord(),
      fail: () => {
        wx.showModal({
          title: '需要麦克风权限',
          content: '请在设置中开启录音权限后重试',
          showCancel: false
        })
      }
    })
  },

  doStartRecord() {
    this.recorderManager.start({
      duration: MAX_RECORD_MS,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format: 'mp3'
    })
  },

  stopRecord() {
    if (!this.data.isRecording) return
    this.recorderManager.stop()
  },

  handleRecordStop(res) {
    if (!res || !res.tempFilePath) return

    const durationMs =
      res.duration || (this._recordStartAt ? Date.now() - this._recordStartAt : 0)

    if (durationMs < MIN_RECORD_MS) {
      wx.showToast({ title: '录音太短，请按住多说一会', icon: 'none' })
      return
    }

    this.transcribeVoice(res.tempFilePath)
  },

  /** 调用后端 ASR，将真实语音转成文字 */
  transcribeVoice(filePath) {
    this.setData({ isTranscribing: true })
    wx.showLoading({ title: '语音识别中...' })

    speechToText(filePath)
      .then((data) => {
        wx.hideLoading()
        this.setData({ isTranscribing: false })
        const text = data.text.trim()
        this.setData({ recognizedText: text, calorie: '', calorieSource: '' })
        this.parseText(text)
        wx.showToast({ title: '识别完成，请确认', icon: 'none' })
      })
      .catch((err) => {
        console.error('语音转写失败', err)
        wx.hideLoading()
        this.setData({ isTranscribing: false })
        wx.showModal({
          title: '语音识别失败',
          content: (err.message || '识别失败') + '\n\n你可以直接在下方文字框手动输入，例如：游泳 45 分钟',
          showCancel: false
        })
      })
  },

  parseDuration(text) {
    if (/半\s*个?\s*小时|半小时/.test(text)) {
      return 30
    }

    const num = NUMBER_TOKEN
    const hourMatch = text.match(new RegExp(`(${num})\\s*(?:个?小时|h)`, 'i'))
    if (hourMatch) {
      const minutes = Math.round(parseNumberToken(hourMatch[1]) * 60)
      if (minutes > 0) return minutes
    }

    const minMatch = text.match(new RegExp(`(${num})\\s*(?:分钟|min|分)`, 'i'))
    if (minMatch) {
      const minutes = Math.round(parseNumberToken(minMatch[1]))
      if (minutes > 0) return minutes
    }

    return ''
  },

  parseExerciseType(text) {
    for (const keyword of TYPE_KEYWORDS) {
      if (text.includes(keyword)) {
        return keyword
      }
    }

    const num = NUMBER_TOKEN
    let name = text
      .replace(new RegExp(`(${num})\\s*(?:分钟|min|分|个?小时|h)`, 'gi'), '')
      .replace(new RegExp(`(${num})\\s*(?:千卡|kcal|大卡)`, 'gi'), '')
      .replace(/半\s*个?\s*小时|半小时/g, '')
      .replace(/[，。,.、了啦吧呢]\s*/g, '')
      .trim()

    if (name.length >= 2 && name.length <= 12) {
      return name
    }

    return '其他'
  },

  parseText(text) {
    let exercise_type = '其他'
    let duration = ''
    let calorie = ''

    if (text && text.trim()) {
      const raw = text.trim()
      exercise_type = this.parseExerciseType(raw)
      duration = this.parseDuration(raw)

      const calorieMatch = raw.match(new RegExp(`(${NUMBER_TOKEN})\\s*(?:千卡|kcal|大卡)`, 'i'))
      if (calorieMatch) {
        const parsedCalorie = parseNumberToken(calorieMatch[1])
        if (parsedCalorie > 0) calorie = parsedCalorie
      }
    }

    const hadCalorieInText = !!calorie

    this.setData({
      exercise_type,
      duration,
      calorie: hadCalorieInText ? calorie : this.data.calorie
    }, () => {
      if (exercise_type && duration && !hadCalorieInText) {
        this.fetchCalorieEstimate()
      }
    })

    return { exercise_type, duration, calorie }
  },

  fetchCalorieEstimate() {
    const { exercise_type, duration, estimatingCalorie } = this.data
    if (!exercise_type || !duration || estimatingCalorie) return

    this.setData({ estimatingCalorie: true })

    estimateCalorie(exercise_type, duration)
      .then(({ calorie, source }) => {
        this.setData({
          calorie,
          calorieSource: source,
          estimatingCalorie: false
        })
        wx.showToast({ title: '已估算热量', icon: 'none' })
      })
      .catch(() => {
        const fallback = this.localEstimateCalorie(exercise_type, duration)
        this.setData({
          calorie: fallback,
          calorieSource: 'formula',
          estimatingCalorie: false
        })
        wx.showToast({ title: '已使用公式估算', icon: 'none' })
      })
  },

  localEstimateCalorie(exerciseType, duration) {
    const metMap = {
      跑步: 9.8,
      散步: 3.5,
      游泳: 8.0,
      瑜伽: 3.0,
      健身: 6.0,
      骑行: 7.5,
      其他: 5.0
    }
    let met = metMap[exerciseType]
    if (met == null) {
      for (const key of Object.keys(metMap)) {
        if (key !== '其他' && exerciseType.includes(key)) {
          met = metMap[key]
          break
        }
      }
    }
    met = met || 5.0
    return Math.round(met * 60 * (duration / 60) * 10) / 10
  },

  onTextInput(e) {
    const text = e.detail.value
    this.setData({ recognizedText: text })
    this.parseText(text)
  },

  submitRecord() {
    const { recognizedText, estimatingCalorie, isTranscribing } = this.data

    if (isTranscribing) {
      wx.showToast({ title: '语音识别中，请稍候', icon: 'none' })
      return
    }

    if (!recognizedText || !recognizedText.trim()) {
      wx.showToast({ title: '请先语音录入或手动输入', icon: 'none' })
      return
    }

    if (estimatingCalorie) {
      wx.showToast({ title: '正在估算热量', icon: 'none' })
      return
    }

    const parsed = this.parseText(recognizedText.trim())
    const exercise_type = parsed.exercise_type
    const duration = parsed.duration
    const calorie = parsed.calorie || this.data.calorie

    if (!exercise_type || !duration) {
      wx.showToast({
        title: '请说明运动类型和时长，如：游泳 45 分钟',
        icon: 'none'
      })
      return
    }

    const finish = (cal) => {
      if (!cal) {
        wx.showToast({ title: '无法估算热量', icon: 'none' })
        return
      }

      wx.showLoading({ title: '提交中...' })
      postRecord({
        user_id: USER_ID,
        exercise_type,
        duration: parseInt(duration, 10),
        calorie: parseFloat(cal),
        record_time: new Date().toISOString()
      })
        .then(() => {
          wx.hideLoading()
          wx.showToast({ title: '保存成功', icon: 'success' })
          setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1200)
        })
        .catch((err) => {
          wx.hideLoading()
          wx.showToast({ title: err.message || '保存失败', icon: 'none', duration: 3000 })
        })
    }

    if (calorie) {
      finish(calorie)
      return
    }

    wx.showLoading({ title: '估算热量...' })
    estimateCalorie(exercise_type, duration)
      .then(({ calorie: c }) => {
        wx.hideLoading()
        this.setData({ calorie: c })
        finish(c)
      })
      .catch(() => {
        wx.hideLoading()
        const fallback = this.localEstimateCalorie(exercise_type, duration)
        this.setData({ calorie: fallback })
        finish(fallback)
      })
  }
})
