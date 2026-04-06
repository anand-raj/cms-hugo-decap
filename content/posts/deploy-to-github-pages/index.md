---
title: "How to Deploy a Hugo Site to GitHub Pages"
date: 2026-04-06T20:03:22+05:30
lastmod: 2026-04-06T20:03:22+05:30
draft: false
description: "GitHub Pages offers free, reliable static site hosting directly from a repository. Learn how to deploy your Hugo site automatically using GitHub Actions in just a few steps."
author: "Admin"

# Taxonomy
categories: ["Tech"]
tags: ["hugo", "github pages", "deployment", "github actions", "jamstack"]

# Visuals
image: "https://images.unsplash.com/photo-1654277041218-84424c78f0ae?w=1200&fm=webp&q=80"
image_caption: "Photo by Rabaitul Azad on Unsplash"

# Features
toc: true
comments: true
---

GitHub Pages is one of the simplest and most cost-effective ways to host a static site. Combined with GitHub Actions, you can set up a fully automated pipeline that builds and deploys your Hugo site on every push to `main` — with zero server management.

<!--more-->

## Prerequisites

Before you start, make sure you have:

- A Hugo site in a GitHub repository
- Hugo Extended (for SCSS support)
- A `hugo.toml` with `baseURL` set to your GitHub Pages URL:

```toml
baseURL = 'https://yourusername.github.io/your-repo-name/'
```

## Step 1 — Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings → Pages**
3. Under **Source**, select **GitHub Actions**

This tells GitHub to expect a workflow to push the built site rather than serving directly from a branch.

## Step 2 — Create the GitHub Actions Workflow

Create the file `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy Hugo to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: 'latest'
          extended: true

      - name: Build
        run: hugo --minify

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Step 3 — Push and Verify

Commit and push the workflow file:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deployment workflow"
git push origin main
```

Go to **Actions** in your repository — you'll see the workflow running. Once it completes (usually under a minute), your site will be live at `https://yourusername.github.io/your-repo-name/`.

## How the Pipeline Works

```
Push to main
     ↓
GitHub Actions triggers
     ↓
Hugo Extended builds site → public/
     ↓
public/ uploaded as Pages artifact
     ↓
GitHub deploys artifact to CDN edge
     ↓
Site live at github.io URL
```

## Handling the Base URL

If your repo is named `yourusername.github.io` (a user/org site), your `baseURL` is simply `https://yourusername.github.io/`.

If it's a project repo (e.g. `my-blog`), the URL has a subdirectory: `https://yourusername.github.io/my-blog/`. Make sure Hugo's `baseURL` matches exactly, otherwise CSS and links will break.

## Conclusion

With GitHub Actions handling the build and deploy, your Hugo site publishes automatically on every commit. There's no build server to maintain, no deploy keys to rotate — just push and your site updates within seconds.

---
**References:**
- [Hugo Hosting on GitHub Pages](https://gohugo.io/hosting-and-deployment/hosting-on-github/)
- [GitHub Actions — actions/deploy-pages](https://github.com/actions/deploy-pages)
- [peaceiris/actions-hugo](https://github.com/peaceiris/actions-hugo)

