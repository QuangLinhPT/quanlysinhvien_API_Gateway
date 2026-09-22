const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

router.get('/', authRequired, asyncH(async (req, res) => {
  const classesRes = await query(`
    SELECT c.*, u.full_name AS class_teacher_name,
      (SELECT COUNT(*) FROM dbo.students s WHERE s.class_id = c.id) AS student_count
    FROM dbo.classes c
    LEFT JOIN dbo.users u ON u.id = c.class_teacher_id
    ORDER BY c.id`);

  const sectionsRes = await query(`SELECT id, class_id, name FROM dbo.sections ORDER BY id`);
  const sectionsByClass = {};
  for (const sec of sectionsRes.rows) {
    if (!sectionsByClass[sec.class_id]) sectionsByClass[sec.class_id] = [];
    sectionsByClass[sec.class_id].push({ id: sec.id, name: sec.name });
  }

  const result = classesRes.rows.map((cls) => {
    let secList = sectionsByClass[cls.id] || [];
    return {
      ...cls,
      student_count: parseInt(cls.student_count || 0, 10),
      sections: typeof secList === 'string' ? secList : JSON.stringify(secList),
    };
  });

  res.json(result);
}));

router.post('/', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { name, academic_year, class_teacher_id } = req.body;
  if (!name || !academic_year) return res.status(400).json({ error: 'Name and academic year required' });
  const r = await query('INSERT INTO dbo.classes (name, academic_year, class_teacher_id) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3)', [name, academic_year, class_teacher_id || null]);
  res.status(201).json(r.rows[0]);
}));

router.put('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { name, academic_year, class_teacher_id } = req.body;
  await query('UPDATE dbo.classes SET name=COALESCE(@p1, name), academic_year=COALESCE(@p2, academic_year), class_teacher_id=COALESCE(@p3, class_teacher_id) WHERE id=@p4',
    [name || null, academic_year || null, class_teacher_id || null, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.classes WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/:id/sections', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { name } = req.body;
  const r = await query('INSERT INTO dbo.sections (class_id, name) OUTPUT INSERTED.* VALUES (@p1, @p2)', [req.params.id, name]);
  res.status(201).json(r.rows[0]);
}));

router.delete('/sections/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.sections WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/:id/subjects', authRequired, asyncH(async (req, res) => {
  const r = await query('SELECT * FROM dbo.subjects WHERE class_id=@p1 ORDER BY name', [req.params.id]);
  res.json(r.rows);
}));

router.post('/:id/subjects', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { name, code } = req.body;
  const r = await query('INSERT INTO dbo.subjects (name, code, class_id) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3)', [name, code || null, req.params.id]);
  res.status(201).json(r.rows[0]);
}));

router.delete('/subjects/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.subjects WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;