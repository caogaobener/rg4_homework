// cloudfunctions/updateMedicine/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { _id, name, dose, time, remark } = event
  return db.collection('medicines').doc(_id).update({
    data: { name, dose, time, remark }
  })
}