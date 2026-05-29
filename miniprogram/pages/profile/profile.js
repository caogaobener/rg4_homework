// pages/profile/profile.js
Page({
  data: {
    userInfo: {},
    openid: "",
    height: "",
    weight: "",
    age: "",
    gender: "女",
    bmi: "",
    isLogin: false,
    saved: false
  },

  onLoad() {
    const openid = wx.getStorageSync('openid')
    const localUserInfo = wx.getStorageSync('userInfo') || {}

    if (!openid) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    this.setData({ 
      openid,
      isLogin: true,
      userInfo: localUserInfo
    })

    // 强制加载本地数据
    this.forceLoadLocal()
  },

  onShow() {
    this.forceLoadLocal()
  },

  // 强制加载本地数据（带默认值）
  forceLoadLocal() {
    try {
      const profile = wx.getStorageSync('profile')
      
      console.log('=== forceLoadLocal ===')
      console.log('原始profile:', profile)
      console.log('profile类型:', typeof profile)

      if (profile && typeof profile === 'object' && profile.height) {
        this.setData({
          height: String(profile.height),
          weight: String(profile.weight),
          age: String(profile.age || ''),
          gender: profile.gender || '女',
          bmi: String(profile.bmi || ''),
          saved: true
        })
        console.log('加载成功:', this.data)
      } else {
        console.log('无本地数据，显示空表单')
        this.setData({ saved: false })
      }
    } catch (e) {
      console.error('加载本地失败:', e)
      this.setData({ saved: false })
    }
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    const val = e.detail.value
    this.setData({ 
      [key]: val, 
      saved: false 
    }, () => {
      this.calcBMI()
    })
  },

  selectGender(e) {
    const gender = e.currentTarget.dataset.gender
    this.setData({ 
      gender, 
      saved: false 
    })
  },

  calcBMI() {
    const { height, weight } = this.data
    if (!height || !weight) {
      this.setData({ bmi: "" })
      return
    }
    const h = parseFloat(height) / 100
    const w = parseFloat(weight)
    const bmi = (w / (h * h)).toFixed(1)
    this.setData({ bmi })
  },

  saveProfile() {
    const { openid, height, weight, age, gender, bmi, userInfo } = this.data

    if (!height || !weight) {
      wx.showToast({ title: '请填写身高体重', icon: 'none' })
      return
    }

    // 强制保存到本地
    const profileData = {
      openid: openid || '',
      height: String(height),
      weight: String(weight),
      age: String(age || ''),
      gender: gender || '女',
      bmi: String(bmi || '')
    }

    try {
      wx.setStorageSync('profile', profileData)
      console.log('=== 强制保存成功 ===')
      console.log('保存的数据:', profileData)
      
      // 立即验证是否保存成功
      const check = wx.getStorageSync('profile')
      console.log('验证读取:', check)
      
      this.setData({ saved: true })
      wx.showToast({ title: '保存成功', icon: 'success' })

    } catch (e) {
      console.error('保存失败:', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }

    // 异步尝试云端（不阻塞）
    this.syncToCloud(profileData, userInfo)
  },

  // 异步同步云端
  async syncToCloud(profileData, userInfo) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'saveProfile',
        data: {
          ...profileData,
          userInfo
        }
      })
      console.log('云端同步结果:', res)
    } catch (err) {
      console.error('云端同步失败:', err)
    }
  },

  logout() {
    wx.clearStorageSync()
    wx.showToast({ title: '已退出' })
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/login/login' })
    }, 1000)
  }
})