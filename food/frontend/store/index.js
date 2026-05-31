const store = {
  state: {
    todayRecords: [],
    totalCalories:0, totalProtein:0, totalCarbs:0, totalFat:0
  },
  async initTodayRecords() {
    try {
      // const res = await uni.request({
      //   url:'http://localhost:3000/api/food/records/today',
      //   header:{Authorization:'Bearer '+uni.getStorageSync('token')}
      // });
      // if(res.data.code===0) {
      //   this.state.todayRecords = res.data.data.records;
      //   this.calc();
      // }
	   this.state.todayRecords = [
	        { id:1, name:'全麦面包', type:'早餐', calories:340, protein:16.5, carbs:45, fat:8, time:'07:45' }
	      ]
		this.calc()
    }catch(e){this.calc();}
  },
  addRecord(record) {
    this.state.todayRecords.unshift(record);
    this.calc();
  },
  clearRecords() {
    this.state.todayRecords = [];
    this.calc();
  },
  calc() {
    const s = this.state;
    s.totalCalories = s.todayRecords.reduce((a,b)=>a+b.calories,0);
    s.totalProtein = s.todayRecords.reduce((a,b)=>a+b.protein,0);
    s.totalCarbs = s.todayRecords.reduce((a,b)=>a+b.carbs,0);
    s.totalFat = s.todayRecords.reduce((a,b)=>a+b.fat,0);
  }
};
export default store;