// Sinh sẵn 5 hàm CRUD (getAll, getById, create, update, remove) cho một Model.
// Dùng cho: majors, admission_rounds, methods, announcements, users.
const ah = require('./asyncHandler');
const httpError = require('./httpError');
const { listResult, pickFilters, escapeRegex } = require('./features');

module.exports = (Model, {
  label,                            // tên hiển thị trong thông báo lỗi
  search = [],                      // các trường tìm theo ?q=
  filters = [],                     // các trường lọc theo ?tenTruong=giaTri
  sortable = [],                    // các trường được phép ?sort=
  defaultSort = '-createdAt',
  baseFilter = () => ({}),          // điều kiện luôn áp dụng (vd: khách chỉ thấy thông báo đã đăng)
  beforeCreate = (req) => req.body, // chỉnh dữ liệu trước khi tạo
  isInUse,                          // hàm kiểm tra bản ghi có đang được dùng không (chặn xóa)
}) => {
  const findOneOr404 = async (req) => {
    const doc = await Model.findOne({ _id: req.params.id, ...baseFilter(req) });
    if (!doc) throw httpError(404, `Không tìm thấy ${label}`);
    return doc;
  };

  return {
    getAll: ah(async (req, res) => {
      const filter = pickFilters(req.query, filters);
      const q = req.query.q;
      if (typeof q === 'string' && q && search.length)
        filter.$or = search.map((f) => ({ [f]: { $regex: escapeRegex(q), $options: 'i' } }));
      Object.assign(filter, baseFilter(req));
      res.json(await listResult(Model, filter, req, { sortable: ['createdAt', ...sortable], defaultSort }));
    }),

    getById: ah(async (req, res) => {
      res.json({ success: true, data: await findOneOr404(req) });
    }),

    create: ah(async (req, res) => {
      const doc = await Model.create(beforeCreate(req));
      res.status(201).json({ success: true, data: doc });
    }),

    update: ah(async (req, res) => {
      const doc = await findOneOr404(req);
      const { _id, createdAt, updatedAt, ...data } = req.body;
      doc.set(data);
      await doc.save();                               // chạy validate + hook của Schema
      res.json({ success: true, data: doc });
    }),

    remove: ah(async (req, res) => {
      const doc = await findOneOr404(req);
      if (isInUse && (await isInUse(doc._id)))
        throw httpError(409, `Không thể xóa ${label} vì đã có dữ liệu liên quan`);
      await doc.deleteOne();
      res.json({ success: true, message: `Đã xóa ${label}` });
    }),
  };
};
