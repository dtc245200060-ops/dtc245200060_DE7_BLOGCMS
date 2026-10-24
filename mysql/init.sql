
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Tạo database
CREATE DATABASE IF NOT EXISTS blog_cms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE blog_cms_db;
SET NAMES utf8mb4;


-- PHÂN QUYỀN DATABASE (Least Privilege - Hardening)
-- Tạo user blog_user chỉ có quyền SELECT, INSERT, UPDATE, DELETE
-- KHÔNG dùng tài khoản root cho ứng dụng web
CREATE USER IF NOT EXISTS 'blog_user'@'%' IDENTIFIED BY 'BlogUser@2024!Secure';
GRANT SELECT, INSERT, UPDATE, DELETE ON blog_cms_db.* TO 'blog_user'@'%';

-- Tạo user cho mysqld-exporter
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY 'ExporterPass2024' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
FLUSH PRIVILEGES;

-- ============================================================
-- BẢNG USERS (Người dùng)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'editor', 'author') DEFAULT 'author',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BẢNG CATEGORIES (Danh mục)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BẢNG POSTS (Bài viết)
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status ENUM('published', 'draft') DEFAULT 'published',
    category_id INT,
    author_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DỮ LIỆU MẪU - USERS
-- ============================================================
INSERT INTO users (username, email, full_name, role) VALUES
('hoangduymanh', 'dtc245200060@ictu.edu.vn', 'Hoàng Duy Mạnh', 'admin'),
('nguyenvana', 'nguyenvana@example.com', 'Nguyễn Văn A', 'editor'),
('tranthib', 'tranthib@example.com', 'Trần Thị B', 'author');

-- ============================================================
-- DỮ LIỆU MẪU - CATEGORIES
-- ============================================================
INSERT INTO categories (name, slug, description) VALUES
('Công nghệ', 'cong-nghe', 'Tin tức và bài viết về công nghệ thông tin, lập trình, phần mềm'),
('DevOps', 'devops', 'Triển khai, quản trị hệ thống, CI/CD, Docker, Kubernetes'),
('Học tập', 'hoc-tap', 'Kinh nghiệm học tập, tài liệu, hướng dẫn cho sinh viên CNTT'),
('Đời sống', 'doi-song', 'Chia sẻ kinh nghiệm, cuộc sống sinh viên tại ICTU'),
('Lập trình Web', 'lap-trinh-web', 'HTML, CSS, JavaScript, Node.js, React và các framework web');

-- ============================================================
-- DỮ LIỆU MẪU - POSTS
-- ============================================================
INSERT INTO posts (title, slug, content, status, category_id, author_id) VALUES
(
    'Giới thiệu đồ án Blog CMS - Triển khai với Docker',
    'gioi-thieu-do-an-blog-cms',
    'Xin chào! Tôi là Hoàng Duy Mạnh - sinh viên mã số DTC245200060, lớp CNTT K23B tại Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU).\n\nĐây là đồ án số 7 của môn Triển khai và Quản trị Hệ thống Phần mềm. Đồ án xây dựng một hệ thống Blog/CMS hoàn chỉnh được triển khai bằng Docker Compose với các thành phần:\n\n- Ứng dụng Web Blog (Node.js Express)\n- MySQL 8.0 + phpMyAdmin\n- Nginx Reverse Proxy với HTTPS & Security Headers\n- Prometheus + Grafana (Giám sát)\n- Loki + Promtail (Log tập trung)\n\nHệ thống được thiết kế với các biện pháp bảo mật (hardening) bao gồm: non-root container, network isolation, least privilege database, và quản lý mật khẩu qua biến môi trường.',
    'published', 2, 1
),
(
    'Hướng dẫn triển khai ứng dụng web với Docker Compose',
    'huong-dan-trien-khai-docker-compose',
    'Docker Compose là công cụ tuyệt vời để triển khai các ứng dụng multi-container. Trong bài viết này, tôi sẽ hướng dẫn cách:\n\n1. Viết Dockerfile cho ứng dụng Node.js\n2. Cấu hình docker-compose.yml với nhiều services\n3. Thiết lập network isolation giữa các container\n4. Sử dụng volumes để persist data\n5. Quản lý biến môi trường với file .env\n\nDocker Compose giúp đơn giản hóa việc quản lý và triển khai các hệ thống phức tạp chỉ với một lệnh duy nhất: docker compose up -d --build.',
    'published', 2, 1
),
(
    'Tầm quan trọng của bảo mật trong triển khai hệ thống',
    'tam-quan-trong-bao-mat-trien-khai',
    'Bảo mật (Security Hardening) là yếu tố không thể thiếu khi triển khai bất kỳ hệ thống phần mềm nào. Các biện pháp bảo mật cơ bản bao gồm:\n\n1. Non-root Container: Không chạy ứng dụng với quyền root để hạn chế rủi ro khi container bị tấn công.\n2. Network Isolation: Chia tách các mạng nội bộ để database không bị truy cập trực tiếp từ bên ngoài.\n3. HTTPS & Security Headers: Mã hóa dữ liệu truyền tải và thiết lập các header bảo mật.\n4. Least Privilege: Tài khoản database chỉ có quyền tối thiểu cần thiết.\n5. Quản lý mật khẩu: Sử dụng biến môi trường, không hardcode mật khẩu trong source code.',
    'published', 1, 1
),
(
    'Giám sát hệ thống với Prometheus và Grafana',
    'giam-sat-prometheus-grafana',
    'Prometheus và Grafana là bộ đôi phổ biến nhất trong việc giám sát hệ thống:\n\n- Prometheus: Thu thập metrics từ các target (exporters) theo mô hình pull-based.\n- Grafana: Trực quan hóa dữ liệu với các dashboard đẹp mắt và dễ tùy chỉnh.\n\nTrong đồ án này, Prometheus thu thập metrics từ:\n- cAdvisor: Metrics về container (CPU, RAM, Network)\n- mysqld-exporter: Metrics về MySQL database\n- nginx-exporter: Metrics về Nginx web server\n- App /metrics: Metrics tùy chỉnh từ ứng dụng Blog CMS',
    'published', 2, 1
),
(
    'Thu thập log tập trung với Loki và Promtail',
    'thu-thap-log-loki-promtail',
    'Grafana Loki là giải pháp log aggregation nhẹ và hiệu quả:\n\n- Loki: Lưu trữ và index log, hỗ trợ truy vấn bằng LogQL.\n- Promtail: Agent thu thập log từ các container và file log.\n\nMột số câu truy vấn LogQL hữu ích:\n- {container_name=\"blog-app\"}: Xem log từ ứng dụng Blog\n- {container_name=\"nginx\"} |= \"error\": Lọc log lỗi từ Nginx\n- rate({container_name=\"nginx\"}[5m]): Thống kê tần suất log\n- {container_name=\"mysql\"} |~ \"Warning|Error\": Lọc cảnh báo MySQL',
    'published', 2, 1
),
(
    'Kinh nghiệm học lập trình web cho sinh viên CNTT',
    'kinh-nghiem-hoc-lap-trinh-web',
    'Là sinh viên CNTT tại ICTU, tôi muốn chia sẻ một số kinh nghiệm học lập trình web:\n\n1. Nắm vững nền tảng HTML, CSS, JavaScript trước khi học framework\n2. Thực hành thường xuyên với các dự án nhỏ\n3. Học cách sử dụng Git để quản lý mã nguồn\n4. Tìm hiểu về Docker để triển khai ứng dụng\n5. Luôn cập nhật kiến thức về bảo mật web\n\nChúc các bạn sinh viên thành công trong quá trình học tập!',
    'published', 3, 1
),
(
    'Bản nháp: Kế hoạch phát triển Blog CMS v2.0',
    'ke-hoach-phat-trien-v2',
    'Đây là bản nháp kế hoạch cho phiên bản tiếp theo:\n\n- Thêm chức năng authentication/login\n- Tích hợp upload hình ảnh\n- Hỗ trợ Markdown editor\n- Thêm hệ thống comment\n- Tối ưu SEO\n- Responsive design cải tiến',
    'draft', 1, 1
);
