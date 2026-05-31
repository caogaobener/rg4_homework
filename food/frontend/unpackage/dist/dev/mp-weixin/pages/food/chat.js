"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      chatMessages: [
        {
          id: 1,
          role: "assistant",
          text: '你好！我是"轻养派"的AI私人营养师。你可以上传今天吃的食物照片，或者直接告诉我你吃了什么，我来帮你分析热量与营养，提供健康的饮食建议！'
        }
      ],
      inputText: "",
      isLoading: false
    };
  },
  methods: {
    // 发送消息
    async sendMessage() {
      var _a;
      if (!this.inputText.trim() || this.isLoading)
        return;
      const userText = this.inputText.trim();
      this.chatMessages.push({ id: Date.now(), role: "user", text: userText });
      this.inputText = "";
      this.isLoading = true;
      try {
        const res = await common_vendor.index.request({
          url: "http://localhost:3000/api/agent/chat",
          method: "POST",
          header: {
            "Authorization": "Bearer " + common_vendor.index.getStorageSync("token"),
            "Content-Type": "application/json"
          },
          data: { question: userText },
          timeout: 15e3
        });
        if (res.data.code === 0 && ((_a = res.data.data) == null ? void 0 : _a.answer)) {
          this.chatMessages.push({
            id: Date.now() + 1,
            role: "assistant",
            text: res.data.data.answer
          });
        }
      } catch (err) {
        this.chatMessages.push({
          id: Date.now() + 1,
          role: "assistant",
          text: "抱歉，AI繁忙，请稍后再试~"
        });
        common_vendor.index.showToast({ title: "请求失败", icon: "none" });
      } finally {
        this.isLoading = false;
      }
    },
    // 导航到拍照识食页（移到methods里面了）
    navToPhoto() {
      common_vendor.index.navigateTo({ url: "/pages/food/photo" });
    },
    // 导航到语音记餐页（移到methods里面了）
    navToVoice() {
      common_vendor.index.navigateTo({ url: "/pages/food/voice" });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.chatMessages, (msg, index, i0) => {
      return {
        a: common_vendor.t(msg.role === "user" ? "👤" : "✨"),
        b: common_vendor.t(msg.text),
        c: msg.id,
        d: `msg-${index}`,
        e: msg.role === "user" ? 1 : ""
      };
    }),
    b: $data.isLoading
  }, $data.isLoading ? {} : {}, {
    c: `msg-${$data.chatMessages.length - 1}`,
    d: common_vendor.o((...args) => $options.navToPhoto && $options.navToPhoto(...args)),
    e: common_vendor.o((...args) => $options.navToVoice && $options.navToVoice(...args)),
    f: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args)),
    g: $data.isLoading,
    h: $data.inputText,
    i: common_vendor.o(($event) => $data.inputText = $event.detail.value),
    j: common_vendor.t($data.isLoading ? "发送中" : "发送"),
    k: common_vendor.o((...args) => $options.sendMessage && $options.sendMessage(...args)),
    l: !$data.inputText.trim()
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ceddd734"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/food/chat.js.map
