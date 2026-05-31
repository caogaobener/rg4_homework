Page({
  data: {
    targetCalories: 1800,          // 控卡目标，用于 WXML 显示及计算
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    remainingCalories: 1800,       // 初始值与目标一致
    proteinPercent: 0,
    carbsPercent: 0,
    fatPercent: 0,
    todayRecords: [],
    isDiagnosing: false,
    isGenerating: false,
    dietDiagnosis: null,
    customRecipe: null
  },

  onShow() {
    this.fetchTodayRecords();
  },

  async fetchTodayRecords() {
    if (!wx.cloud) return;
    const db = wx.cloud.database();
    const todayStr = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');

    try {
      wx.showLoading({ title: '加载中...' });
      const res = await db.collection('food_records')
        .where({ meal_date_string: todayStr })
        .orderBy('meal_time', 'desc')
        .get();

      const todayRecords = res.data.map(item => ({
        id: item._id,
        name: item.food_name,
        calories: Number(item.calories || 0),
        protein: Number(item.protein || 0),
        carbs: Number(item.carbs || 0),
        fat: Number(item.fat || 0),
        type: item.meal_type,
        time: item.meal_time_string || '刚刚'
      }));

      this.setData({ todayRecords });
      this.calculateTotals();
    } catch (err) {
      console.error(err);
    } finally {
      wx.hideLoading();
    }
  },

  calculateTotals() {
    const totalCalories = this.data.todayRecords.reduce((sum, item) => sum + item.calories, 0);
    const totalProtein = this.data.todayRecords.reduce((sum, item) => sum + item.protein, 0);
    const totalCarbs = this.data.todayRecords.reduce((sum, item) => sum + item.carbs, 0);
    const totalFat = this.data.todayRecords.reduce((sum, item) => sum + item.fat, 0);

    const remainingCalories = Math.max(this.data.targetCalories - totalCalories, 0);
    const proteinPercent = Math.min((totalProtein / 65) * 100, 100);
    const carbsPercent = Math.min((totalCarbs / 180) * 100, 100);
    const fatPercent = Math.min((totalFat / 55) * 100, 100);

    this.setData({
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      remainingCalories,
      proteinPercent,
      carbsPercent,
      fatPercent
    });
  },

  navToCalendar() {
    wx.navigateTo({ url: '/pages/food/calendar' });
  },

  navToChat() {
    wx.navigateTo({ url: '/pages/food/chat' });
  },

  async runDietDiagnosis() {
    this.setData({ isDiagnosing: true });
    setTimeout(() => {
      this.setData({
        isDiagnosing: false,
        dietDiagnosis: {
          score: 85,
          pros: ["营养均衡", "摄入合理"],
          cons: ["油脂偏高", "建议多吃蔬菜"],
          alternatives: "推荐增加蔬菜摄入，减少油炸食品"
        }
      });
    }, 1000);
  },

  async generateRecipe() {
    this.setData({ isGenerating: true });
    setTimeout(() => {
      this.setData({
        isGenerating: false,
        customRecipe: {
          recipeName: "清蒸鸡胸肉沙拉",
          targetCalories: 300,
          protein: 25,
          carbs: 10,
          fat: 5,
          ingredients: "鸡胸肉100g，生菜50g，黄瓜半根，橄榄油5g",
          steps: "1.鸡胸肉水煮10分钟\n2.蔬菜洗净切块\n3.混合拌匀即可食用"
        }
      });
    }, 1000);
  },

  clearRecords() {
    wx.showModal({
      title: '确认清空',
      content: '确定清空今日记录？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            todayRecords: [],
            dietDiagnosis: null,
            customRecipe: null
          });
          this.calculateTotals();
        }
      }
    });
  }
});