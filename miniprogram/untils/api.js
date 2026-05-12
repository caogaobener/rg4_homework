// 后端接口基础地址
const baseUrl = "http://127.0.0.1:5000";

// 封装请求方法
function request(url, method, data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + url,
      method: method,
      data: data,
      header: {
        "token": wx.getStorageSync('token') || "",
        "Content-Type": "application/json"
      },
      success: res => {
        resolve(res.data);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

module.exports = {
  request: request
};