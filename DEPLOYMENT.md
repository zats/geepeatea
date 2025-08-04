# GitHub Pages Deployment Guide

This Next.js application is configured for deployment to GitHub Pages with automatic builds via GitHub Actions.

## Prerequisites

1. **GitHub Repository**: Make sure your code is pushed to a GitHub repository
2. **GitHub Pages Setup**: Enable GitHub Pages in your repository settings
3. **Environment Variables**: Configure any required environment variables as repository secrets

## Configuration

The application has been configured with:

- **Static Export**: `output: 'export'` in `next.config.mjs`
- **Asset Optimization**: Images are unoptimized for static hosting
- **Path Configuration**: Proper `basePath` and `assetPrefix` for GitHub Pages
- **GitHub Actions**: Automated deployment workflow

## Deployment Steps

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the configuration

### 2. Set Up Environment Variables (if needed)

If your app requires environment variables (like API keys):

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add repository secrets for any environment variables
3. Update the GitHub Actions workflow to include these variables

### 3. Push Your Code

```bash
git add .
git commit -m "Configure for GitHub Pages deployment"
git push origin main
```

### 4. Monitor Deployment

1. Go to the **Actions** tab in your repository
2. Watch the deployment workflow run
3. Once complete, your site will be available at: `https://[username].github.io/[repository-name]`

## Important Notes

### API Routes Limitation

⚠️ **Static sites cannot run server-side API routes.** This app includes API routes that will not work on GitHub Pages. Options:

1. **Remove API Dependencies**: Modify the app to work without server-side APIs
2. **Use External APIs**: Replace local API routes with external services
3. **Deploy to Vercel/Netlify**: Use platforms that support full Next.js features

### Local Development vs Production

- **Development**: Run `pnpm dev` - all features work
- **Production Build**: Run `pnpm build` - static export without API routes
- **GitHub Pages**: Automatically deploys static build on push to main

## Troubleshooting

### Build Failures
- Check the Actions tab for error logs
- Ensure all dependencies are properly installed
- Verify that the build works locally with `pnpm build`

### Site Not Loading
- Check that GitHub Pages is enabled
- Verify the correct branch is selected
- Ensure `.nojekyll` file exists in the `public` directory

### Assets Not Loading
- Check that `basePath` and `assetPrefix` are correctly configured
- Verify relative paths in your code don't conflict with the base path

## Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Build the static site
pnpm build

# The output will be in the 'out' directory
# Upload the contents of 'out' to any static hosting service
```

## Repository Structure

```
.github/
  workflows/
    deploy.yml          # GitHub Actions deployment workflow
public/
  .nojekyll            # Prevents Jekyll processing
  assets/              # Static assets
next.config.mjs        # Next.js configuration for static export
package.json           # Includes 'export' script
```