// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  // 直接获取调用者的 openid（云函数自动解析）
  const { OPENID, UNIONID } = cloud.getWXContext()

  if (!OPENID) {
    return { error: '获取 openid 失败' }
  }

  // 存入数据库
  const db = cloud.database()
  try {
    await db.collection('users').doc(OPENID).set({
      data: {
        openid: OPENID,
        unionid: UNIONID || '',
        lastLogin: db.serverDate()
      }
    })
  } catch (e) {
    // 已存在则更新
    await db.collection('users').doc(OPENID).update({
      data: {
        lastLogin: db.serverDate()
      }
    })
  }

  return { 
    openid: OPENID, 
    unionid: UNIONID 
  }
}