const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { medicines } = event

  // 拼接用药信息
  let medicineInfo = medicines && medicines.length > 0
    ? `今天服用了：${medicines.map(m => m.name).join('、')}`
    : "今天没有用药记录";

  try {
    // 👇 这里直接写 hy3-preview
    const model = cloud.extend.AI.createModel("hy3-preview")

    const res = await model.generate({
      messages: [
        { role: "system", content: "你是贴心健康助手，根据用药情况生成100字内友好日报。" },
        { role: "user", content: medicineInfo }
      ]
    })

    return { report: res.choices[0].message.content }

  } catch (e) {
    console.error("AI调用失败：", e)
    return { report: "AI生成失败：" + e.message }
  }
}