const BASE_URL = 'http://127.0.0.1:3000'; // 你本地 Express 的启动地址

export const request = (options) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...options.header
      },
      success: (res) => {
        // 对应后端返回的 { code: 0, message: 'success', data: {...} }
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          uni.showToast({ title: res.data.message || '服务响应错误', icon: 'none' });
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '无法连接到后端服务器', icon: 'none' });
        reject(err);
      }
    });
  });
};