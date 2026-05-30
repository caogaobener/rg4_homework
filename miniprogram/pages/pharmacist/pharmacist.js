// pages/pharmacist/pharmacist.js

// 智谱 API Key（学生作业用，正式项目不要写死）
const ZHIPU_API_KEY = '17b043316dad477eb4f213dbaefb8195.HS3Wy4OCNxAnShI4'

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    lastMessageId: '',
    userAvatar: '',
    quickQuestions: [
      '阿司匹林有什么副作用？',
      '感冒药可以和退烧药一起吃吗？',
      '孕妇能用什么止痛药？',
      '空腹吃药好还是饭后吃？',
      '抗生素最多能吃几天？'
    ]
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      userAvatar: userInfo.avatarUrl || '/images/default-avatar.png'
    })
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  sendQuickQuestion(e) {
    const question = e.currentTarget.dataset.question
    this.setData({ inputValue: question })
    this.sendMessage()
  },

  sendMessage() {
    const { inputValue, messages, loading } = this.data
    
    if (!inputValue.trim() || loading) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: inputValue.trim(),
      time: this.formatTime()
    }

    this.setData({
      messages: [...messages, userMsg],
      inputValue: '',
      loading: true,
      lastMessageId: `msg-${messages.length}`
    })

    // 直接调智谱 API
    this.callZhipuAPI(userMsg.content)
  },

  callZhipuAPI(question) {
    const that = this
    
    wx.request({
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ZHIPU_API_KEY
      },
      data: {
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的AI药师，具备丰富的药学知识。请提供准确的用药指导，包括用法用量、副作用、禁忌等。回答要简洁明了，适合普通用户理解。涉及处方药必须提醒"请遵医嘱"。'
          },
          { role: 'user', content: question }
        ],
        max_tokens: 800,
        temperature: 0.7
      },
      timeout: 25000,
      success: function(res) {
        console.log('智谱API返回:', res)
        
        if (res.statusCode === 200 && res.data.choices && res.data.choices[0]) {
          const reply = res.data.choices[0].message.content
          
          that.setData({
            loading: false,
            messages: [...that.data.messages, {
              id: Date.now(),
              role: 'assistant',
              content: reply,
              time: that.formatTime()
            }],
            lastMessageId: `msg-${that.data.messages.length}`
          })
        } else {
          console.error('API返回错误:', res.data)
          that.fallbackReply(question)
        }
      },
      fail: function(err) {
        console.error('请求失败:', err)
        that.fallbackReply(question)
      }
    })
  },

  fallbackReply(question) {
    const drugKnowledge = {
      '阿司匹林': '【阿司匹林】成人一次0.3-0.6g，一日3次。副作用：胃肠道反应、出血倾向。禁忌：活动性溃疡、孕妇禁用。',
      '维生素C': '【维生素C】成人一次0.1-0.2g，一日3次。副作用：长期大量服用可能引起腹泻。建议饭后服用。',
      '布洛芬': '【布洛芬】成人一次0.2-0.4g，每4-6小时一次。副作用：胃肠道不适、头痛。饭后服用可减少刺激。',
      '对乙酰氨基酚': '【对乙酰氨基酚】成人一次0.5-1g，每4-6小时一次。副作用：皮疹、药物热。肝病患者慎用。',
      '抗生素': '【抗生素】必须按医嘱完成整个疗程。副作用：胃肠道反应、过敏反应。不可随意停药，以免产生耐药性。',
      '感冒药': '【感冒药】按说明书服用。副作用：嗜睡、头晕。避免同时服用多种含相同成分的感冒药。'
    }
    
    const drug = Object.keys(drugKnowledge).find(function(name) {
      return question.indexOf(name) !== -1
    })
    
    const reply = drug ? drugKnowledge[drug] : '网络请求失败，已切换至离线模式。\n\n我可以回答以下常见药品问题：\n• 阿司匹林有什么副作用？\n• 维生素C怎么吃？\n• 布洛芬的禁忌是什么？\n• 孕妇能用什么止痛药？\n• 抗生素最多能吃几天？'
    
    this.setData({
      loading: false,
      messages: [...this.data.messages, {
        id: Date.now(),
        role: 'assistant',
        content: reply,
        time: this.formatTime()
      }]
    })
  },

  formatTime() {
    const now = new Date()
    const h = now.getHours().toString()
    const m = now.getMinutes().toString()
    return (h.length === 1 ? '0' + h : h) + ':' + (m.length === 1 ? '0' + m : m)
  }
})