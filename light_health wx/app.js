const { normalizeBase, ensureWxLogin, USE_CLOUD, isCloudMode } = require('./utils/api')

const LAN_HOST = 'http://192.168.43.70'

// 云开发环境 ID：云开发控制台 → 设置 → 环境 ID
const CLOUD_ENV = 'cloudbase-d0g00yb41902d0169'

App({
  globalData: {
    baseUrl: normalizeBase(LAN_HOST),
    coachBaseUrl: normalizeBase(LAN_HOST),
    sessionKey: '',
    wxMock: false,
    openid: '',
    cloudEnv: CLOUD_ENV,
    useCloud: true
  },

  onLaunch() {
    console.log('小程序启动，模式:', USE_CLOUD ? '云开发' : '本地后端')

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      wx.showModal({
        title: '云开发不可用',
        content: '请升级微信开发者工具，或在详情中调高基础库版本',
        showCancel: false
      })
      return
    }

    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true
    })
    console.log('云开发已初始化，环境:', CLOUD_ENV)

    // 等 cloud.init 完成后再登录
    this.doCloudLogin()
  },

  doCloudLogin() {
    if (!isCloudMode()) {
      console.warn('未启用云开发模式')
      return
    }

    ensureWxLogin()
      .then((data) => {
        console.log('用户登录就绪', data.openid ? data.openid.slice(0, 8) + '...' : '')
      })
      .catch((err) => {
        const msg = (err && err.message) || String(err)
        console.warn('登录未完成', msg)
        wx.showToast({
          title: '云登录失败，请看 Console',
          icon: 'none',
          duration: 3000
        })
      })
  }
})
