// app.js — 确保没有 clearStorage
App({
  onLaunch() {
    // 不要在这里清除缓存！
    // wx.clearStorageSync() ← 如果有这行，删除！
    
    wx.cloud.init({
      env: 'cloudbase-d0g00yb41902d0169',
      traceUser: true
    })
  }
})