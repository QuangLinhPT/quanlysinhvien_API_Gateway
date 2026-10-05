// Tuyến API xử lý đăng nhập, đăng ký và quản lý tài khoản (Auth)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authRequired } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');

const router = express.Router();

// Hàm tạo JWT Token chứa thông tin cơ bản người dùng
function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Route Đăng nhập
router.post('/login',
  body('email').trim().notEmpty(),
  body('password').isLength({ min: 4 }),
  asyncH(async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ', details: errs.array() });
    const { email, password } = req.body;
    const r = await query('SELECT * FROM dbo.users WHERE email=@p1 AND is_active=1', [email.toLowerCase()]);
    if (!r.rows.length) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    const token = makeToken(u);
    res.json({ token, user: { id: u.id, email: u.email, role: u.role, name: u.full_name } });
  })
);

// Route Học sinh tự đăng ký tài khoản
router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').isLength({ min: 2 }),
  asyncH(async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: 'Dữ liệu đầu vào không hợp lệ', details: errs.array() });
    const { email, password, full_name, phone, roll_number, dob, gender, address, guardian_name, guardian_phone, guardian_email } = req.body;

    const exists = await query('SELECT id FROM dbo.users WHERE email=@p1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email đã được đăng ký' });

    const hash = await bcrypt.hash(password, 10);
    const ur = await query(
      `INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
       OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.full_name
       VALUES (@p1, @p2, @p3, @p4, @p5)`,
      [email.toLowerCase(), hash, 'student', full_name, phone || null]
    );
    const uid = ur.rows[0].id;

    const roll = roll_number || ('STU' + String(uid).padStart(4, '0'));
    await query(
      `INSERT INTO dbo.students (user_id, roll_number, dob, gender, address, guardian_name, guardian_phone, guardian_email)
       VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8)`,
      [uid, roll, dob || null, gender || null, address || null, guardian_name || null, guardian_phone || null, guardian_email || null]
    );

    const u = (await query('SELECT * FROM dbo.users WHERE id=@p1', [uid])).rows[0];
    const token = makeToken(u);
    res.status(201).json({ token, user: { id: u.id, email: u.email, role: u.role, name: u.full_name } });
  })
);

// Route lấy thông tin cá nhân hiện tại
router.get('/me', authRequired, asyncH(async (req, res) => {
  const r = await query('SELECT id, email, role, full_name, phone FROM dbo.users WHERE id=@p1', [req.user.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  const u = r.rows[0];
  let extra = {};
  if (u.role === 'student') {
    const s = await query(`SELECT s.*, c.name AS class_name, sec.name AS section_name
      FROM dbo.students s
      LEFT JOIN dbo.classes c ON c.id = s.class_id
      LEFT JOIN dbo.sections sec ON sec.id = s.section_id
      WHERE s.user_id=@p1`, [u.id]);
    extra = { student: s.rows[0] || null };
  } else if (u.role === 'teacher') {
    const t = await query('SELECT * FROM dbo.teachers WHERE user_id=@p1', [u.id]);
    extra = { teacher: t.rows[0] || null };
  }
  res.json({ user: u, ...extra });
}));

// Route cập nhật thông tin cá nhân
router.put('/me', authRequired, asyncH(async (req, res) => {
  const { full_name, phone } = req.body;
  await query('UPDATE dbo.users SET full_name=COALESCE(@p1, full_name), phone=COALESCE(@p2, phone), updated_at=GETDATE() WHERE id=@p3', [full_name, phone, req.user.id]);
  res.json({ ok: true });
}));

// Route đổi mật khẩu
router.post('/change-password', authRequired, asyncH(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Mật khẩu mới quá ngắn (tối thiểu 6 ký tự)' });
  const r = await query('SELECT password_hash FROM dbo.users WHERE id=@p1', [req.user.id]);
  const ok = await bcrypt.compare(current_password || '', r.rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác' });
  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE dbo.users SET password_hash=@p1, updated_at=GETDATE() WHERE id=@p2', [hash, req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;