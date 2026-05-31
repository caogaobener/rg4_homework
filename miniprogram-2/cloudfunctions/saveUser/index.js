// cloudfunctions/saveUser/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { userInfo } = event
  const db = cloud.database()

  try {
    // 先尝试创建集合（如果不存在）
    await db.createCollection('users')
  } catch (e) {
    // 已存在则忽略
  }

  try {
    // 添加或更新用户数据
    await db.collection('users').doc(userInfo.openid).set({
      data: {
        ...userInfo,
        updateTime: db.serverDate()
      }
    })
  } catch (e) {
    return { error: e.message }
  }

  return { success: true }
}