"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      previewImage: "",
      isAnalyzing: false,
      analysisResult: null,
      currentMealType: "午餐",
      // 这个作为备用默认值
      mealTypes: ["早餐", "午餐", "晚餐", "加餐"]
    };
  },
  methods: {
    // 1. 微信原生选择图片
    chooseImage() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        // 压缩图，极大提升上传速度
        sourceType: ["album", "camera"],
        success: (res) => {
          this.previewImage = res.tempFilePaths[0];
          this.analysisResult = null;
          this.uploadAndAnalyze();
        }
      });
    },
    // 2. 呼叫后端 Express 做 AI 中转识别
    uploadAndAnalyze() {
      if (!this.previewImage)
        return;
      this.isAnalyzing = true;
      common_vendor.index.showLoading({ title: "AI 营养师正在全能解析..." });
      common_vendor.index.uploadFile({
        url: "http://127.0.0.1:3000/api/food/upload",
        // 指向你的后端端口
        filePath: this.previewImage,
        name: "file",
        // 对应后端 multer 的 upload.single('file')
        success: (uploadRes) => {
          const res = JSON.parse(uploadRes.data);
          if (res.code === 0 || res.success || res.foodName) {
            this.analysisResult = res.data ? res.data : res;
            common_vendor.index.showToast({ title: "AI 解析成功", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.message || "识别失败", icon: "none" });
          }
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/food/photo.vue:133", "连结后端失败:", err);
          common_vendor.index.showToast({ title: "无法接通后端AI中枢", icon: "none" });
        },
        complete: () => {
          this.isAnalyzing = false;
          common_vendor.index.hideLoading();
        }
      });
    },
    // 3. 👑【完全关联通关版】点击“早餐/午餐/晚餐/加餐”按钮时触发
    async saveRecord(meal) {
      if (!this.analysisResult)
        return;
      if (!common_vendor.wx$1.cloud) {
        common_vendor.index.showToast({ title: "微信云尚未通电", icon: "none" });
        return;
      }
      if (meal) {
        this.currentMealType = meal;
      }
      const db = common_vendor.wx$1.cloud.database();
      const now = /* @__PURE__ */ new Date();
      const todayStr = now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
      const timeStr = now.toTimeString().substring(0, 5);
      try {
        common_vendor.index.showLoading({ title: "同步保存到腾讯云..." });
        await db.collection("food_records").add({
          data: {
            food_name: this.analysisResult.foodName || "未命名食物",
            calories: Number(this.analysisResult.calories || 0),
            protein: Number(this.analysisResult.protein || 0),
            carbs: Number(this.analysisResult.carbs || 0),
            fat: Number(this.analysisResult.fat || 0),
            meal_type: this.currentMealType,
            // 🟢 此时这个值已经动态变成你点击的餐次了！
            meal_date_string: todayStr,
            // 按天筛选根基
            meal_time_string: timeStr,
            // 界面显示的时间
            meal_time: now
            // 排序权重底稿
          }
        });
        common_vendor.index.showToast({ title: "已记入膳食日志！", icon: "success" });
        setTimeout(() => {
          common_vendor.index.switchTab({
            url: "/pages/index/index",
            // ⚠️ 请核对你的首页在 pages.json 里的真实路径
            success: () => {
              const pages = getCurrentPages();
              const indexPage = pages.find((p) => p.route === "pages/index/index" || p.__route__ === "pages/index/index");
              if (indexPage && typeof indexPage.getTodayData === "function") {
                indexPage.getTodayData();
              } else if (indexPage && typeof indexPage.onShow === "function") {
                indexPage.onShow();
              }
              common_vendor.index.__f__("log", "at pages/food/photo.vue:203", "🚀 数据落库成功，已跨页面强制通知首页刷新膳食！");
            }
          });
        }, 1200);
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/food/photo.vue:209", "云落库失败:", err);
        common_vendor.index.showToast({ title: "落库失败: " + err.message, icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.previewImage
  }, !$data.previewImage ? {
    b: common_vendor.o((...args) => $options.chooseImage && $options.chooseImage(...args))
  } : {
    c: $data.previewImage,
    d: common_vendor.o((...args) => $options.chooseImage && $options.chooseImage(...args))
  }, {
    e: $data.isAnalyzing
  }, $data.isAnalyzing ? {} : {}, {
    f: $data.analysisResult && !$data.isAnalyzing
  }, $data.analysisResult && !$data.isAnalyzing ? {
    g: common_vendor.t($data.analysisResult.foodName),
    h: common_vendor.t($data.analysisResult.calories),
    i: common_vendor.t($data.analysisResult.protein),
    j: common_vendor.t($data.analysisResult.carbs),
    k: common_vendor.t($data.analysisResult.fat),
    l: common_vendor.t($data.analysisResult.advice),
    m: common_vendor.f(["早餐", "午餐", "加餐", "晚餐"], (meal, k0, i0) => {
      return {
        a: common_vendor.t(meal),
        b: meal,
        c: common_vendor.o(($event) => $options.saveRecord(meal), meal)
      };
    })
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-49c7320f"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/food/photo.js.map
