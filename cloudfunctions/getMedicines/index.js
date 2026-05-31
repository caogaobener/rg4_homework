// cloudfunctions/getMedicines/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const today = new Date().toISOString().split('T')[0]
  
  try {
    const res = await db.collection('medicines').where({
      userId: OPENID
    }).get()
    
    const medicines = res.data.map(item => ({
      ...item,
      isCheckedInToday: item.lastCheckIn === today
    }))
    
    console.log('返回药品:', medicines);  // 调试日志
    return { data: medicines }
  } catch (err) {
    console.error('获取失败:', err)
    return { data: [], error: err.message }
  }
}