/** 中文数字 → 阿拉伯数字（用于语音打卡时长/热量解析） */
const CN_DIGIT = {
  零: 0, 一: 1, 二: 2, 两: 2, 俩: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9
}

/** 匹配中文数字串（不含单位） */
const CN_NUMERAL = '[零一二两俩三四五六七八九十百千]+'

/** 匹配阿拉伯或中文数字 */
const NUMBER_TOKEN = `(\\d+(?:\\.\\d+)?|${CN_NUMERAL})`

function parseChineseNumber(str) {
  if (!str) return NaN
  const s = String(str).trim()
  if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s)

  let total = 0
  let current = 0

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (CN_DIGIT[ch] !== undefined) {
      current = CN_DIGIT[ch]
    } else if (ch === '十') {
      total += (current || 1) * 10
      current = 0
    } else if (ch === '百') {
      total += (current || 1) * 100
      current = 0
    } else if (ch === '千') {
      total += (current || 1) * 1000
      current = 0
    } else {
      return NaN
    }
  }

  return total + current
}

function parseNumberToken(token) {
  if (token == null || token === '') return NaN
  const n = parseChineseNumber(String(token).trim())
  return Number.isFinite(n) ? n : NaN
}

/** 时长/热量等单位前的数字（阿拉伯或中文） */
function numberPattern() {
  return NUMBER_TOKEN
}

module.exports = {
  CN_NUMERAL,
  NUMBER_TOKEN,
  parseChineseNumber,
  parseNumberToken,
  numberPattern
}
