Page({
  data: {
    height: '',
    weight: '',
    age: '',
    gender: '女',
    bmiResult: ''
  },

  onHeightInput(e) {
    this.setData({ height: e.detail.value })
    this.calculateBMI()
  },
  onWeightInput(e) {
    this.setData({ weight: e.detail.value })
    this.calculateBMI()
  },
  onAgeInput(e) {
    this.setData({ age: e.detail.value })
  },
  onGenderChange(e) {
    this.setData({ gender: e.detail.value })
  },

  calculateBMI() {
    const h = parseFloat(this.data.height)
    const w = parseFloat(this.data.weight)
    if (!h || !w || h <= 0 || w <= 0) {
      this.setData({ bmiResult: '' })
      return
    }
    const bmi = w / ((h / 100) ** 2)
    this.setData({
      bmiResult: bmi.toFixed(1)
    })
  }
})
