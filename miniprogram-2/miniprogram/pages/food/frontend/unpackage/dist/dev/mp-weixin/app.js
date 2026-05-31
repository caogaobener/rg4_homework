"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
if (!Math) {
  "./pages/food/index.js";
  "./pages/food/photo.js";
  "./pages/food/voice.js";
  "./pages/food/calendar.js";
  "./pages/food/chat.js";
}
const _sfc_main = {
  onLaunch: function() {
    if (common_vendor.wx$1.cloud) {
      common_vendor.wx$1.cloud.init({
        env: "cloudbase-d0g00yb41902d0169",
        // 比如 qingyang-prod-12345
        traceUser: true
      });
      common_vendor.index.__f__("log", "at App.vue:9", "🚀 微信云开发公网数据库通电成功！");
    }
    common_vendor.index.__f__("log", "at App.vue:11", "App Launch");
  },
  onShow: function() {
    common_vendor.index.__f__("log", "at App.vue:14", "App Show");
  },
  onHide: function() {
    common_vendor.index.__f__("log", "at App.vue:17", "App Hide");
  }
};
function createApp() {
  const app = common_vendor.createSSRApp(_sfc_main);
  return {
    app
  };
}
createApp().app.mount("#app");
exports.createApp = createApp;
//# sourceMappingURL=../.sourcemap/mp-weixin/app.js.map
