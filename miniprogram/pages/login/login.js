Page({
  data: {
    agreeChecked: false
  },

  // 切换协议勾选
  toggleAgree() {
    this.setData({
      agreeChecked: !this.data.agreeChecked
    })
  },

  // 一键登录
  wxLogin() {
    // 没勾选就提示
    if (!this.data.agreeChecked) {
      wx.showToast({
        title: '请同意用户协议',
        icon: 'none'
      })
      return
    }

    // 直接跳转！不请求后端，不加载！
    wx.showToast({
      title: '登录成功',
      icon: 'success'
    })

    // 跳转到个人档案页
    setTimeout(() => {
      wx.navigateTo({
        url: '/pages/profile/profile'
      })
    }, 1000)
  }
})