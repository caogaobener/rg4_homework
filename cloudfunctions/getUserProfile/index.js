// cloudfunctions/getUserProfile/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { openid } = event
  const db = cloud.database()

  try {
    const res = await db.collection('users').doc(openid).get()
    return { data: res.data }
  } catch (e) {
    // 文档不存在
    return { data: null }
  }
}