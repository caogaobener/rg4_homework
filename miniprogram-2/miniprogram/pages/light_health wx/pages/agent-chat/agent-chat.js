const { agentChat, speechToText } = require('../../utils/api')

/** 智谱 ASR 限制：音频 0–30 秒 */
const MAX_RECORD_MS = 29000
const MIN_RECORD_MS = 800

Page({
  data: {
    messages: [],
    inputValue: '',
    scrollIntoView: '',
    typing: false,
    isRecording: false,
    isTranscribing: false,
    recordTip: ''
  },

  onLoad() {
    this.recorderManager = wx.getRecorderManager()
    this._recordStartAt = 0

    this.recorderManager.onStart(() => {
      this._recordStartAt = Date.now()
      this.setData({
        isRecording: true,
        recordTip: '松开结束 · 最长30秒'
      })
    })

    this.recorderManager.onStop((res) => {
      this.setData({ isRecording: false, recordTip: '' })
      this.handleRecordStop(res)
    })

    this.recorderManager.onError((err) => {
      console.error('录音失败', err)
      this.setData({ isRecording: false, isTranscribing: false, recordTip: '' })
      wx.showToast({ title: '录音失败，请重试', icon: 'none' })
    })

    const welcomeMsg = this.createMessage(
      'coach',
      '你好！我是你的 AI 运动教练。\n\n按住左侧麦克风说话，松开后会先转成文字显示在输入框，你可以修改后再点「发送」——不会直接把语音发给 AI。',
      { isWelcome: true }
    )
    this.setData({
      messages: [welcomeMsg],
      scrollIntoView: `msg-${welcomeMsg.id}`
    })
  },

  formatTime(date = new Date()) {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  },

  createMessage(sender, text, extra = {}) {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      sender,
      text,
      time: this.formatTime(),
      ...extra
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  removeTypingMessage(messages) {
    return messages.filter((item) => item.id !== 'typing')
  },

  appendCoachReply(replyText) {
    const coachMsg = this.createMessage('coach', replyText)
    const messages = this.removeTypingMessage(this.data.messages).concat(coachMsg)
    this.setData({
      messages,
      typing: false,
      scrollIntoView: `msg-${coachMsg.id}`
    })
  },

  buildHistoryPayload(excludeLatestUser = false) {
    let items = this.data.messages
      .filter((m) => (m.sender === 'user' || m.sender === 'coach') && !m.isWelcome)
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    if (excludeLatestUser && items.length) {
      const last = items[items.length - 1]
      if (last.role === 'user') {
        items = items.slice(0, -1)
      }
    }
    return items
  },

  showTyping(text = '教练正在思考...') {
    const typingMsg = {
      id: 'typing',
      type: 'system',
      text
    }
    this.setData({
      messages: this.data.messages.concat(typingMsg),
      typing: true,
      scrollIntoView: 'msg-typing'
    })
  },

  fetchCoachReply(userText) {
    agentChat(userText, this.buildHistoryPayload(true))
      .then((data) => {
        const reply = data && data.reply != null ? String(data.reply).trim() : ''
        if (!reply) {
          this.appendCoachReply('抱歉，教练暂时没有生成有效回复，请换种方式提问再试。')
          return
        }
        this.appendCoachReply(reply)
      })
      .catch((err) => {
        console.error('教练接口请求失败', err)
        let msg = (err && err.message) || '网络连接失败，请稍后重试。'
        if (/504003|timed out|timeout|FUNCTIONS_TIME_LIMIT_EXCEEDED/i.test(msg)) {
          msg = 'AI 回复超时：请在云开发控制台将 agent 云函数超时改为 60 秒后重新部署'
        }
        this.appendCoachReply(`暂时无法回答：${msg}`)
        wx.showToast({ title: '回复失败', icon: 'none' })
      })
  },

  sendMessage() {
    const text = this.data.inputValue.trim()
    if (!text || this.data.typing || this.data.isTranscribing) return

    const userMsg = this.createMessage('user', text)
    this.setData({
      messages: this.data.messages.concat(userMsg),
      inputValue: ''
    })
    this.showTyping()
    this.fetchCoachReply(text)
  },

  handleRecordStop(res) {
    if (!res || !res.tempFilePath) return

    const durationMs =
      res.duration || (this._recordStartAt ? Date.now() - this._recordStartAt : 0)

    if (durationMs < MIN_RECORD_MS) {
      wx.showToast({ title: '录音太短，请按住多说一会', icon: 'none' })
      return
    }

    if (durationMs > MAX_RECORD_MS + 500) {
      wx.showToast({ title: '录音超过30秒，请分段录制', icon: 'none' })
      return
    }

    this.transcribeVoiceToText(res.tempFilePath)
  },

  startVoiceRecord() {
    if (this.data.typing || this.data.isRecording || this.data.isTranscribing) return

    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.recorderManager.start({
          duration: MAX_RECORD_MS,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 96000,
          format: 'mp3'
        })
      },
      fail: () => {
        wx.showModal({
          title: '需要麦克风权限',
          content: '请在设置中开启录音权限后重试',
          showCancel: false
        })
      }
    })
  },

  stopVoiceRecord() {
    if (!this.data.isRecording) return
    this.recorderManager.stop()
  },

  transcribeVoiceToText(filePath) {
    this.setData({ isTranscribing: true })

    speechToText(filePath)
      .then((data) => {
        this.setData({ isTranscribing: false, inputValue: data.text.trim() })
        wx.showToast({
          title: '已转文字，可修改后发送',
          icon: 'none',
          duration: 2500
        })
      })
      .catch((err) => {
        console.error('语音转写失败', err)
        this.setData({ isTranscribing: false })
        wx.showModal({
          title: '语音识别失败',
          content: (err.message || '识别失败') + '\n\n你可以改用文字输入提问。',
          showCancel: false
        })
      })
  }
})
