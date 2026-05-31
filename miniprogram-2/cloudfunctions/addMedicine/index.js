const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { name, dose, time, remark } = event

  return db.collection('medicines').add({
    data: {
      userId: OPENID,
      name, dose, time, remark,
      createTime: new Date()
    }
  })
}