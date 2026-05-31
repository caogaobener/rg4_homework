"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      weekDays: [],
      filters: ["全部", "早餐", "午餐", "晚餐", "加餐"],
      activeFilter: "全部",
      records: [],
      // 🟢 保持这个变量名，供 template 计算属性 filteredRecords 统一调度
      selectedDateString: ""
      // 用来精准记录当前选中的是哪一天的日期（YYYY-MM-DD）
    };
  },
  // 🟢 关键追加：每次进入日历页，或者从别的页面返回时，立刻触发数据加载
  onShow() {
    if (this.selectedDateString) {
      this.fetchRecords(this.selectedDateString);
    }
  },
  mounted() {
    this.generateWeekDays();
  },
  computed: {
    // 根据餐次过滤器（全部/早餐/午餐...）动态筛选内存中的数据
    filteredRecords() {
      if (this.activeFilter === "全部") {
        return this.records;
      }
      return this.records.filter((item) => item.type === this.activeFilter);
    }
  },
  methods: {
    // 1. 动态生成本周的日历
    generateWeekDays() {
      const days = ["日", "一", "二", "三", "四", "五", "六"];
      const today = /* @__PURE__ */ new Date();
      const currentDay = today.getDay();
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - currentDay + i);
        const dateStr = date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
        const isToday = date.toDateString() === today.toDateString();
        week.push({
          name: days[i],
          num: date.getDate(),
          dateString: dateStr,
          active: isToday
          // 默认高亮今天
        });
        if (isToday) {
          this.selectedDateString = dateStr;
        }
      }
      this.weekDays = week;
      this.fetchRecords(this.selectedDateString);
    },
    // 2. 切换日期点击事件
    selectDay(index) {
      this.weekDays.forEach((day, i) => {
        day.active = i === index;
      });
      this.selectedDateString = this.weekDays[index].dateString;
      this.fetchRecords(this.selectedDateString);
    },
    // 3. 🟢【核心修复版】跨空去微信云数据库搬运指定日期的数据
    async fetchRecords(dateStr) {
      if (!common_vendor.wx$1.cloud)
        return;
      const db = common_vendor.wx$1.cloud.database();
      try {
        common_vendor.index.showLoading({ title: "检索该日膳食账单..." });
        const res = await db.collection("food_records").where({ meal_date_string: dateStr }).orderBy("meal_time", "desc").get();
        this.records = res.data.map((item) => ({
          id: item._id,
          name: item.food_name,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          carbs: Number(item.carbs || 0),
          fat: Number(item.fat || 0),
          type: item.meal_type || "加餐",
          time: item.meal_time_string || "未知时间"
        }));
        common_vendor.index.__f__("log", "at pages/food/calendar.vue:163", `📊 成功拉取 ${dateStr} 的历史记录共 ${this.records.length} 条`);
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/food/calendar.vue:166", "云数据库历史记录拉取失败:", err);
        common_vendor.index.showToast({ title: "流水拉取失败", icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.f($data.weekDays, (day, index, i0) => {
      return {
        a: common_vendor.t(day.name),
        b: common_vendor.t(day.num),
        c: index,
        d: day.active ? 1 : "",
        e: common_vendor.o(($event) => $options.selectDay(index), index)
      };
    }),
    b: common_vendor.f($data.filters, (filter, k0, i0) => {
      return {
        a: common_vendor.t(filter),
        b: filter,
        c: $data.activeFilter === filter ? 1 : "",
        d: common_vendor.o(($event) => $data.activeFilter = filter, filter)
      };
    }),
    c: $options.filteredRecords.length === 0
  }, $options.filteredRecords.length === 0 ? {
    d: common_vendor.t($data.activeFilter)
  } : {
    e: common_vendor.f($options.filteredRecords, (record, k0, i0) => {
      return {
        a: common_vendor.t(record.type),
        b: common_vendor.t(record.name),
        c: common_vendor.t(record.time),
        d: common_vendor.t(record.calories),
        e: common_vendor.t(record.protein),
        f: common_vendor.t(record.carbs),
        g: record.id
      };
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-682a3bd8"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/food/calendar.js.map
