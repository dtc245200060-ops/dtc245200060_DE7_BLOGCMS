]
SSL_DIR="./nginx/ssl"

echo "============================================"
echo " Tạo chứng chỉ SSL tự ký (Self-signed)"
echo " Blog CMS - Hoàng Duy Mạnh - DTC245200060"
echo "============================================"

# Tạo thư mục SSL nếu chưa tồn tại
mkdir -p "$SSL_DIR"

# Kiểm tra xem chứng chỉ đã tồn tại chưa
if [ -f "$SSL_DIR/server.crt" ] && [ -f "$SSL_DIR/server.key" ]; then
    echo "⚠️  Chứng chỉ SSL đã tồn tại. Bỏ qua tạo mới."
    echo "   Nếu muốn tạo lại, hãy xóa các file trong $SSL_DIR"
    exit 0
fi

# Tạo chứng chỉ SSL tự ký (có hiệu lực 365 ngày)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/server.key" \
    -out "$SSL_DIR/server.crt" \
    -subj "/C=VN/ST=Thai Nguyen/L=Thai Nguyen/O=ICTU/OU=CNTT K23B/CN=localhost/emailAddress=dtc245200060@ictu.edu.vn"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Đã tạo chứng chỉ SSL tự ký thành công!"
    echo "   📄 Certificate: $SSL_DIR/server.crt"
    echo "   🔑 Private Key: $SSL_DIR/server.key"
    echo ""
    echo "   Thông tin chứng chỉ:"
    openssl x509 -in "$SSL_DIR/server.crt" -noout -subject -dates
else
    echo "❌ Lỗi khi tạo chứng chỉ SSL!"
    exit 1
fi
