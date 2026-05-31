<template>
  <view class="container">
    <!-- 图片上传区域 -->
    <view class="upload-area">
      <view v-if="!previewImage" class="upload-placeholder" @click="chooseImage">
        <text class="upload-icon">📷</text>
        <text class="upload-text">点击拍照或选取美食照</text>
        <text class="upload-desc">支持常见的中餐、日料、西餐及混合轻食</text>
      </view>
      
      <view v-else class="image-preview">
        <image :src="previewImage" class="food-image" mode="aspectFill"></image>
        <view class="image-overlay">
          <button class="change-btn" @click="chooseImage">更换图片</button>
        </view>
      </view>
    </view>

    <!-- 分析中状态 -->
    <view v-if="isAnalyzing" class="analyzing-box">
      <text class="loading-icon">🔄</text>
      <view class="analyzing-text">
        <text class="title">轻养AI营养师分析中...</text>
        <text class="desc">正在解析食物分子结构并配比热量数据库</text>
      </view>
    </view>

    <!-- 识别结果 -->
    <view v-if="analysisResult && !isAnalyzing" class="result-card">
      <view class="result-header">
        <view class="result-left">
          <text class="success-tag">AI 识别成功</text>
          <text class="food-name">{{ analysisResult.foodName }}</text>
        </view>
        <view class="result-right">
          <text class="calories-label">预估热量</text>
          <text class="calories-value">{{ analysisResult.calories }} kcal</text>
        </view>
      </view>
      
      <!-- 营养数据 -->
      <view class="nutrition-grid">
        <view class="nutrition-item">
          <text class="nutrition-name">蛋白质</text>
          <text class="nutrition-value">{{ analysisResult.protein }}g</text>
        </view>
        <view class="nutrition-item">
          <text class="nutrition-name">碳水</text>
          <text class="nutrition-value">{{ analysisResult.carbs }}g</text>
        </view>
        <view class="nutrition-item">
          <text class="nutrition-name">脂肪</text>
          <text class="nutrition-value">{{ analysisResult.fat }}g</text>
        </view>
      </view>
      
      <!-- 营养师贴士 -->
      <view class="advice-box">
        <text class="advice-title">💡 营养师贴士：</text>
        <text class="advice-text">{{ analysisResult.advice }}</text>
      </view>
      
      <!-- 保存按钮 -->
      <view class="save-section">
        <text class="save-title">选择要存入的餐次类型：</text>
        <view class="meal-buttons">
          <button 
            v-for="meal in ['早餐', '午餐', '加餐', '晚餐']" 
            :key="meal"
            class="meal-btn"
            @click="saveRecord(meal)"
          >
            {{ meal }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      previewImage: '',
      isAnalyzing: false,
      analysisResult: null,
      currentMealType: '午餐', // 这个作为备用默认值
      mealTypes: ['早餐', '午餐', '晚餐', '加餐']
    }
  },
  methods: {
    // 1. 微信原生选择图片
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 压缩图，极大提升上传速度
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.previewImage = res.tempFilePaths[0];
          this.analysisResult = null; // 清空上一次结果
          // 选完直接触发 AI 识别
          this.uploadAndAnalyze();
        }
      });
    },

    // 2. 呼叫后端 Express 做 AI 中转识别
    uploadAndAnalyze() {
      if (!this.previewImage) return;
      
      this.isAnalyzing = true;
      uni.showLoading({ title: 'AI 营养师正在全能解析...' });

      // 使用微信最稳妥的标准上传方式
      uni.uploadFile({
        url: 'http://127.0.0.1:3000/api/food/upload', // 指向你的后端端口
        filePath: this.previewImage,
        name: 'file', // 对应后端 multer 的 upload.single('file')
        success: (uploadRes) => {
          const res = JSON.parse(uploadRes.data);
          // 适配你的 Express 拦截器兼容（有些后端成功返回的 code 为 0，有些是 200）
          if (res.code === 0 || res.success || res.foodName) {
            // 拿到 Coze/本地护盾 解析出的规范化营养数据
            // 兼容可能包在 data 里的情况
            this.analysisResult = res.data ? res.data : res;
            uni.showToast({ title: 'AI 解析成功', icon: 'success' });
          } else {
            uni.showToast({ title: res.message || '识别失败', icon: 'none' });
          }
        },
        fail: (err) => {
          console.error('连结后端失败:', err);
          uni.showToast({ title: '无法接通后端AI中枢', icon: 'none' });
        },
        complete: () => {
          this.isAnalyzing = false;
          uni.hideLoading();
        }
      });
    },

    // 3. 👑【完全关联通关版】点击“早餐/午餐/晚餐/加餐”按钮时触发
    async saveRecord(meal) { // 🟢 关键修正：接收 HTML 里传来的动态餐次字符串（如 "早餐"）
      if (!this.analysisResult) return;
      if (!wx.cloud) {
        uni.showToast({ title: '微信云尚未通电', icon: 'none' });
        return;
      }
      
      // 如果触发了点击传参，将选中的餐次同步赋值给本地变量
      if (meal) {
        this.currentMealType = meal;
      }
      
      const db = wx.cloud.database();
      const now = new Date();
      
      // 生成符合主页过滤的今日日期字符串 YYYY-MM-DD
      const todayStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');
      // 生成类似 "13:45" 的时间字符串
      const timeStr = now.toTimeString().substring(0, 5);

      try {
        uni.showLoading({ title: '同步保存到腾讯云...' });
        
        // 🚀 直连公网云数据库food_records集合，微信会自动帮你盖上 [_openid] 戳章！
        await db.collection('food_records').add({
          data: {
            food_name: this.analysisResult.foodName || '未命名食物',
            calories: Number(this.analysisResult.calories || 0),
            protein: Number(this.analysisResult.protein || 0),
            carbs: Number(this.analysisResult.carbs || 0),
            fat: Number(this.analysisResult.fat || 0),
            meal_type: this.currentMealType, // 🟢 此时这个值已经动态变成你点击的餐次了！
            meal_date_string: todayStr,     // 按天筛选根基
            meal_time_string: timeStr,      // 界面显示的时间
            meal_time: now                  // 排序权重底稿
          }
        });

        uni.showToast({ title: '已记入膳食日志！', icon: 'success' });
        
        // 4. 🏁【联动核心】落库成功后，安全强制刷新主页
        setTimeout(() => {
          // 放弃普通的返回，改用安全强制切换回首页，以便重新触发首页的拉取逻辑
          uni.switchTab({
            url: '/pages/index/index', // ⚠️ 请核对你的首页在 pages.json 里的真实路径
            success: () => {
              // 获取当前微信小程序的页面栈
              const pages = getCurrentPages();
              // 抓取首页示例
              const indexPage = pages.find(p => p.route === 'pages/index/index' || p.__route__ === 'pages/index/index');
              
              // 🟢 主动敲门：直接呼叫你首页里写好的拉取数据库刷新膳食栏目的函数！
              //（请根据你首页 index.vue 的 methods 里的查询方法名调整，比如拉取今日数据的函数叫 getTodayData 或 loadDiet）
              if (indexPage && typeof indexPage.getTodayData === 'function') {
                indexPage.getTodayData(); 
              } else if (indexPage && typeof indexPage.onShow === 'function') {
                // 如果找不到对应函数，直接让首页重新走一遍 onShow() 刷新机制
                indexPage.onShow();
              }
              console.log("🚀 数据落库成功，已跨页面强制通知首页刷新膳食！");
            }
          });
        }, 1200);

      } catch (err) {
        console.error('云落库失败:', err);
        uni.showToast({ title: '落库失败: ' + err.message, icon: 'none' });
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

.upload-area {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.upload-placeholder {
  height: 350rpx;
  border: 2rpx dashed #e2e8f0;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  transition: all 0.2s;
}

.upload-placeholder:active {
  background-color: #f1f5f9;
}

.upload-icon {
  font-size: 72rpx;
  margin-bottom: 20rpx;
}

.upload-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #475569;
  margin-bottom: 10rpx;
}

.upload-desc {
  font-size: 22rpx;
  color: #94a3b8;
}

.image-preview {
  position: relative;
  height: 350rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.food-image {
  width: 100%;
  height: 100%;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.change-btn {
  background-color: rgba(255,255,255,0.9);
  color: #334155;
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: none;
}

.analyzing-box {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.loading-icon {
  font-size: 48rpx;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.analyzing-text {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}

.analyzing-text .title {
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
}

.analyzing-text .desc {
  font-size: 22rpx;
  color: #94a3b8;
}

.result-card {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
  border: 1rpx solid #d1fae5;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.result-left {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.success-tag {
  font-size: 20rpx;
  background-color: #ecfdf5;
  color: #059669;
  padding: 6rpx 12rpx;
  border-radius: 12rpx;
  font-weight: 700;
  align-self: flex-start;
}

.food-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #1e293b;
}

.result-right {
  text-align: right;
}

.calories-label {
  font-size: 20rpx;
  color: #94a3b8;
  display: block;
  margin-bottom: 5rpx;
}

.calories-value {
  font-size: 36rpx;
  font-weight: 900;
  color: #10b981;
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.nutrition-item {
  background-color: #f8fafc;
  padding: 20rpx;
  border-radius: 16rpx;
  text-align: center;
}

.nutrition-name {
  font-size: 20rpx;
  color: #94a3b8;
  display: block;
  margin-bottom: 10rpx;
}

.nutrition-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
}

.advice-box {
  background-color: #ecfdf5;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid #d1fae5;
  margin-bottom: 30rpx;
}

.advice-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #065f46;
  margin-bottom: 10rpx;
  display: block;
}

.advice-text {
  font-size: 22rpx;
  color: #047857;
  line-height: 1.6;
}

.save-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.save-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #475569;
}

.meal-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15rpx;
}

.meal-btn {
  background-color: #10b981;
  color: #ffffff;
  padding: 16rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: none;
  transition: all 0.2s;
}

.meal-btn:active {
  transform: scale(0.95);
  background-color: #059669;
}
</style>