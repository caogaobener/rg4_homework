"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      voiceText: "",
      isProcessing: false,
      analysisResult: null
    };
  },
  methods: {
    // 1. 阶段一：仅向 Express 请求大模型纯文本解析并展示卡片
    async analyzeVoice() {
      var _a;
      if (!this.voiceText.trim())
        return;
      this.isProcessing = true;
      this.analysisResult = null;
      common_vendor.index.showLoading({ title: "AI 营养师正在全能审字..." });
      try {
        const res = await common_vendor.index.request({
          url: "http://127.0.0.1:3000/api/food/voice",
          method: "POST",
          data: { text: this.voiceText }
        });
        if (res.statusCode === 200 && res.data && (res.data.code === 0 || res.data.success)) {
          this.analysisResult = res.data.data ? res.data.data : res.data;
          common_vendor.index.showToast({ title: "AI 账单解析生成", icon: "success" });
        } else {
          throw new Error(((_a = res.data) == null ? void 0 : _a.message) || "后端中枢解构异常");
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/food/voice.vue:113", "AI解析阻塞:", err);
        common_vendor.index.showToast({ title: "解析失败: " + err.message, icon: "none" });
      } finally {
        this.isProcessing = false;
        common_vendor.index.hideLoading();
      }
    },
    // 2. 阶段二：用户点击餐次按钮执行微信腾讯云存储，并在存储成功后再安全清空复位
    async saveRecord(mealType) {
      if (!this.analysisResult)
        return;
      if (!common_vendor.wx$1.cloud) {
        common_vendor.index.showToast({ title: "微信云尚未通电", icon: "none" });
        return;
      }
      const db = common_vendor.wx$1.cloud.database();
      const now = /* @__PURE__ */ new Date();
      const todayStr = now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
      const timeStr = now.toTimeString().substring(0, 5);
      try {
        common_vendor.index.showLoading({ title: "同步到腾讯云端..." });
        await db.collection("food_records").add({
          data: {
            food_name: this.analysisResult.foodName || "智能膳食",
            calories: Number(this.analysisResult.calories || 0),
            protein: Number(this.analysisResult.protein || 0),
            carbs: Number(this.analysisResult.carbs || 0),
            fat: Number(this.analysisResult.fat || 0),
            meal_type: mealType,
            meal_date_string: todayStr,
            meal_time_string: timeStr,
            meal_time: now
          }
        });
        common_vendor.index.showToast({ title: "已记入膳食账单！", icon: "success" });
        this.voiceText = "";
        this.analysisResult = null;
        setTimeout(() => {
          common_vendor.index.switchTab({
            url: "/pages/index/index",
            success: () => {
              const pages = getCurrentPages();
              const indexPage = pages.find((p) => p.route === "pages/index/index" || p.__route__ === "pages/index/index");
              if (indexPage && typeof indexPage.fetchTodayRecords === "function") {
                indexPage.fetchTodayRecords();
              } else if (indexPage && typeof indexPage.onShow === "function") {
                indexPage.onShow();
              }
            }
          });
        }, 1200);
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/food/voice.vue:174", "落库失败:", err);
        common_vendor.index.showToast({ title: "存入失败: " + err.message, icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.voiceText,
    b: common_vendor.o(($event) => $data.voiceText = $event.detail.value),
    c: common_vendor.o(($event) => $data.voiceText = "今天早饭吃了两块全麦面包，抹了点花生酱，另外喝了一大杯无糖美式咖啡"),
    d: common_vendor.o(($event) => $data.voiceText = "下午加餐吃了一小把混合坚果，大概有二十克"),
    e: common_vendor.t($data.isProcessing ? "AI 正在全力构思..." : "AI 开始解析"),
    f: common_vendor.o((...args) => $options.analyzeVoice && $options.analyzeVoice(...args)),
    g: !$data.voiceText.trim() || $data.isProcessing,
    h: $data.analysisResult && !$data.isProcessing
  }, $data.analysisResult && !$data.isProcessing ? {
    i: common_vendor.t($data.analysisResult.foodName || $data.analysisResult.food_name),
    j: common_vendor.t($data.analysisResult.calories),
    k: common_vendor.t($data.analysisResult.protein),
    l: common_vendor.t($data.analysisResult.carbs),
    m: common_vendor.t($data.analysisResult.fat),
    n: common_vendor.o(($event) => $options.saveRecord("早餐")),
    o: common_vendor.o(($event) => $options.saveRecord("午餐")),
    p: common_vendor.o(($event) => $options.saveRecord("晚餐")),
    q: common_vendor.o(($event) => $options.saveRecord("加餐"))
  } : {}, {
    r: !$data.analysisResult
  }, !$data.analysisResult ? {} : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/food/voice.js.map
