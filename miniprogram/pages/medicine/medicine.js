// pages/medicine/medicine.js
Page({
  data: {
    medicineList: [],
    showPopup: false,
    form: { name: "", dose: "", time: "" }
  },

  onLoad() {
    this.getList();
  },

  // 获取药品列表
  async getList() {
    try {
      const res = await wx.cloud.callFunction({ name: "getMedicines" });
      this.setData({ medicineList: res.result.data });
    } catch (err) {
      console.log("获取列表失败", err);
    }
  },

  // 显示添加弹窗
  showAddPopup() {
    this.setData({
      showPopup: true,
      form: { name: "", dose: "", time: "" }
    });
  },

  // 保存药品
  async saveMedicine() {
    const { form } = this.data;
    if (!form.name || !form.time) {
      wx.showToast({ title: "药名和时间不能为空", icon: "none" });
      return;
    }

    try {
      await wx.cloud.callFunction({
        name: "addMedicine",
        data: form
      });

      wx.showToast({ title: "添加成功" });
      this.closePopup();
      this.getList();
    } catch (err) {
      wx.showToast({ title: "添加失败", icon: "none" });
    }
  },

  // 删除药品
  async deleteMedicine(e) {
    const _id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个药品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({
              name: "deleteMedicine",
              data: { _id }
            });
            wx.showToast({ title: "删除成功" });
            this.getList();
          } catch (err) {
            console.error("删除失败", err);
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      }
    });
  },

  // 关闭弹窗
  closePopup() {
    this.setData({ showPopup: false });
  },

  // 服药打卡
  async checkIn(e) {
    const medicineId = e.currentTarget.dataset.id;
    try {
      await wx.cloud.callFunction({
        name: "checkInMedicine",
        data: { medicineId }
      });
      wx.showToast({ title: "打卡成功" });
      this.getList();
    } catch (err) {
      wx.showToast({ title: "打卡失败", icon: "none" });
    }
  },

  // 输入框更新
  updateForm(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },

  // ========== 订阅消息授权 ==========
  requestSubscribe() {
    // 这里填你在微信公众平台申请的模板ID
    const tmplId = 'xX0swj1M2KppmVRTjJ5M6Eu_OdPsDf9lpgX931X7zb4'
    
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: (res) => {
        if (res[tmplId] === 'accept') {
          wx.showToast({ title: '已开启提醒' })
          // 保存授权状态到数据库
          this.saveSubscribeStatus(true)
        } else {
          wx.showToast({ title: '已拒绝提醒', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '授权失败', icon: 'none' })
      }
    })
  },

  // 保存订阅状态到云数据库
  async saveSubscribeStatus(isSubscribed) {
    try {
      await wx.cloud.callFunction({
        name: 'saveSubscribe',
        data: { isSubscribed }
      })
    } catch (err) {
      console.error('保存订阅状态失败', err)
    }
  }
});

