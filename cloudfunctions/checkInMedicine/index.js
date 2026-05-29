// cloudfunctions/checkInMedicine/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { medicineId } = event
  const { OPENID } = cloud.getWXContext()
  const today = new Date().toISOString().split('T')[0]
  
  try {
    await db.collection('medicines').doc(medicineId).update({
      data: {
        lastCheckIn: today,
        checkInCount: db.command.inc(1),
        updateTime: db.serverDate()
      }
    })
    
    // 记录打卡历史
    await db.collection('checkin_history').add({
      data: {
        medicineId,
        userId: OPENID,
        date: today,
        createTime: db.serverDate()
      }
    })
    
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}