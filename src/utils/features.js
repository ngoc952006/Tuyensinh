// Lọc – sắp xếp – phân trang dùng chung cho mọi API danh sách

const isStr = (v) => typeof v === 'string' && v !== '';

// Tránh ký tự đặc biệt trong từ khóa tìm kiếm regex
exports.escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 'true'/'false' trong query string -> boolean
const parseValue = (v) => (v === 'true' ? true : v === 'false' ? false : v);

// sort=-score,createdAt chỉ nhận các trường nằm trong danh sách cho phép
const parseSort = (sort, allowed, fallback) => {
  const fields = (isStr(sort) ? sort.split(',') : []).filter((f) => allowed.includes(f.replace('-', '')));
  return fields.length ? fields.join(' ') : fallback;
};

exports.listResult = async (Model, filter, req, { sortable, defaultSort, populate }) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const query = Model.find(filter)
    .sort(parseSort(req.query.sort, sortable, defaultSort))
    .skip((page - 1) * limit)
    .limit(limit);
  if (populate) query.populate(populate);
  const [data, total] = await Promise.all([query, Model.countDocuments(filter)]);
  return { success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// Lấy các tham số query (chỉ dạng chuỗi) thành điều kiện lọc: { status: 'submitted', ... }
exports.pickFilters = (query, fields) => {
  const filter = {};
  for (const f of fields) if (isStr(query[f])) filter[f] = parseValue(query[f]);
  return filter;
};
