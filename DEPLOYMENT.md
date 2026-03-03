# Free Deployment Guide

This guide shows how to deploy the License Portal completely for free using modern cloud services.

## Option 1: Frontend on Netlify + Backend on Railway (Recommended)

### Frontend Deployment (Netlify - Free)

1. **Build the frontend:**
```bash
cd client
npm run build
```

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Sign up for free
   - Drag and drop the `client/dist` folder to deploy
   - Or connect your GitHub repository for automatic deployments

3. **Set environment variables in Netlify:**
   - Go to Site Settings → Environment Variables
   - Add: `VITE_API_URL=https://your-backend-url.com`

### Backend Deployment (Railway - Free)

1. **Deploy to Railway:**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Set environment variables in Railway:**
   - Go to Settings → Variables
   - Add these variables:
     ```
     DATABASE_URL=postgresql://user:pass@host:port/db
     JWT_SECRET=your-super-secret-jwt-key
     RSA_PRIVATE_KEY_PATH=./keys/private.pem
     RSA_PUBLIC_KEY_PATH=./keys/public.pem
     ALLOWED_ORIGINS=https://your-netlify-site.netlify.app
     NODE_ENV=production
     PORT=3000
     ```

3. **Set up PostgreSQL database:**
   - In Railway, add a PostgreSQL service
   - It will automatically set the DATABASE_URL

4. **Run database migrations:**
   - In Railway console, run: `npm run db:push`

### Connect Frontend to Backend
Update your frontend environment to point to the Railway backend URL.

## Option 2: Full Stack on Vercel (Alternative)

### Deploy to Vercel:

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
vercel
```

3. **Set environment variables in Vercel dashboard:**
   - Same variables as Railway
   - Add a PostgreSQL database (Vercel has partnerships with Supabase, Neon, etc.)

## Option 3: Railway Only (Full Application)

### Deploy entire application to Railway:

1. **Modify package.json for Railway:**
```json
{
  "scripts": {
    "start": "node server/index.js",
    "build": "npm run build:client && npm run build:server",
    "build:client": "cd client && npm run build",
    "build:server": "tsc"
  }
}
```

2. **Create railway.json:**
```json
{
  "build": {
    "install": "npm install",
    "build": "npm run build"
  },
  "run": "npm start"
}
```

3. **Deploy:**
   - Connect your GitHub repo to Railway
   - It will automatically detect and deploy

## Free Database Options

### Railway PostgreSQL (Recommended)
- Free tier available
- Automatic setup
- Included in Railway deployment

### Supabase (Alternative)
- Free PostgreSQL with additional features
- Easy integration
- Dashboard for database management

### Neon (Alternative)
- Serverless PostgreSQL
- Free tier with generous limits
- Excellent performance

## Cost Breakdown

### Option 1 (Netlify + Railway):
- **Netlify**: Free (up to 100GB bandwidth/month)
- **Railway**: Free (up to $5/month credit, usually enough for small apps)
- **PostgreSQL**: Free (Railway includes free database)

### Option 2 (Vercel):
- **Vercel**: Free (up to 100GB bandwidth/month)
- **Database**: Free (Supabase/Neon free tiers)

### Option 3 (Railway only):
- **Railway**: Free (up to $5/month credit)
- **PostgreSQL**: Free (included)

## Environment Variables Template

Create a `.env` file with these variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/license_portal"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
ALLOWED_ORIGINS="https://your-frontend-url.netlify.app"

# RSA Keys (will be auto-generated)
RSA_PRIVATE_KEY_PATH="./keys/private.pem"
RSA_PUBLIC_KEY_PATH="./keys/public.pem"

# Security
LOG_LEVEL="info"
NODE_ENV="production"
PORT="3000"
```

## Post-Deployment Steps

1. **Access your application:**
   - Frontend: `https://your-site.netlify.app`
   - Backend API: `https://your-backend.railway.app`

2. **Initial setup:**
   - Visit the frontend URL
   - Login with default admin credentials (created automatically)
   - Configure your license plans and settings

3. **Monitor your deployment:**
   - Railway dashboard for backend monitoring
   - Netlify dashboard for frontend monitoring

## Troubleshooting

### Common Issues:

1. **CORS errors:**
   - Ensure ALLOWED_ORIGINS includes your frontend URL
   - Check both frontend and backend are using HTTPS

2. **Database connection:**
   - Verify DATABASE_URL is correct
   - Run migrations: `npm run db:push`

3. **Environment variables:**
   - Ensure all required variables are set
   - Restart services after changing variables

4. **Build failures:**
   - Check logs in Railway/Vercel dashboard
   - Ensure all dependencies are in package.json

## Free Tier Limits

### Netlify:
- 100GB bandwidth/month
- 300 build minutes/month
- 1000 form submissions/month

### Railway:
- $5/month credit (usually sufficient for small apps)
- 512MB RAM per service
- 1GB storage per service

### Vercel:
- 100GB bandwidth/month
- 1250 build minutes/month
- 100GB storage

For a license portal with moderate usage, these free tiers should be more than sufficient.

## Production Recommendations

1. **Upgrade when needed:**
   - Monitor usage in dashboard
   - Upgrade to paid plans as traffic grows

2. **Backup strategy:**
   - Enable automatic database backups
   - Regularly export configuration

3. **Monitoring:**
   - Set up uptime monitoring
   - Monitor API response times
   - Track license activation rates

This deployment strategy gives you a completely free, production-ready license portal that can scale as your needs grow!