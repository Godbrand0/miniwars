# Vercel Deployment Setup

This project is configured as a monorepo with the following structure:

```
minichess/
├── apps/
│   ├── web/          # Next.js frontend application
│   └── contracts/    # Smart contracts
├── package.json       # Root package.json (workspace config)
├── pnpm-workspace.yaml
└── vercel.json       # Vercel configuration
```

## Vercel Configuration

- **Root Directory**: `minichess/apps/web`
- **Install Command**: `npm install -g pnpm@8.10.0 && pnpm install --frozen-lockfile`
- **Build Command**: `pnpm run build --filter=web`

## Important Notes

1. The Next.js application is located in `apps/web/` directory
2. This is a pnpm workspace monorepo
3. Vercel's Root Directory setting should point to `minichess/apps/web`
4. The vercel.json file contains the build and install commands for the monorepo structure

## Dependencies

- Next.js 14.0.0 is defined in `apps/web/package.json`
- The project uses pnpm for package management
- Workspace configuration is in `pnpm-workspace.yaml`