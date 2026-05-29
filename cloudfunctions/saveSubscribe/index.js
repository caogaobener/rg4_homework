// cloudfunctions/saveSubscribe/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { isSubscribed } = event
  const db = cloud.database()
  
  try {
    await db.collection('users').doc(OPENID).update({
      data: {
        isSubscribed,
        updateTime: db.serverDate()
      }
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}