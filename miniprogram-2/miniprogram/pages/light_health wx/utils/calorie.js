/**
 * 调用 AI 估算运动消耗热量（云/本地自动切换）
 */
const { estimateCalorieRemote } = require('./api')

function estimateCalorie(exerciseType, duration, weight = 60, customExerciseType = '') {
  const durationNum = parseInt(duration, 10)
  if (!exerciseType || !durationNum || durationNum <= 0) {
    return Promise.reject(new Error('缺少运动类型或时长'))
  }

  const payload = {
    exercise_type: exerciseType,
    duration: durationNum,
    weight: weight || 60
  }

  const custom = (customExerciseType || '').trim()
  if (exerciseType === '其他') {
    if (!custom) return Promise.reject(new Error('请填写自定义运动类型'))
    payload.custom_exercise_type = custom
  }

  return estimateCalorieRemote(payload).then((data) => ({
    calorie: data.calorie,
    source: data.source || 'ai',
    met: data.met
  }))
}

module.exports = { estimateCalorie }
