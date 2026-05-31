// cloudfunctions/login/index.js
exports.main = (event, context) => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID
  }
}