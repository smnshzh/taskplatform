# TaskPlatform

A multi-solution company platform built with Next.js, TypeScript, Prisma, and PostgreSQL.

## Overview

TaskPlatform is the task solution inside a broader company platform. Each company creates an account, selects a solution, and works inside its own workspace.

## Features

- Company signup and solution selection
- Tenant-aware account structure
- Task creation and assignment
- Task status tracking
- Team and department management
- Dashboard and reporting
- Responsive user interface
- Cloud deployment support

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Deployment

- Vercel for managed deployment
- PM2 and standalone server support for VPS deployments
- Prisma migrations for database changes

## Repository

https://github.com/smnshzh/taskplatform

## Installation

```bash
git clone https://github.com/smnshzh/taskplatform.git
cd taskplatform
npm install
```

Create a `.env` file:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/taskplatform"
SESSION_SECRET="replace-with-a-random-secret"
APP_BASE_URL="http://localhost:8502"
APP_TIMEZONE="Asia/Tehran"
PORT="8502"
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Start development server:

```bash
npm run dev
```

## Use Cases

- Company onboarding
- Multi-solution SaaS delivery
- Task operations
- Project tracking
- Workflow automation
- Internal collaboration

## Security

- Authentication and authorization
- Role-based permissions
- Protected API routes
- Secure database access

## Future Improvements

- Email notifications
- Mobile application
- Advanced analytics
- Workflow automation
- Calendar integration
- Real-time updates

## License

Developed by smnshzh
