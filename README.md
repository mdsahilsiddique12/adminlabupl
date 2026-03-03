# Production-Grade License-Based Admin Portal System

A complete SaaS-grade Admin Portal with PostgreSQL, secure license-based activation, and desktop/web application integration.

## 🚀 Features

### Core System
- **Production-Ready Architecture**: Node.js + Express backend with React frontend
- **PostgreSQL Database**: Central license authority with UUID primary keys
- **RSA-Based License Signing**: 2048-bit encryption for tamper-proof licenses
- **Offline Desktop App Support**: Secure offline validation with periodic server sync
- **Role-Based Access Control (RBAC)**: Owner, Admin, and Staff roles with granular permissions

### License Management
- **Device Binding**: Automatic device fingerprinting and binding
- **Trial Prevention**: Email and IP-based trial duplication prevention
- **License Validation**: Real-time and offline validation with RSA signatures
- **Expiration Management**: Automatic license expiration and renewal
- **Suspension System**: Admin ability to suspend licenses for violations

### Security Features
- **HTTPS Enforcement**: Production SSL/TLS configuration
- **Rate Limiting**: Per-endpoint rate limiting to prevent abuse
- **Activity Logging**: Comprehensive audit trail for all actions
- **IP Blocking**: Dynamic IP blocking for security threats
- **Input Validation**: XSS and SQL injection prevention

### Admin Dashboard
- **KPI Dashboard**: Real-time metrics and system health monitoring
- **Interactive Charts**: Revenue trends and license distribution analytics
- **License CRUD**: Complete license management interface
- **User Management**: Role-based user administration
- **Device Monitoring**: Device tracking and blocking capabilities
- **Activity Logs**: Searchable audit logs with filters

### Enterprise Features
- **Docker Deployment**: Production-ready containerization
- **Nginx Reverse Proxy**: Load balancing and SSL termination
- **Redis Caching**: Session storage and performance optimization
- **Health Monitoring**: Service health checks and uptime monitoring
- **Multi-Tenant Ready**: Scalable architecture for enterprise deployment

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Prisma ORM** - Database ORM
- **PostgreSQL** - Primary database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **RSA Cryptography** - License signing and validation

### Frontend
- **React** - UI framework
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **ShadCN UI** - Component library
- **Recharts** - Data visualization
- **TanStack Query** - Data fetching and caching

### Infrastructure
- **Docker** - Containerization
- **Nginx** - Reverse proxy and load balancer
- **Redis** - Caching and session storage
- **HTTPS** - SSL/TLS encryption

## 📋 System Requirements

- Node.js 18+
- PostgreSQL 12+
- Docker & Docker Compose
- Redis (optional but recommended)

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd Admin-License-Portal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Configure your environment
# - DATABASE_URL: PostgreSQL connection string
# - JWT_SECRET: JWT signing secret
# - RSA_PRIVATE_KEY_PATH: Path to RSA private key
# - RSA_PUBLIC_KEY_PATH: Path to RSA public key
# - ALLOWED_ORIGINS: CORS allowed origins
```

### 2. Database Setup

```bash
# Run database migrations
npm run db:push

# Seed initial data (admin user, plans, etc.)
# This happens automatically on first run
```

### 3. Development

```bash
# Start development server
npm run dev

# Frontend: http://localhost:5173
# Backend API: http://localhost:5000
# Admin Dashboard: http://localhost:5173/dashboard
```

### 4. Production Deployment

```bash
# Build the application
npm run build

# Start with Docker Compose
docker-compose up -d

# Access the application
# Admin Dashboard: https://your-domain.com
# API: https://your-domain.com/api
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/license_portal"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
ALLOWED_ORIGINS="https://your-frontend.com,https://admin.your-frontend.com"

# RSA Keys
RSA_PRIVATE_KEY_PATH="./keys/private.pem"
RSA_PUBLIC_KEY_PATH="./keys/public.pem"

# Security
REDIS_URL="redis://localhost:6379"
LOG_LEVEL="info"

# Desktop App
DESKTOP_ENCRYPTION_KEY="your-desktop-encryption-key"
```

### Docker Configuration

The system includes a complete Docker setup with:

- **Multi-stage builds** for optimized production images
- **Health checks** for service monitoring
- **Volume persistence** for data and logs
- **Network isolation** for security
- **SSL/TLS termination** with Nginx

## 📊 Database Schema

The system uses PostgreSQL with the following core tables:

### Users
- UUID primary key
- Role-based access (Owner, Admin, Staff)
- Email and username authentication

### Plans
- Subscription plan definitions
- Pricing and duration configuration
- Feature sets per plan

### Licenses
- RSA-signed license keys
- Device binding and expiration
- Status tracking (Active, Expired, Suspended, Pending)

### Devices
- Device fingerprinting
- IP address and user agent tracking
- First/last seen timestamps

### Activity Logs
- Comprehensive audit trail
- User action tracking
- Security event logging

## 🔐 License System

### License Creation
```typescript
// Create a new license
const license = await licenseService.createLicense(
  userId,
  planId,
  deviceFingerprint,
  expiresAt
);
```

### License Validation
```typescript
// Validate license (online)
const result = await licenseService.validateLicense(
  licenseKey,
  deviceFingerprint,
  ipAddress,
  userAgent
);

// Validate license (offline)
const result = desktopService.validateOfflineLicense({
  licenseKey,
  deviceFingerprint,
  timestamp,
  signature
});
```

### Trial Management
```typescript
// Check trial eligibility
const eligible = await licenseService.checkTrialEligibility(
  email,
  ipAddress
);

// Create trial license
const licenseKey = await licenseService.createTrialLicense(
  userId,
  ipAddress
);
```

## 🌐 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/me` - Get current user

### License Management
- `GET /api/licenses` - List licenses
- `POST /api/licenses` - Create license
- `POST /api/licenses/validate` - Validate license
- `POST /api/licenses/activate` - Activate license
- `POST /api/licenses/trial` - Create trial license

### Admin Endpoints
- `GET /api/licenses/stats` - License statistics
- `POST /api/security/block-ip` - Block IP address
- `POST /api/security/unblock-ip` - Unblock IP address

### Desktop Integration
- `GET /api/desktop/offline-package/:key` - Get offline validation package
- `POST /api/desktop/check-updates` - Check for license updates
- `POST /api/desktop/tampering-report` - Report tampering

## 🎨 Admin Dashboard

The admin dashboard provides:

### Overview
- **KPI Cards**: Active licenses, revenue, users, expired licenses
- **System Health**: Service status and performance metrics
- **Recent Activity**: Latest system events and user actions

### Analytics
- **License Distribution**: Pie charts showing license status breakdown
- **Revenue Trends**: Line charts for monthly revenue tracking
- **Activation Trends**: Area charts for license activation patterns

### Management
- **License CRUD**: Create, read, update, delete licenses
- **User Management**: Add, edit, delete users with role assignment
- **Plan Management**: Configure subscription plans and pricing
- **Device Monitoring**: View and block devices
- **Activity Logs**: Search and filter audit logs

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Secure password hashing with bcrypt

### Rate Limiting
- Authentication endpoints: 5 requests per 15 minutes
- General API: 100 requests per 15 minutes
- License activation: 3 requests per hour

### Input Validation
- Zod schema validation for all inputs
- XSS and SQL injection prevention
- Content Security Policy (CSP) headers

### Data Protection
- RSA 2048-bit encryption for license signing
- Encrypted offline license storage
- Secure session management with Redis

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   - Set secure JWT secret
   - Configure database connection
   - Set up RSA key paths
   - Configure allowed origins

2. **SSL/TLS**
   - Obtain SSL certificates
   - Configure Nginx for HTTPS
   - Enable HSTS headers

3. **Database**
   - Set up production PostgreSQL
   - Configure backups
   - Set up monitoring

4. **Monitoring**
   - Configure health checks
   - Set up logging aggregation
   - Monitor resource usage

5. **Security**
   - Enable firewall rules
   - Configure IP blocking
   - Set up intrusion detection

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Monitor logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale app=3

# Update deployment
docker-compose pull && docker-compose up -d
```

## 🧪 Testing

### Unit Tests
```bash
# Run backend tests
npm test

# Run frontend tests
npm run test:frontend
```

### Integration Tests
```bash
# Test license validation
npm run test:licenses

# Test API endpoints
npm run test:api
```

### Security Tests
```bash
# Run security audit
npm audit

# Check for vulnerabilities
npm run security:scan
```

## 📈 Monitoring

### Health Checks
- `/health` - Application health endpoint
- Database connectivity checks
- Service dependency validation

### Metrics
- License activation rates
- Revenue tracking
- User activity patterns
- System performance metrics

### Logging
- Structured JSON logging
- Error tracking and alerting
- Audit trail for compliance

## 🔧 Development

### Code Structure

```
├── server/                 # Backend services
│   ├── routes.ts          # API endpoints
│   ├── services/          # Business logic
│   ├── middleware/        # Security and auth
│   └── utils/            # Utilities
├── client/                # Frontend application
│   ├── pages/            # Page components
│   ├── components/       # Reusable components
│   ├── hooks/            # Custom hooks
│   └── services/         # API clients
├── shared/               # Shared types and schemas
├── prisma/               # Database schema
└── docker/              # Docker configuration
```

### Adding New Features

1. **Database Changes**
   - Update Prisma schema
   - Run migrations
   - Update types

2. **API Endpoints**
   - Add route in `server/routes.ts`
   - Implement service logic
   - Add validation schemas

3. **Frontend Components**
   - Create React components
   - Add API hooks
   - Update routing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

## 🔗 Related Projects

- [Desktop License Client](https://github.com/example/desktop-license-client)
- [Mobile License SDK](https://github.com/example/mobile-license-sdk)
- [License Analytics Dashboard](https://github.com/example/license-analytics)

---

**Built with ❤️ for enterprise license management**