
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');
const morgan = require('morgan');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.APP_PORT || 3000;

// ==================== PROMETHEUS METRICS ====================
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'blogcms_' });

const httpRequestsTotal = new promClient.Counter({
  name: 'blogcms_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new promClient.Histogram({
  name: 'blogcms_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const dbQueryCounter = new promClient.Counter({
  name: 'blogcms_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation']
});

const activeUsers = new promClient.Gauge({
  name: 'blogcms_active_sessions',
  help: 'Number of active user sessions'
});

// ==================== MIDDLEWARE ====================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('combined'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'blogcms-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 3600000 }
}));

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.inc({ method: req.method, route: route, status_code: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route: route, status_code: res.statusCode }, duration);
  });
  next();
});

// ==================== DATABASE CONNECTION ====================
let pool;

async function initDatabase() {
  const maxRetries = 30;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST || 'mysql',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'blog_user',
        password: process.env.DB_PASSWORD || 'BlogUser@2024!Secure',
        database: process.env.DB_NAME || 'blog_cms_db',
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      const conn = await pool.getConnection();
      console.log('✅ Kết nối MySQL thành công!');
      conn.release();
      return;
    } catch (err) {
      retries++;
      console.log(`⏳ Đang chờ MySQL khởi động... (${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  console.error('❌ Không thể kết nối MySQL sau nhiều lần thử!');
  process.exit(1);
}

async function query(sql, params = []) {
  dbQueryCounter.inc({ operation: sql.trim().split(' ')[0].toUpperCase() });
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ==================== ROUTES ====================

// --- Health & Metrics ---
app.get('/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'Blog CMS',
      student: 'Hoàng Duy Mạnh - DTC245200060',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// --- Trang chủ ---
app.get('/', async (req, res) => {
  try {
    const posts = await query(`
      SELECT p.*, c.name as category_name, u.full_name as author_name 
      FROM posts p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN users u ON p.author_id = u.id 
      ORDER BY p.created_at DESC LIMIT 10
    `);
    const categories = await query('SELECT * FROM categories ORDER BY name');
    res.render('index', { posts, categories, title: 'Trang chủ' });
  } catch (err) {
    console.error('Lỗi trang chủ:', err);
    res.status(500).render('error', { message: 'Lỗi tải trang chủ', error: err.message });
  }
});

// --- POSTS CRUD ---
app.get('/posts', async (req, res) => {
  try {
    const posts = await query(`
      SELECT p.*, c.name as category_name, u.full_name as author_name 
      FROM posts p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN users u ON p.author_id = u.id 
      ORDER BY p.created_at DESC
    `);
    res.render('posts/index', { posts, title: 'Danh sách bài viết' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.get('/posts/create', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY name');
    const users = await query('SELECT id, full_name FROM users ORDER BY full_name');
    res.render('posts/create', { categories, users, title: 'Tạo bài viết mới' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.post('/posts/create', async (req, res) => {
  try {
    const { title, content, category_id, author_id, status } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await query(
      'INSERT INTO posts (title, slug, content, category_id, author_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, content, category_id || null, author_id || 1, status || 'published']
    );
    res.redirect('/posts');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi tạo bài viết', error: err.message });
  }
});

app.get('/posts/edit/:id', async (req, res) => {
  try {
    const [post] = await query('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).render('error', { message: 'Không tìm thấy bài viết', error: '' });
    const categories = await query('SELECT * FROM categories ORDER BY name');
    const users = await query('SELECT id, full_name FROM users ORDER BY full_name');
    res.render('posts/edit', { post, categories, users, title: 'Sửa bài viết' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.post('/posts/edit/:id', async (req, res) => {
  try {
    const { title, content, category_id, author_id, status } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await query(
      'UPDATE posts SET title=?, slug=?, content=?, category_id=?, author_id=?, status=?, updated_at=NOW() WHERE id=?',
      [title, slug, content, category_id || null, author_id || 1, status || 'published', req.params.id]
    );
    res.redirect('/posts');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi cập nhật', error: err.message });
  }
});

app.post('/posts/delete/:id', async (req, res) => {
  try {
    await query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.redirect('/posts');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi xóa bài viết', error: err.message });
  }
});

app.get('/posts/:id', async (req, res) => {
  try {
    const [post] = await query(`
      SELECT p.*, c.name as category_name, u.full_name as author_name, u.email as author_email
      FROM posts p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN users u ON p.author_id = u.id 
      WHERE p.id = ?
    `, [req.params.id]);
    if (!post) return res.status(404).render('error', { message: 'Không tìm thấy bài viết', error: '' });
    res.render('posts/show', { post, title: post.title });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

// --- CATEGORIES CRUD ---
app.get('/categories', async (req, res) => {
  try {
    const categories = await query(`
      SELECT c.*, COUNT(p.id) as post_count 
      FROM categories c 
      LEFT JOIN posts p ON c.id = p.category_id 
      GROUP BY c.id 
      ORDER BY c.name
    `);
    res.render('categories/index', { categories, title: 'Danh mục' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.get('/categories/create', (req, res) => {
  res.render('categories/create', { title: 'Tạo danh mục mới' });
});

app.post('/categories/create', async (req, res) => {
  try {
    const { name, description } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await query('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)', [name, slug, description || '']);
    res.redirect('/categories');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi tạo danh mục', error: err.message });
  }
});

app.get('/categories/edit/:id', async (req, res) => {
  try {
    const [category] = await query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!category) return res.status(404).render('error', { message: 'Không tìm thấy danh mục', error: '' });
    res.render('categories/edit', { category, title: 'Sửa danh mục' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.post('/categories/edit/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await query('UPDATE categories SET name=?, slug=?, description=? WHERE id=?', [name, slug, description || '', req.params.id]);
    res.redirect('/categories');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi cập nhật', error: err.message });
  }
});

app.post('/categories/delete/:id', async (req, res) => {
  try {
    await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.redirect('/categories');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi xóa', error: err.message });
  }
});

// --- USERS CRUD ---
app.get('/users', async (req, res) => {
  try {
    const users = await query(`
      SELECT u.*, COUNT(p.id) as post_count 
      FROM users u 
      LEFT JOIN posts p ON u.id = p.author_id 
      GROUP BY u.id 
      ORDER BY u.full_name
    `);
    res.render('users/index', { users, title: 'Người dùng' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.get('/users/create', (req, res) => {
  res.render('users/create', { title: 'Thêm người dùng' });
});

app.post('/users/create', async (req, res) => {
  try {
    const { username, email, full_name, role } = req.body;
    await query(
      'INSERT INTO users (username, email, full_name, role) VALUES (?, ?, ?, ?)',
      [username, email, full_name, role || 'author']
    );
    res.redirect('/users');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi thêm người dùng', error: err.message });
  }
});

app.get('/users/edit/:id', async (req, res) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).render('error', { message: 'Không tìm thấy người dùng', error: '' });
    res.render('users/edit', { user, title: 'Sửa người dùng' });
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi', error: err.message });
  }
});

app.post('/users/edit/:id', async (req, res) => {
  try {
    const { username, email, full_name, role } = req.body;
    await query('UPDATE users SET username=?, email=?, full_name=?, role=? WHERE id=?',
      [username, email, full_name, role || 'author', req.params.id]);
    res.redirect('/users');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi cập nhật', error: err.message });
  }
});

app.post('/users/delete/:id', async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.redirect('/users');
  } catch (err) {
    res.status(500).render('error', { message: 'Lỗi xóa', error: err.message });
  }
});

// --- Error handling ---
app.use((req, res) => {
  res.status(404).render('error', { message: 'Trang không tồn tại (404)', error: `Đường dẫn "${req.originalUrl}" không được tìm thấy.` });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).render('error', { message: 'Lỗi máy chủ (500)', error: err.message });
});

// ==================== START SERVER ====================
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Blog CMS đang chạy tại http://0.0.0.0:${PORT}`);
    console.log(`📊 Metrics: http://0.0.0.0:${PORT}/metrics`);
    console.log(`💚 Health: http://0.0.0.0:${PORT}/health`);
    console.log(`👨‍🎓 Sinh viên: Hoàng Duy Mạnh - DTC245200060`);
  });
});
