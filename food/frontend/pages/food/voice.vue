<template>
  <view class="container">
    <view class="voice-card">
      <view class="voice-header">
        <text class="voice-title">🎤 语音饮食转文字</text>
        <text class="voice-desc">按住下方按钮说话，或者直接输入你的饮食内容</text>
      </view>
      
      <textarea 
        v-model="voiceText"
        class="voice-input"
        placeholder="例如：今天午饭吃了一碗番茄牛肉面加一个煎蛋"
        auto-height
      />
      
      <view class="examples">
        <text class="example-btn" @click="voiceText = '今天早饭吃了两块全麦面包，抹了点花生酱，另外喝了一大杯无糖美式咖啡'">
          示例 A 🌞
        </text>
        <text class="example-btn" @click="voiceText = '下午加餐吃了一小把混合坚果，大概有二十克'">
          示例 B 🥜
        </text>
      </view>
      
      <button 
        class="analyze-btn"
        @click="analyzeVoice"
        :disabled="!voiceText.trim() || isProcessing"
      >
        {{ isProcessing ? 'AI 正在全力构思...' : 'AI 开始解析' }}
      </button>
    </view>
    
    <view v-if="analysisResult && !isProcessing" class="result-card">
      <view class="result-header">
        <view class="result-left">
          <text class="success-tag">AI 文本结构化成功</text>
			<text class="food-name">{{ analysisResult.foodName || analysisResult.food_name }}</text>
        </view>
        <view class="result-right">
          <text class="calories-label">预估热量</text>
          <text class="calories-value">{{ analysisResult.calories }} <text style="font-size: 24rpx;">kcal</text></text>
        </view>
      </view>

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

      <view class="action-section">
        <text class="action-tip">请选择记录到哪一餐：</text>
        <view class="meal-buttons">
          <button class="meal-btn breakfast" @click="saveRecord('早餐')">➕ 早餐</button>
          <button class="meal-btn lunch" @click="saveRecord('午餐')">➕ 午餐</button>
          <button class="meal-btn dinner" @click="saveRecord('晚餐')">➕ 晚餐</button>
          <button class="meal-btn snack" @click="saveRecord('加餐')">➕ 加餐</button>
        </view>
      </view>
    </view>
    
    <view class="info-card" v-if="!analysisResult">
      <text class="info-title">微信小程序录音对接说明：</text>
      <text class="info-text">
        调用微信原生录音管理器 [wx.getRecorderManager()]，在录音停止后将生成的 tempFilePath 音频文件，上传至后端利用语音转文字接口（STT）或大模型Whisper转换为文本，即可实现全自动化语音记餐。
      </text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      voiceText: '',
      isProcessing: false,
      analysisResult: null
    }
  },
  methods: {
    // 1. 阶段一：仅向 Express 请求大模型纯文本解析并展示卡片
    async analyzeVoice() {
      if (!this.voiceText.trim()) return;
      
      this.isProcessing = true;
      this.analysisResult = null;
      uni.showLoading({ title: 'AI 营养师正在全能审字...' });
      
      try {
        const res = await uni.request({
          url: 'http://127.0.0.1:3000/api/food/voice', 
          method: 'POST',
          data: { text: this.voiceText }
        });

        if (res.statusCode === 200 && res.data && (res.data.code === 0 || res.data.success)) {
          this.analysisResult = res.data.data ? res.data.data : res.data;
          uni.showToast({ title: 'AI 账单解析生成', icon: 'success' });
        } else {
          throw new Error(res.data?.message || '后端中枢解构异常');
        }
      } catch (err) {
        console.error("AI解析阻塞:", err);
        uni.showToast({ title: '解析失败: ' + err.message, icon: 'none' });
      } finally {
        this.isProcessing = false;
        uni.hideLoading();
      }
    },

    // 2. 阶段二：用户点击餐次按钮执行微信腾讯云存储，并在存储成功后再安全清空复位
    async saveRecord(mealType) {
      if (!this.analysisResult) return;
      if (!wx.cloud) {
        uni.showToast({ title: '微信云尚未通电', icon: 'none' });
        return;
      }

      const db = wx.cloud.database();
      const now = new Date();
      const todayStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/\//g, '-');
      const timeStr = now.toTimeString().substring(0, 5);

      try {
        uni.showLoading({ title: '同步到腾讯云端...' });

        // 🚀 A. 先读取完备的对象塞入微信云数据库
        await db.collection('food_records').add({
          data: {
            food_name: this.analysisResult.foodName || '智能膳食',
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

        // 🟢 B. 彻底落库成功后，再进行本地安全复位，彻底告别 Cannot read property of null
        uni.showToast({ title: '已记入膳食账单！', icon: 'success' });
        this.voiceText = '';         
        this.analysisResult = null;  

        // 3. 🏁 跨页强刷首页大盘
        setTimeout(() => {
          uni.switchTab({
            url: '/pages/index/index',
            success: () => {
              const pages = getCurrentPages();
              const indexPage = pages.find(p => p.route === 'pages/index/index' || p.__route__ === 'pages/index/index');
              if (indexPage && typeof indexPage.fetchTodayRecords === 'function') {
                indexPage.fetchTodayRecords(); 
              } else if (indexPage && typeof indexPage.onShow === 'function') {
                indexPage.onShow();
              }
            }
          });
        }, 1200);

      } catch (err) {
        console.error("落库失败:", err);
        uni.showToast({ title: '存入失败: ' + err.message, icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    }
  }
}
</script>

<style>
.container {
  padding: 30rpx;
  background-color: #f8fafc;
  min-height: 100vh;
}
.voice-card, .info-card {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}
.voice-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #334155;
  display: block;
}
.voice-desc {
  font-size: 22rpx;
  color: #94a3b8;
  display: block;
  margin-top: 5rpx;
}
.voice-input {
  width: 100%;
  min-height: 160rpx;
  background-color: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 24rpx;
  color: #334155;
  margin: 25rpx 0;
  box-sizing: border-box;
}
.examples {
  display: flex;
  gap: 15rpx;
  margin-bottom: 30rpx;
}
.example-btn {
  background-color: #f1f5f9;
  color: #475569;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
}
.analyze-btn {
  background-color: #10b981;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: 40rpx;
  border: none;
}

.result-card {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 35rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 10rpx 25rpx rgba(0,0,0,0.05);
  animation: slideUp 0.4s ease;
}
@keyframes slideUp {
  from { transform: translateY(20rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2rpx dashed #f1f5f9;
  padding-bottom: 25rpx;
  margin-bottom: 25rpx;
}
.success-tag {
  background-color: #d1fae5;
  color: #065f46;
  font-size: 18rpx;
  font-weight: 700;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  display: inline-block;
}
.food-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #1e293b;
  display: block;
  margin-top: 10rpx;
}
.calories-label {
  font-size: 20rpx;
  color: #94a3b8;
  display: block;
  text-align: right;
}
.calories-value {
  font-size: 38rpx;
  font-weight: 900;
  color: #10b981;
}
.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 35rpx;
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
  margin-bottom: 5rpx;
}
.nutrition-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
}

.action-section {
  background-color: #f0fdf4;
  border: 1rpx solid #bbf7d0;
  border-radius: 20rpx;
  padding: 25rpx;
}
.action-tip {
  font-size: 22rpx;
  color: #166534;
  font-weight: 700;
  display: block;
  margin-bottom: 15rpx;
}
.meal-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15rpx;
}
.meal-btn {
  font-size: 24rpx;
  font-weight: 600;
  color: #ffffff;
  border-radius: 12rpx;
  padding: 10rpx 0;
  line-height: 2;
  border: none;
}
.breakfast { background-color: #3b82f6; }
.lunch { background-color: #f59e0b; }
.dinner { background-color: #10b981; }
.snack { background-color: #8b5cf6; }

.info-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #64748b;
  display: block;
}
.info-text {
  font-size: 20rpx;
  color: #94a3b8;
  line-height: 1.6;
  margin-top: 10rpx;
  display: block;
}
</style>