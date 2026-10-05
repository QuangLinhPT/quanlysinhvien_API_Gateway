// Các hàm trợ giúp dùng chung cho backend Node.js

// Wrapper xử lý bất đồng bộ cho Express route handlers (bắt lỗi gởi đến next middleware)
function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Xây dựng mệnh đề tìm kiếm SQL dạng LIKE linh hoạt dựa trên danh sách trường truyền vào
function buildSearch(req, fields) {
  const q = (req.query.search || '').trim();
  if (!q) return { clause: '', params: [] };
  const params = [];
  const ors = fields.map((f) => {
    params.push(`%${q}%`);
    return `${f} LIKE @p${params.length}`;
  });
  return { clause: `(${ors.join(' OR ')})`, params };
}

module.exports = { asyncH, buildSearch };