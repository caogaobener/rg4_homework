<template>
  <view class="container">
    <!-- 聊天消息列表 -->
    <scroll-view 
      class="message-list" 
      scroll-y="true" 
      :scroll-into-view="`msg-${chatMessages.length-1}`"
    >
      <view 
        v-for="(msg, index) in chatMessages" 
        :key="msg.id"
        :id="`msg-${index}`"
        class="message-item"
        :class="{ user: msg.role === 'user' }"
      >
        <view class="avatar">
          <text>{{ msg.role === 'user' ? '👤' : '✨' }}</text>
        </view>
        <view class="message-content">
          <text class="message-text">{{ msg.text }}</text>
        </view>
      </view>
      
      <view v-if="isLoading" class="loading-message">
        <text class="loading-text">AI营养学专家思忖中...</text>
      </view>
    </scroll-view>
	
    <!-- 顶部快捷功能入口 -->
    <view class="quick-actions">
      <view class="quick-action-btn" @click="navToPhoto">
        <text class="quick-icon">📷</text>
        <text class="quick-text">拍照识食</text>
      </view>
      
      <view class="quick-action-btn" @click="navToVoice">
        <text class="quick-icon">🎤</text>
        <text class="quick-text">语音记餐</text>
      </view>
    </view>
	
    <!-- 输入区域 -->
    <view class="input-area">
      <input 
        v-model="inputText"
        class="message-input"
        placeholder="咨询你的专属营养配餐建议..."
        @confirm="sendMessage"
		:disabled="isLoading"
      />
      <button 
        class="send-btn"
        @click="sendMessage"
        :disabled="!inputText.trim()"
      >
        {{ isLoading ? '发送中' : '发送' }}
      </button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      chatMessages: [
        { 
          id: 1, 
          role: 'assistant', 
          text: '你好！我是"轻养派"的AI私人营养师。你可以上传今天吃的食物照片，或者直接告诉我你吃了什么，我来帮你分析热量与营养，提供健康的饮食建议！' 
        }
      ],
      inputText: '',
      isLoading: false
    }
  },
  
  methods: {
    // 发送消息
	async sendMessage() {
	  if (!this.inputText.trim() || this.isLoading) return;
	  const userText = this.inputText.trim();
	  this.chatMessages.push({ id: Date.now(), role: 'user', text: userText });
	  this.inputText = '';
	  this.isLoading = true;

	  try {
		const res = await uni.request({
		  url: 'http://localhost:3000/api/agent/chat',
		  method: 'POST',
		  header: {
			'Authorization': 'Bearer ' + uni.getStorageSync('token'),
			'Content-Type': 'application/json'
		  },
		  data: { question: userText },
		  timeout: 15000
		});
		if (res.data.code === 0 && res.data.data?.answer) {
		  this.chatMessages.push({
			id: Date.now()+1, role: 'assistant', text: res.data.data.answer
		  });
		}
	  } catch (err) {
		this.chatMessages.push({
		  id: Date.now()+1, role: 'assistant', text: '抱歉，AI繁忙，请稍后再试~'
		});
		uni.showToast({ title: '请求失败', icon: 'none' });
	  } finally {
		this.isLoading = false;
	  }
	},

    // 导航到拍照识食页（移到methods里面了）
    navToPhoto() {
      uni.navigateTo({ url: '/pages/food/photo' });
    },
    
    // 导航到语音记餐页（移到methods里面了）
    navToVoice() {
      uni.navigateTo({ url: '/pages/food/voice' });
    }
  }
}
</script>
<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8fafc;
}

.message-list {
  flex: 1;
  padding: 20rpx;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: 15rpx;
  margin-bottom: 25rpx;
}

.message-item.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: #0d9488;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}

.message-item.user .avatar {
  background-color: #10b981;
}

.message-content {
  max-width: 70%;
  background-color: #ffffff;
  padding: 20rpx;
  border-radius: 20rpx;
  border-top-left-radius: 0;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.message-item.user .message-content {
  background-color: #10b981;
  color: #ffffff;
  border-top-left-radius: 20rpx;
  border-top-right-radius: 0;
}

.message-text {
  font-size: 26rpx;
  line-height: 1.6;
  color: #334155;
}

.message-item.user .message-text {
  color: #ffffff;
}

.loading-message {
  text-align: center;
  padding: 20rpx;
  color: #94a3b8;
  font-size: 24rpx;
}

/* 顶部快捷功能入口 */
.quick-actions {
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  background-color: #ffffff;
  border-top: 1rpx solid #e2e8f0;
}

.quick-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 15rpx;
  background-color: #f8fafc;
  border-radius: 12rpx;
  transition: all 0.2s;
}

.quick-action-btn:active {
  transform: scale(0.95);
  background-color: #f1f5f9;
}

.quick-icon {
  font-size: 28rpx;
}

.quick-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #334155;
}

.input-area {
  display: flex;
  align-items: center;
  gap: 15rpx;
  padding: 20rpx;
  background-color: #ffffff;
  border-top: 1rpx solid #e2e8f0;
}

.message-input {
  flex: 1;
  background-color: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 40rpx;
  padding: 15rpx 25rpx;
  font-size: 26rpx;
  color: #334155;
}

.send-btn {
  background-color: #10b981;
  color: #ffffff;
  padding: 15rpx 30rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: 600;
  border: none;
  transition: all 0.2s;
}

.send-btn:active {
  background-color: #059669;
}

.send-btn:disabled {
  background-color: #e2e8f0;
  color: #94a3b8;
}
</style>