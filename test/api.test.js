// Kiểm thử tự động: npm test (cần MongoDB đang chạy)
// Test tự seed lại và chỉ dùng database riêng "<tên db>_test" nên không ảnh hưởng dữ liệu đang dùng.
require('dotenv').config();
process.env.MONGO_URI = process.env.MONGO_URI_TEST || process.env.MONGO_URI.replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const app = require('../src/app');
const seed = require('../src/seed/seed');

let base;
const tokens = {};
let server;

// Gọi API: call('POST', '/auth/login', { body, token })
const call = async (method, url, { body, token, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: form || (body && JSON.stringify(body)) });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, json: ct.includes('json') ? await res.json() : null };
};
const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: 'Abc@1234' } })).json.token;

test.before(async () => {
  await seed();
  await mongoose.connect(process.env.MONGO_URI);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
  tokens.admin = await login('admin@bk.edu.vn');
  tokens.officer = await login('canbo@bk.edu.vn');
  tokens.ts1 = await login('thisinh1@example.com');
  tokens.ts2 = await login('thisinh2@example.com');
  tokens.ts4 = await login('thisinh4@example.com');
  tokens.ts6 = await login('thisinh6@example.com');
});
test.after(async () => { server.close(); await mongoose.disconnect(); });

test('Xác thực & phân quyền', async (t) => {
  await t.test('đăng ký trùng email -> 409', async () => {
    const r = await call('POST', '/auth/register', { body: { fullName: 'A', email: 'thisinh1@example.com', password: '123456' } });
    assert.equal(r.status, 409);
  });
  await t.test('đăng ký kèm role admin -> vẫn là candidate', async () => {
    const email = `moi${Date.now()}@example.com`;
    const r = await call('POST', '/auth/register', { body: { fullName: 'Mới', email, password: '123456', role: 'admin' } });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.role, 'candidate');
  });
  await t.test('dữ liệu sai -> 400 kèm danh sách lỗi', async () => {
    const r = await call('POST', '/auth/register', { body: { email: 'sai', password: '1' } });
    assert.equal(r.status, 400);
    assert.ok(r.json.errors.length >= 3);
  });
  await t.test('GET /auth/me: có token 200, không token 401', async () => {
    assert.equal((await call('GET', '/auth/me', { token: tokens.ts1 })).status, 200);
    assert.equal((await call('GET', '/auth/me')).status, 401);
  });
  await t.test('POST /majors: không token 401, thí sinh 403', async () => {
    const body = { code: 'X', name: 'X', quota: 1 };
    assert.equal((await call('POST', '/majors', { body })).status, 401);
    assert.equal((await call('POST', '/majors', { body, token: tokens.ts1 })).status, 403);
  });
});

test('Danh mục: CRUD, lọc, phân trang', async (t) => {
  let id;
  await t.test('admin tạo / trùng mã 409 / sửa / xóa', async () => {
    const body = { code: 'tmp', name: 'Ngành tạm', quota: 5 };
    const c = await call('POST', '/majors', { body, token: tokens.admin });
    assert.equal(c.status, 201);
    assert.equal(c.json.data.code, 'TMP');
    id = c.json.data._id;
    assert.equal((await call('POST', '/majors', { body, token: tokens.admin })).status, 409);
    const u = await call('PATCH', `/majors/${id}`, { body: { quota: 9 }, token: tokens.admin });
    assert.equal(u.json.data.quota, 9);
    assert.equal((await call('DELETE', `/majors/${id}`, { token: tokens.admin })).status, 200);
    assert.equal((await call('GET', `/majors/${id}`)).status, 404);
  });
  await t.test('id sai định dạng -> 400', async () => {
    assert.equal((await call('GET', '/majors/abc')).status, 400);
  });
  await t.test('danh sách: tìm kiếm + sắp xếp + phân trang', async () => {
    const r = await call('GET', '/majors?q=công&sort=-quota&limit=2');
    assert.equal(r.status, 200);
    assert.equal(r.json.pagination.limit, 2);
    assert.ok(r.json.data[0].name.toLowerCase().includes('công'));
  });
  await t.test('khách chỉ thấy thông báo đã đăng', async () => {
    const guest = await call('GET', '/announcements');
    const staff = await call('GET', '/announcements', { token: tokens.officer });
    assert.equal(guest.json.pagination.total, 2);
    assert.equal(staff.json.pagination.total, 3);
  });
  await t.test('không xóa được ngành đã có hồ sơ -> 409', async () => {
    const majors = (await call('GET', '/majors?q=CNTT')).json.data;
    assert.equal((await call('DELETE', `/majors/${majors[0]._id}`, { token: tokens.admin })).status, 409);
  });
});

test('Hồ sơ xét tuyển', async (t) => {
  const rounds = (await call('GET', '/admission-rounds?status=open')).json.data;
  const methods = (await call('GET', '/methods')).json.data;
  const majors = (await call('GET', '/majors?isActive=true&sort=code')).json.data;
  const thpt = methods.find((m) => m.code === 'THPT');
  const draft = {
    round: rounds[0]._id, method: thpt._id, combo: 'A00',
    personalInfo: { fullName: 'Thí sinh Mới', dob: '2008-04-01', idNumber: '012345678901', phone: '0987654321', province: 'Hà Nội' },
    scores: [{ subject: 'Toán', score: 9 }, { subject: 'Lý', score: 8 }],
    priority: { area: 'KV1' },
    choices: [{ major: majors[0]._id }, { major: majors[1]._id }],
  };
  let appId;

  await t.test('thí sinh 6 tạo hồ sơ nháp -> 201; tạo lần 2 -> 409', async () => {
    const r = await call('POST', '/applications', { body: { ...draft, score: 30, status: 'approved' }, token: tokens.ts6 });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.status, 'draft');          // client không tự đặt được status
    assert.equal(r.json.data.score, undefined);         // client không tự đặt được điểm
    appId = r.json.data._id;
    assert.equal((await call('POST', '/applications', { body: draft, token: tokens.ts6 })).status, 409);
  });
  await t.test('nộp khi thiếu điểm môn Hóa -> 400', async () => {
    const r = await call('PATCH', `/applications/${appId}/submit`, { token: tokens.ts6 });
    assert.equal(r.status, 400);
    assert.match(r.json.message, /Hóa/);
  });
  await t.test('thí sinh khác xem hồ sơ -> 403', async () => {
    assert.equal((await call('GET', `/applications/${appId}`, { token: tokens.ts2 })).status, 403);
  });
  await t.test('bổ sung điểm rồi nộp: server tự tính 9+8+7.5+0.75 = 25.25', async () => {
    const up = await call('PATCH', `/applications/${appId}`, {
      body: { scores: [{ subject: 'Toán', score: 9 }, { subject: 'Lý', score: 8 }, { subject: 'Hóa', score: 7.5 }] }, token: tokens.ts6,
    });
    assert.equal(up.status, 200);
    assert.equal(up.json.data.personalInfo.fullName, 'Thí sinh Mới');   // trường không gửi vẫn còn
    const r = await call('PATCH', `/applications/${appId}/submit`, { token: tokens.ts6 });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.score, 25.25);
    assert.equal(r.json.data.status, 'submitted');
    assert.equal((await call('PATCH', `/applications/${appId}`, { body: { combo: 'A01' }, token: tokens.ts6 })).status, 409);
  });
  await t.test('trùng CCCD trong cùng đợt -> 409', async () => {
    const r = await call('POST', '/applications', { body: { ...draft, personalInfo: { ...draft.personalInfo, idNumber: '012345678901' } }, token: tokens.ts2 });
    assert.equal(r.status, 409);
  });
  await t.test('thí sinh gọi API duyệt -> 403; từ chối thiếu note -> 400', async () => {
    assert.equal((await call('PATCH', `/applications/${appId}/review`, { body: { action: 'approve' }, token: tokens.ts6 })).status, 403);
    assert.equal((await call('PATCH', `/applications/${appId}/review`, { body: { action: 'reject' }, token: tokens.officer })).status, 400);
  });
  await t.test('cán bộ yêu cầu bổ sung -> thí sinh sửa và nộp lại -> duyệt', async () => {
    const rv = await call('PATCH', `/applications/${appId}/review`, { body: { action: 'request_more', note: 'Thiếu ảnh' }, token: tokens.officer });
    assert.equal(rv.json.data.status, 'need_more_info');
    assert.equal((await call('PATCH', `/applications/${appId}/review`, { body: { action: 'approve' }, token: tokens.officer })).status, 409);
    assert.equal((await call('PATCH', `/applications/${appId}/submit`, { token: tokens.ts6 })).status, 200);
    const ok = await call('PATCH', `/applications/${appId}/review`, { body: { action: 'approve' }, token: tokens.officer });
    assert.equal(ok.json.data.status, 'approved');
  });
  await t.test('phương thức học bạ bắt buộc minh chứng (thí sinh 4 chưa có ảnh) -> 400', async () => {
    const mine = (await call('GET', '/applications/my', { token: tokens.ts4 })).json.data[0];
    const r = await call('PATCH', `/applications/${mine._id}/submit`, { token: tokens.ts4 });
    assert.equal(r.status, 400);
    assert.match(r.json.message, /minh chứng/);
  });
  await t.test('lọc theo ngành + khoảng điểm + sắp xếp giảm dần + phân trang', async () => {
    const r = await call('GET', `/majors/${majors[0]._id}/applications?minScore=10&sort=-score&limit=3`, { token: tokens.officer });
    assert.equal(r.status, 200);
    const scores = r.json.data.map((a) => a.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    assert.ok(r.json.data.length <= 3);
    assert.equal((await call('GET', '/applications', { token: tokens.ts1 })).status, 403);
  });
  await t.test('upload: file không phải ảnh -> 400; ảnh hợp lệ -> 201 và tải lại được', async () => {
    const mine = (await call('GET', '/applications/my', { token: tokens.ts1 })).json.data[0];   // hồ sơ nháp
    const bad = new FormData();
    bad.append('images', new Blob(['echo hi'], { type: 'application/x-msdownload' }), 'a.exe');
    assert.equal((await call('POST', `/applications/${mine._id}/evidences`, { form: bad, token: tokens.ts1 })).status, 400);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64');
    const good = new FormData();
    good.append('images', new Blob([png], { type: 'image/png' }), 'hocba.png');
    const up = await call('POST', `/applications/${mine._id}/evidences`, { form: good, token: tokens.ts1 });
    assert.equal(up.status, 201);
    const file = await fetch(base.replace('/api/v1', '') + up.json.data[0].url, { headers: { Authorization: `Bearer ${tokens.ts1}` } });
    assert.equal(file.status, 200);
    assert.equal((await fetch(base.replace('/api/v1', '') + up.json.data[0].url)).status, 401);
  });
});

test('Nâng cao: xét tuyển tự động & thống kê', async (t) => {
  const closed = (await call('GET', '/admission-rounds?status=closed')).json.data[0];
  await t.test('đợt đang mở -> 409', async () => {
    const open = (await call('GET', '/admission-rounds?status=open')).json.data[0];
    assert.equal((await call('POST', `/admission-rounds/${open._id}/auto-admit`, { token: tokens.admin })).status, 409);
  });
  await t.test('đợt đã đóng: không ngành nào vượt chỉ tiêu, chạy lại cho cùng kết quả', async () => {
    const run = () => call('POST', `/admission-rounds/${closed._id}/auto-admit`, { token: tokens.admin });
    const a = await run(), b = await run();
    assert.equal(a.status, 200);
    assert.deepEqual(a.json.data.report, b.json.data.report);
    assert.equal(a.json.data.totalProcessed, 10);
    for (const m of a.json.data.report) assert.ok(m.admitted <= m.quota);
  });
  await t.test('thống kê theo ngành và theo tỉnh', async () => {
    const byMajor = await call('GET', '/statistics/applications?by=major', { token: tokens.officer });
    const byProv = await call('GET', '/statistics/applications?by=province', { token: tokens.officer });
    assert.equal(byMajor.status, 200);
    assert.ok(byMajor.json.data[0].code);
    assert.ok(byProv.json.data[0].province);
    assert.equal((await call('GET', '/statistics/applications?by=x', { token: tokens.officer })).status, 400);
  });
});

test('Giới hạn đăng nhập: sai quá 5 lần -> 429', async () => {
  let last;
  for (let i = 0; i < 6; i++)
    last = await call('POST', '/auth/login', { body: { email: 'thisinh3@example.com', password: 'sai-mat-khau' } });
  assert.equal(last.status, 429);
});
