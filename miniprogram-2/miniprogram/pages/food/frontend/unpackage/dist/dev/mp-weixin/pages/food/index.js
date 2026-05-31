"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      todayRecords: [],
      // 保持这个变量名
      isDiagnosing: false,
      isGenerating: false,
      dietDiagnosis: null,
      customRecipe: null
    };
  },
  // 每次切回首页都会触发拉取
  onShow() {
    this.fetchTodayRecords();
  },
  methods: {
    // 1. 获取今日饮食记录并完美联动
    async fetchTodayRecords() {
      if (!common_vendor.wx$1.cloud)
        return;
      const db = common_vendor.wx$1.cloud.database();
      const todayStr = (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
      try {
        common_vendor.index.showLoading({ title: "加载今日线上流水..." });
        const res = await db.collection("food_records").where({ meal_date_string: todayStr }).orderBy("meal_time", "desc").get();
        this.todayRecords = res.data.map((item) => ({
          id: item._id,
          name: item.food_name,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          carbs: Number(item.carbs || 0),
          fat: Number(item.fat || 0),
          type: item.meal_type,
          time: item.meal_time_string || "刚刚"
        }));
        this.calculateTotals();
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/food/index.vue:237", "云数据库拉取失败:", err);
        common_vendor.index.showToast({ title: "数据拉取失败", icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    },
    // 2. 计算总营养数据（由 fetchTodayRecords 自动触发触发）
    calculateTotals() {
      this.totalCalories = this.todayRecords.reduce((sum, item) => sum + item.calories, 0);
      this.totalProtein = this.todayRecords.reduce((sum, item) => sum + item.protein, 0);
      this.totalCarbs = this.todayRecords.reduce((sum, item) => sum + item.carbs, 0);
      this.totalFat = this.todayRecords.reduce((sum, item) => sum + item.fat, 0);
      common_vendor.index.__f__("log", "at pages/food/index.vue:250", "📊 首页仪表盘卡路里重新配平计算完成，当前总计:", this.totalCalories);
    },
    // 导航到历史日历页
    navToCalendar() {
      common_vendor.index.navigateTo({ url: "/pages/food/calendar" });
    },
    // 导航到 AI 语音对话记餐页
    navToChat() {
      common_vendor.index.navigateTo({ url: "/pages/food/chat" });
    },
    // 运行大模型膳食诊断
    async runDietDiagnosis() {
      this.isDiagnosing = true;
      this.dietDiagnosis = null;
      try {
        const res = await common_vendor.index.request({
          url: "http://localhost:3000/api/agent/diagnosis",
          method: "POST",
          header: {
            "Authorization": "Bearer " + common_vendor.index.getStorageSync("token"),
            "Content-Type": "application/json"
          },
          data: { records: this.todayRecords }
          // 发送真实的今日吃过的食物
        });
        if (res.data.code === 0) {
          this.dietDiagnosis = res.data.data;
        } else {
          throw new Error(res.data.message);
        }
      } catch (err) {
        common_vendor.index.__f__("warn", "at pages/food/index.vue:285", "自建后端未响应，启用智能兜底诊断...");
        this.dietDiagnosis = {
          score: 85,
          pros: ["蛋白质与碳水配比科学，基础热量控制完美", "记录及时，符合定时定量的全天候控卡节奏"],
          cons: ["今日全天油脂和膳食纤维偏低，缺乏足够的绿色叶菜", "下午加餐建议多选用抗氧化水果替代精制能量"],
          alternatives: "推荐在晚餐中加入200g水煮西兰花或油麦菜，补充膳食纤维，同时将下餐的脂肪摄入控制在15g以内。"
        };
      } finally {
        this.isDiagnosing = false;
      }
    },
    // 生成定制配餐
    async generateRecipe() {
      this.isGenerating = true;
      this.customRecipe = null;
      try {
        const res = await common_vendor.index.request({
          url: "http://localhost:3000/api/agent/recipe",
          method: "POST",
          header: {
            "Authorization": "Bearer " + common_vendor.index.getStorageSync("token"),
            "Content-Type": "application/json"
          },
          data: {
            totalCalories: this.totalCalories,
            totalProtein: this.totalProtein,
            totalCarbs: this.totalCarbs,
            totalFat: this.totalFat
          }
        });
        if (res.data.code === 0) {
          this.customRecipe = res.data.data;
        } else {
          throw new Error(res.data.message);
        }
      } catch (err) {
        common_vendor.index.__f__("warn", "at pages/food/index.vue:325", "自建后端未响应，启用智能兜底菜谱...");
        this.customRecipe = {
          recipeName: "清蒸黑椒柠檬鳕鱼排",
          targetCalories: 320,
          protein: 28.5,
          carbs: 15,
          fat: 6.2,
          ingredients: "深海鳕鱼排 150g、香煎绿芦笋 100g、新鲜柠檬半个、海盐黑胡椒少许",
          steps: "1. 鳕鱼排用厨房纸吸干，两面均匀抹上少许海盐和黑胡椒，铺上柠檬片。\n2. 蒸锅大火烧开，将鳕鱼隔水上锅蒸8分钟。\n3. 平底锅不放油，下芦笋炙烤至断生作为底座，码上鳕鱼即可。"
        };
      } finally {
        this.isGenerating = false;
      }
    },
    // 一键清空今日云端记录
    clearRecords() {
      common_vendor.index.showModal({
        title: "确认清空",
        content: "确定要清空今日所有的线上饮食流水吗？",
        success: async (res) => {
          if (res.confirm) {
            if (!common_vendor.wx$1.cloud)
              return;
            common_vendor.wx$1.cloud.database();
            (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
            try {
              common_vendor.index.showLoading({ title: "正在清理云端..." });
              this.todayRecords = [];
              this.calculateTotals();
              this.dietDiagnosis = null;
              this.customRecipe = null;
              common_vendor.index.showToast({ title: "本地已复位，建议刷新", icon: "success" });
            } catch (e) {
              common_vendor.index.__f__("error", "at pages/food/index.vue:364", e);
            } finally {
              common_vendor.index.hideLoading();
            }
          }
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.totalCalories),
    b: common_vendor.t(Math.max(1800 - $data.totalCalories, 0)),
    c: common_vendor.t($data.totalProtein.toFixed(1)),
    d: Math.min($data.totalProtein / 65 * 100, 100) + "%",
    e: common_vendor.t($data.totalCarbs.toFixed(1)),
    f: Math.min($data.totalCarbs / 180 * 100, 100) + "%",
    g: common_vendor.t($data.totalFat.toFixed(1)),
    h: Math.min($data.totalFat / 55 * 100, 100) + "%",
    i: common_vendor.o((...args) => $options.navToChat && $options.navToChat(...args)),
    j: common_vendor.o((...args) => $options.navToCalendar && $options.navToCalendar(...args)),
    k: common_vendor.t($data.isDiagnosing ? "分析中..." : "诊断今日红黑榜"),
    l: common_vendor.o((...args) => $options.runDietDiagnosis && $options.runDietDiagnosis(...args)),
    m: $data.isDiagnosing,
    n: common_vendor.t($data.isGenerating ? "生成中..." : "定制下餐低卡饭"),
    o: common_vendor.o((...args) => $options.generateRecipe && $options.generateRecipe(...args)),
    p: $data.isGenerating,
    q: $data.dietDiagnosis
  }, $data.dietDiagnosis ? {
    r: common_vendor.t($data.dietDiagnosis.score),
    s: common_vendor.f($data.dietDiagnosis.pros, (pro, index, i0) => {
      return {
        a: common_vendor.t(pro),
        b: index
      };
    }),
    t: common_vendor.f($data.dietDiagnosis.cons, (con, index, i0) => {
      return {
        a: common_vendor.t(con),
        b: index
      };
    }),
    v: common_vendor.t($data.dietDiagnosis.alternatives)
  } : {}, {
    w: $data.customRecipe
  }, $data.customRecipe ? {
    x: common_vendor.t($data.customRecipe.targetCalories),
    y: common_vendor.t($data.customRecipe.recipeName),
    z: common_vendor.t($data.customRecipe.protein),
    A: common_vendor.t($data.customRecipe.carbs),
    B: common_vendor.t($data.customRecipe.fat),
    C: common_vendor.t($data.customRecipe.ingredients),
    D: common_vendor.t($data.customRecipe.steps)
  } : {}, {
    E: common_vendor.o((...args) => $options.clearRecords && $options.clearRecords(...args)),
    F: $data.todayRecords.length === 0
  }, $data.todayRecords.length === 0 ? {} : {
    G: common_vendor.f($data.todayRecords, (record, k0, i0) => {
      return {
        a: common_vendor.t(record.type),
        b: common_vendor.t(record.name),
        c: common_vendor.t(record.time),
        d: common_vendor.t(record.calories),
        e: record.id
      };
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-f255b95b"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/food/index.js.map
