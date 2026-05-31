// cloudfunctions/sendReminder/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const tmplId = 'xX0swj1M2KppmVRTjJ5M6Eu_OdPsDf9lpgX931X7zb4'
  
  try {
    const usersRes = await db.collection('users').where({
      isSubscribed: true
    }).get()
    
    const users = usersRes.data
    
    for (const user of users) {
      const medicinesRes = await db.collection('medicines').where({
        userId: user.openid
      }).get()
      
      const medicines = medicinesRes.data
      if (medicines.length === 0) continue
      
      const medicineNames = medicines.map(m => m.name).join('、')
      
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: user.openid,
          templateId: tmplId,
          page: 'pages/medicine/medicine',
          data: {
            thing1: { value: medicineNames },
            time2: { value: new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
            thing3: { value: '请按时服药，保持健康' }
          }
        })
        console.log(`发送成功: ${user.openid}`)
      } catch (err) {
        console.error(`发送失败: ${user.openid}`, err)
      }
    }
    
    return { success: true, sentCount: users.length }
    
  } catch (err) {
    return { success: false, error: err.message }
  }
}