// cloudfunctions/testSendMsg/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const tmplId = 'xX0swj1M2KppmVRTjJ5M6Eu_OdPsDf9lpgX931X7zb4'
  
  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId: tmplId,
      page: 'pages/medicine/medicine',
      data: {
        thing1: { value: '阿司匹林' },
        time2: { value: '08:00' },
        thing3: { value: '请按时服药' }
      }
    })
    
    return { success: true, result }
  } catch (err) {
    return { success: false, error: err.message, errCode: err.errCode }
  }
}