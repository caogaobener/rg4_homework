// cloudfunctions/pharmacistAgent/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const API_KEY = '17b043316dad477eb4f213dbaefb8195.HS3Wy4OCNxAnShI4'
// 配置请求超时时间（建议8秒，小于云函数总超时）
const REQUEST_TIMEOUT = 8000;

exports.main = async (event, context) => {
  const { question } = event

  try {
    const reply = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'glm-4',
        messages: [
          { role: 'system', content: '你是一位专业的AI药师，请提供准确的用药指导。' },
          { role: 'user', content: question }
        ],
        // 可选：降低AI响应长度，减少耗时（根据需求调整）
        max_tokens: 1000,
        temperature: 0.7
      })

      const req = require('https').request({
        hostname: 'open.bigmodel.cn',
        path: '/api/paas/v4/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: REQUEST_TIMEOUT  // 设置请求超时
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            // 增加错误判断：AI接口返回异常时直接reject
            if (json.error || !json.choices?.[0]?.message?.content) {
              reject(new Error(json.error?.message || 'AI响应格式异常'))
              return
            }
            resolve(json.choices[0].message.content)
          } catch (e) {
            reject(e)
          }
        })
      })
      
      // 监听请求超时事件
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('AI请求超时，请稍后重试'))
      })
      req.on('error', reject)
      req.write(body)
      req.end()
    })

    return { reply }

  } catch (err) {
    console.error('AI调用失败:', err)
    // 区分超时错误和其他错误，返回更友好提示
    const errMsg = err.message.includes('超时') 
      ? 'AI响应超时，建议稍后重试或直接咨询专业药师' 
      : '网络异常，建议咨询专业药师'
    return { reply: errMsg }
  }
}