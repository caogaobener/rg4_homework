// cloudfunctions/deleteMedicine/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { _id } = event
  return db.collection('medicines').doc(_id).remove()
}