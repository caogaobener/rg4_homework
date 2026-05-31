<template>
  <view class="container">
    <!-- 周日历 -->
    <view class="week-calendar">
      <view 
        v-for="(day, index) in weekDays" 
        :key="index"
        class="day-item"
        :class="{ active: day.active }"
        @click="selectDay(index)"
      >
        <text class="day-name">{{ day.name }}</text>
        <text class="day-num">{{ day.num }}</text>
      </view>
    </view>
    
    <!-- 餐次过滤器 -->
    <view class="filter-bar">
      <scroll-view scroll-x="true" class="filter-scroll">
        <text 
          v-for="filter in filters" 
          :key="filter"
          class="filter-item"
          :class="{ active: activeFilter === filter }"
          @click="activeFilter = filter"
        >
          {{ filter }}
        </text>
      </scroll-view>
    </view>
    
    <!-- 记录列表 -->
    <view class="records-section">
      <view v-if="filteredRecords.length === 0" class="empty-state">
        <text>暂无【{{ activeFilter }}】餐品记录</text>
        <text class="empty-desc">点击底部"智能饮食"开始记录</text>
      </view>
      
      <view v-else class="records-list">
        <view v-for="record in filteredRecords" :key="record.id" class="record-item">
          <view class="record-left">
            <text class="meal-tag">{{ record.type }}</text>
            <view class="record-info">
              <text class="food-name">{{ record.name }}</text>
              <text class="record-time">{{ record.time }}</text>
            </view>
          </view>
          <view class="record-right">
            <text class="record-calories">+{{ record.calories }} kcal</text>
            <text class="record-nutrition">蛋:{{ record.protein }}g 碳:{{ record.carbs }}g</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      weekDays: [],
      filters: ['全部', '早餐', '午餐', '晚餐', '加餐'],
      activeFilter: '全部',
      records: [], // 🟢 保持这个变量名，供 template 计算属性 filteredRecords 统一调度
      selectedDateString: '' // 用来精准记录当前选中的是哪一天的日期（YYYY-MM-DD）
    }
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
      if (this.activeFilter === '全部') {
        return this.records;
      }
      return this.records.filter(item => item.type === this.activeFilter);
    }
  },
  
  methods: {
    // 1. 动态生成本周的日历
    generateWeekDays() {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      const today = new Date();
      const currentDay = today.getDay(); // 0 是周日
      
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        // 算出本周每一天相对于今天的差值
        date.setDate(today.getDate() - currentDay + i);
        
        // 格式化为满足数据库查询的 YYYY-MM-DD
        const dateStr = date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');
        const isToday = date.toDateString() === today.toDateString();
        
        week.push({
          name: days[i],
          num: date.getDate(),
          dateString: dateStr,
          active: isToday // 默认高亮今天
        });
        
        if (isToday) {
          this.selectedDateString = dateStr;
        }
      }
      this.weekDays = week;
      
      // 初始化：生成完日历立刻去抓今天的数据
      this.fetchRecords(this.selectedDateString);
    },
    
    // 2. 切换日期点击事件
    selectDay(index) {
      this.weekDays.forEach((day, i) => {
        day.active = i === index;
      });
      // 捕获新点击的日期字符串
      this.selectedDateString = this.weekDays[index].dateString;
      
      // 🟢 触发查询：立刻去云数据库把这一天的数据扣出来
      this.fetchRecords(this.selectedDateString);
    },
    
    // 3. 🟢【核心修复版】跨空去微信云数据库搬运指定日期的数据
    async fetchRecords(dateStr) {
      if (!wx.cloud) return;
      const db = wx.cloud.database();
      
      try {
        uni.showLoading({ title: '检索该日膳食账单...' });
        
        // 精准按【日期】筛选 food_records 集合，按时间倒序
        const res = await db.collection('food_records')
          .where({ meal_date_string: dateStr })
          .orderBy('meal_time', 'desc')
          .get();
          
        // 🟢 关键修正：把处理好的规范数据精准赋值给今天 records 变量，激活前端过滤
        this.records = res.data.map(item => ({
          id: item._id,
          name: item.food_name,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          carbs: Number(item.carbs || 0),
          fat: Number(item.fat || 0),
          type: item.meal_type || '加餐',
          time: item.meal_time_string || '未知时间'
        }));
        
        console.log(`📊 成功拉取 ${dateStr} 的历史记录共 ${this.records.length} 条`);

      } catch (err) {
        console.error("云数据库历史记录拉取失败:", err);
        uni.showToast({ title: '流水拉取失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    }
  }
}
</script>
<style scoped>
.container {
  padding: 20rpx;
  background-color: #f8fafc;
  min-height: 100vh;
}

.week-calendar {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 20rpx;
  display: flex;
  justify-content: space-around;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.day-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15rpx 20rpx;
  border-radius: 16rpx;
  transition: all 0.2s;
}

.day-item.active {
  background-color: #10b981;
  color: #ffffff;
}

.day-name {
  font-size: 20rpx;
  text-transform: uppercase;
  margin-bottom: 10rpx;
}

.day-num {
  font-size: 26rpx;
  font-weight: 700;
}

.filter-bar {
  margin-bottom: 20rpx;
}

.filter-scroll {
  white-space: nowrap;
}

.filter-item {
  display: inline-block;
  padding: 12rpx 24rpx;
  margin-right: 15rpx;
  background-color: #ffffff;
  border: 1rpx solid #e2e8f0;
  border-radius: 30rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #475569;
  transition: all 0.2s;
}

.filter-item.active {
  background-color: #10b981;
  color: #ffffff;
  border-color: #10b981;
}

.records-section {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.empty-state {
  text-align: center;
  padding: 80rpx 0;
  color: #94a3b8;
}

.empty-desc {
  font-size: 22rpx;
  margin-top: 15rpx;
  display: block;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background-color: #f8fafc;
  border-radius: 16rpx;
}

.record-left {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.meal-tag {
  font-size: 20rpx;
  font-weight: 700;
  background-color: #ecfdf5;
  color: #059669;
  padding: 6rpx 12rpx;
  border-radius: 12rpx;
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}

.food-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
}

.record-time {
  font-size: 20rpx;
  color: #94a3b8;
}

.record-right {
  text-align: right;
}

.record-calories {
  font-size: 26rpx;
  font-weight: 700;
  color: #10b981;
  display: block;
  margin-bottom: 5rpx;
}

.record-nutrition {
  font-size: 20rpx;
  color: #94a3b8;
}
</style>