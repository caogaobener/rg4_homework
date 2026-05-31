<script>
	export default {
		onLaunch: function() {
			if (wx.cloud) {
			    wx.cloud.init({
			      env: 'cloudbase-d0g00yb41902d0169', // 比如 qingyang-prod-12345
			      traceUser: true
			    })
			    console.log('🚀 微信云开发公网数据库通电成功！')
			  }
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
