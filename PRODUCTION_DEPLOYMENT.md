# 🚀 Production Deployment Guide

This guide covers deploying Musicky in production environments with security, performance, and reliability best practices.

## 📋 Prerequisites

- Node.js 18+ LTS
- Process manager (PM2 recommended)
- Reverse proxy (Nginx recommended)
- SSL certificate for HTTPS

## 🏗️ Build Process

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/abossard/musicky.git
cd musicky

# Install dependencies  
npm ci --omit=dev

# Set production environment
export NODE_ENV=production
```

### 2. Database Configuration

```bash
# Create production database
echo "DATABASE_URL=./database.sqlite" > .env

# Initialize database schema
npm run sqlite:migrate
```

### 3. Build Application

```bash
# Build for production
npm run build

# Verify build
ls -la dist/
```

## 🔧 Server Configuration

### PM2 Process Manager

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'musicky',
    script: './fastify-entry.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

Start the application:

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-restart on boot
pm2 startup
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/musicky`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/musicky /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Security Configuration

### File System Security

```bash
# Create dedicated user
sudo useradd -r -s /bin/false musicky

# Set ownership
sudo chown -R musicky:musicky /path/to/musicky

# Set permissions
sudo chmod 750 /path/to/musicky
sudo chmod 640 /path/to/musicky/.env
```

### Environment Variables

Create secure `.env` file:

```bash
# Database
DATABASE_URL=./database.sqlite

# Security
SESSION_SECRET=your-secure-random-string-here

# Limits
MAX_FILE_SIZE=100MB
MAX_SCAN_DEPTH=10

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 📊 Monitoring & Logging

### Application Monitoring

```bash
# Monitor with PM2
pm2 monit

# View logs
pm2 logs musicky

# Application metrics
pm2 info musicky
```

### Log Rotation

Create `/etc/logrotate.d/musicky`:

```
/path/to/musicky/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 musicky musicky
    postrotate
        pm2 reload musicky
    endscript
}
```

### Health Checks

Create monitoring script `scripts/health-check.js`:

```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Service healthy');
    process.exit(0);
  } else {
    console.log('❌ Service unhealthy');
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.log('❌ Service unavailable:', err.message);
  process.exit(1);
});

req.end();
```

## 🚀 Performance Optimization

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mp3_files_path ON mp3_files(file_path);
CREATE INDEX IF NOT EXISTS idx_pending_edits_file ON pending_edits(file_path);
CREATE INDEX IF NOT EXISTS idx_history_file ON mp3_history(file_path);
```

### Memory Management

```bash
# Monitor memory usage
pm2 show musicky

# Set memory limits in ecosystem.config.js
max_memory_restart: '500M'
```

### Cache Configuration

Enable application-level caching:

```javascript
// In your startup script
process.env.ENABLE_CACHE = 'true';
process.env.CACHE_TTL = '3600'; // 1 hour
```

## 🔄 Backup & Recovery

### Database Backup

```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/musicky"
DB_FILE="./database.sqlite"

mkdir -p $BACKUP_DIR
cp $DB_FILE "$BACKUP_DIR/database_$DATE.sqlite"

# Keep only last 30 backups
find $BACKUP_DIR -name "database_*.sqlite" -mtime +30 -delete
```

### Configuration Backup

```bash
# Backup essential configuration
tar -czf /backups/musicky-config-$(date +%Y%m%d).tar.gz \
  .env \
  ecosystem.config.js \
  /etc/nginx/sites-available/musicky
```

## 🔧 Maintenance

### Regular Updates

```bash
# Update dependencies
npm audit fix

# Rebuild application
npm run build

# Restart service
pm2 restart musicky
```

### Log Monitoring

```bash
# Monitor error logs
tail -f logs/err.log

# Check application health
curl -f http://localhost:3000/api/health || echo "Service down"
```

## 📈 Scaling Considerations

### Horizontal Scaling

- Use load balancer (HAProxy/Nginx)
- Shared database (PostgreSQL recommended)
- Centralized file storage (NFS/object storage)

### Vertical Scaling

- Increase PM2 instances based on CPU cores
- Optimize database queries and indexing
- Use Redis for session storage and caching

## 🚨 Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs
pm2 logs musicky --lines 100

# Verify environment
node --version
npm --version
```

**Database connection errors:**
```bash
# Check database file permissions
ls -la database.sqlite

# Test database connection
npm run sqlite:migrate
```

**File access permissions:**
```bash
# Check file system permissions
ls -la /path/to/music/files

# Verify user permissions
sudo -u musicky ls /path/to/music/files
```

### Emergency Recovery

```bash
# Stop service
pm2 stop musicky

# Restore from backup
cp /backups/musicky/database_latest.sqlite ./database.sqlite

# Restart service
pm2 start musicky

# Verify health
curl http://localhost:3000/api/health
```

---

## 📞 Support

For production deployment issues:

1. Check application logs: `pm2 logs musicky`
2. Verify system resources: `htop`, `df -h`
3. Test connectivity: `curl -I http://localhost:3000`
4. Review configuration files
5. Consult the troubleshooting section above

This production deployment ensures Musicky runs reliably, securely, and efficiently in enterprise environments.