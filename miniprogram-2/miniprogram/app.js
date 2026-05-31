// app.js 正确版
App({
  // 必须加这一行！！！
  globalData: {
    openid: null,
    userInfo: null
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-d0g00yb41902d0169',
      traceUser: true
    })
  }
})