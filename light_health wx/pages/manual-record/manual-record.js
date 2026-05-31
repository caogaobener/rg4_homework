const { estimateCalorie } = require('../../utils/calorie')
const { USER_ID, postRecord } = require('../../utils/api')

const OTHER_INDEX = 6

Page({
  data: {
    typeList: ['跑步', '散步', '游泳', '瑜伽', '健身', '骑行', '其他'],
    typeIndex: 0,
    customType: '',
    isOtherType: false,
    duration: '',
    calorie: '',
    calorieSource: '',
    estimatingCalorie: false
  },

  bindPickerChange(e) {
    const typeIndex = parseInt(e.detail.value, 10)
    this.setData({
      typeIndex,
      isOtherType: typeIndex === OTHER_INDEX
    })
  },

  bindInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onCustomTypeBlur() {
    if (!this.data.isOtherType) return
    const name = (this.data.customType || '').trim()
    if (!name || !this.data.duration) return
    this.onEstimateCalorie(true)
  },

  onDurationBlur() {
    if (this.data.duration && this.getExerciseTypeName()) {
      this.onEstimateCalorie(true)
    }
  },

  getExerciseTypeName() {
    const { typeList, typeIndex, customType, isOtherType } = this.data
    if (isOtherType) {
      return (customType || '').trim()
    }
    return typeList[typeIndex]
  },

  onEstimateCalorie(silent) {
    const quiet = silent === true
    const exercise_type = this.data.typeList[this.data.typeIndex]
    const custom_exercise_type = this.data.isOtherType
      ? (this.data.customType || '').trim()
      : ''
    const resolvedName = this.getExerciseTypeName()
    const duration = this.data.duration

    if (this.data.isOtherType && !custom_exercise_type) {
      wx.showToast({ title: '请先填写自定义运动类型', icon: 'none' })
      return
    }

    if (!duration || parseInt(duration, 10) <= 0) {
      wx.showToast({ title: '请先填写运动时长', icon: 'none' })
      return
    }

    this.setData({ estimatingCalorie: true })

    estimateCalorie(exercise_type, duration, 60, custom_exercise_type)
      .then(({ calorie, source }) => {
        this.setData({
          calorie: String(calorie),
          calorieSource: source,
          estimatingCalorie: false
        })
        if (!quiet) {
          wx.showToast({
            title: source === 'ai' ? `已估算：${resolvedName}` : '公式估算完成',
            icon: 'none'
          })
        }
      })
      .catch(() => {
        const fallback = this.localEstimateCalorie(resolvedName, duration)
        this.setData({
          calorie: String(fallback),
          calorieSource: 'formula',
          estimatingCalorie: false
        })
        if (!quiet) {
          wx.showToast({ title: '已使用本地公式估算', icon: 'none' })
        }
      })
  },

  localEstimateCalorie(exerciseType, duration) {
    const metMap = {
      跑步: 9.8,
      散步: 3.5,
      游泳: 8,
      瑜伽: 3,
      健身: 6,
      骑行: 7.5,
      其他: 5
    }
    let met = metMap[exerciseType]
    if (met == null) {
      for (const key of Object.keys(metMap)) {
        if (key !== '其他' && exerciseType.includes(key)) {
          met = metMap[key]
          break
        }
      }
    }
    met = met || 5
    return Math.round(met * 60 * (parseInt(duration, 10) / 60) * 10) / 10
  },

  submitRecord() {
    const resolvedName = this.getExerciseTypeName()
    const { duration, calorie, estimatingCalorie, isOtherType } = this.data

    if (isOtherType && !resolvedName) {
      wx.showToast({ title: '请填写自定义运动类型', icon: 'none' })
      return
    }

    if (!duration) {
      wx.showToast({ title: '请填写运动时长', icon: 'none' })
      return
    }

    if (estimatingCalorie) {
      wx.showToast({ title: '正在估算热量', icon: 'none' })
      return
    }

    const doSave = (finalCalorie) => {
      if (!finalCalorie) {
        wx.showToast({ title: '请先估算或填写热量', icon: 'none' })
        return
      }

      wx.showLoading({ title: '保存中...' })
      postRecord({
        user_id: USER_ID,
        exercise_type: resolvedName,
        duration: parseInt(duration, 10),
        calorie: parseFloat(finalCalorie),
        record_time: new Date().toISOString()
      })
        .then(() => {
          wx.hideLoading()
          wx.showToast({ title: '保存成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 800)
        })
        .catch((err) => {
          wx.hideLoading()
          wx.showToast({
            title: err.message || '保存失败',
            icon: 'none',
            duration: 3000
          })
        })
    }

    if (!calorie) {
      const exercise_type = this.data.typeList[this.data.typeIndex]
      const custom = isOtherType ? resolvedName : ''
      estimateCalorie(exercise_type, duration, 60, custom)
        .then(({ calorie: c }) => doSave(c))
        .catch(() => doSave(this.localEstimateCalorie(resolvedName, duration)))
      return
    }

    doSave(calorie)
  }
})
