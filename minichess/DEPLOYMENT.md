# Vercel Deployment Setup

This project is configured as a monorepo with the following structure:

```
minichess/
├── apps/
│   ├── web/          # Next.js frontend application
│   └── contracts/    # Smart contracts
├── package.json       # Root package.json with Next.js dependencies for Vercel detection
├── pnpm-workspace.yaml
└── vercel.json       # Vercel configuration
```

## Vercel Configuration

- **Root Directory**: `minichess/apps/web` (set in Vercel UI)
- **Install Command**: `npm install -g pnpm@8.10.0 && pnpm install --frozen-lockfile --ignore-scripts` (from vercel.json)
- **Build Command**: `pnpm run build --filter=web` (from vercel.json)

## Important Notes

1. The Next.js application is located in `apps/web/` directory
2. This is a pnpm workspace monorepo
3. Vercel's Root Directory setting should point to `minichess/apps/web`
4. Root package.json includes Next.js dependencies to help Vercel detect the framework
5. The vercel.json file contains simplified build and install commands

## Dependencies

- Next.js 14.0.0 is defined in both root `package.json` and `apps/web/package.json`
- The project uses pnpm for package management
- Workspace configuration is in `pnpm-workspace.yaml`

## Troubleshooting

If Vercel still can't detect Next.js:
1. Ensure Root Directory in Vercel UI is set to `minichess/apps/web`
2. Verify the root package.json contains Next.js in dependencies
3. Check that vercel.json has correct build and install commands
4. Make sure the deployment includes the root package.json file
5. If encountering React Native dependency conflicts, ensure pnpm is used with --ignore-scripts flag
6. The @react-native-async-storage package is only used in web app and handled by pnpm workspace