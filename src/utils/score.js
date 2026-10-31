// Tính điểm xét tuyển = tổng 3 môn của tổ hợp + điểm ưu tiên (tối đa 3)
const AREA = { KV1: 0.75, 'KV2-NT': 0.5, KV2: 0.25, KV3: 0 };
const GROUP = { none: 0, UT1: 2, UT2: 1 };
const httpError = require('./httpError');

exports.calcScore = (method, comboCode, scores = [], priority = {}) => {
  const combo = method.combos.find((c) => c.code === comboCode);
  if (!combo) throw httpError(400, 'Tổ hợp không thuộc phương thức đã chọn');

  const total = combo.subjects.reduce((sum, name) => {
    const s = scores.find((x) => x.subject === name);
    if (!s) throw httpError(400, `Thiếu điểm môn ${name}`);
    return sum + s.score;
  }, 0);

  const bonus = Math.min(3, (AREA[priority.area] || 0) + (GROUP[priority.group] || 0));
  return Math.round((total + bonus) * 100) / 100;
};
