// pages/login/login.js
Page({
  data: {
    agree: false,
    showUserInfoInput: false,
    avatarUrl: '',
    nickName: ''
  },

  toggleAgree() {
    this.setData({
      agree: !this.data.agree
    })
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({ avatarUrl })
  },

  // 输入昵称
  onInputNickName(e) {
    this.setData({ nickName: e.detail.value })
  },

  async onLogin() {
    if (!this.data.agree) {
      wx.showToast({ title: '请先勾选同意协议', icon: 'none' })
      return
    }

    // 第一次点击：显示头像昵称输入
    if (!this.data.showUserInfoInput) {
      this.setData({ showUserInfoInput: true })
      return
    }

    // 第二次点击：确认登录
    if (!this.data.avatarUrl || !this.data.nickName) {
      wx.showToast({ title: '请填写头像和昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '登录中...' })

    try {
      // 调用云函数获取 openid
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })

      const { openid, unionid } = res.result

      if (!openid) {
        throw new Error('获取 openid 失败')
      }

      // 组装用户信息
      const userInfo = {
        openid,
        unionid: unionid || '',
        avatarUrl: this.data.avatarUrl,
        nickName: this.data.nickName,
        loginTime: new Date().getTime()
      }

      // 保存到本地
      wx.setStorageSync('openid', openid)
      wx.setStorageSync('userInfo', userInfo)

      // 保存到云数据库
      await wx.cloud.callFunction({
        name: 'saveUser',
        data: { userInfo }
      })

      wx.showToast({ title: '登录成功' })
      wx.switchTab({ url: '/pages/profile/profile' })

    } catch (err) {
      console.error('登录失败:', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})