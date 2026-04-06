---
title: "Getting Started with Decap CMS: A Git-Based Headless CMS"
date: 2026-04-06T20:03:22+05:30
lastmod: 2026-04-06T20:03:22+05:30
draft: false
description: "Decap CMS gives your Hugo site a user-friendly editorial interface without a database or server. Learn how to configure it and let non-technical editors manage content through a browser."
author: "Admin"

# Taxonomy
categories: ["Tech"]
tags: ["decap cms", "hugo", "headless cms", "jamstack", "git"]

# Visuals
image: "https://images.unsplash.com/photo-1600267165477-6d4cc741b379?w=1200&fm=webp&q=80"
image_caption: "Photo by Compagnons"

# Features
toc: true
comments: true
---

Decap CMS is an open-source, git-based headless CMS that sits on top of your static site. Instead of a database, all content lives in your repository as Markdown files — but editors interact with a clean browser UI rather than raw text files.

<!--more-->

## What is Decap CMS?

Formerly known as Netlify CMS, Decap CMS was rebranded in 2023 after the project moved to independent governance. Its core proposition is simple:

- Content is stored as **Markdown files in Git** — no database, no lock-in
- Editors get a **visual admin interface** at `/admin`
- Developers configure everything via a single **`config.yml`** file
- Authentication is handled via **OAuth** (GitHub, GitLab, Bitbucket)

It's a natural fit for Hugo sites, since Hugo already reads Markdown from a `content/` folder.

## How It Works

```
Editor opens /admin
       ↓
Decap CMS loads (a single-page React app)
       ↓
Editor writes/edits content in the UI
       ↓
Decap commits the Markdown file to the Git repo
       ↓
CI/CD pipeline triggers (GitHub Actions, Netlify)
       ↓
Hugo rebuilds and deploys the updated site
```

The round-trip from hitting "Publish" to the change being live is typically under 60 seconds.

## Step 1 — Add the Admin Files

Create two files inside `static/admin/`:

**`static/admin/index.html`**
```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Manager</title>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
</body>
</html>
```

**`static/admin/config.yml`**
```yaml
backend:
  name: github
  repo: yourusername/your-repo
  branch: main

media_folder: content/posts
public_folder: /posts

collections:
  - name: posts
    label: Posts
    folder: content/posts
    create: true
    path: '{{slug}}/index'
    media_folder: images
    public_folder: images
    fields:
      - { label: Title,       name: title,       widget: string }
      - { label: Date,        name: date,        widget: datetime }
      - { label: Draft,       name: draft,       widget: boolean, default: true }
      - { label: Description, name: description, widget: text }
      - { label: Author,      name: author,      widget: string,  default: Admin }
      - { label: Categories,  name: categories,  widget: list,    default: [Tech] }
      - { label: Tags,        name: tags,        widget: list }
      - { label: Hero Image,  name: image,       widget: image,   required: false }
      - { label: Body,        name: body,        widget: markdown }
```

## Step 2 — Set Up OAuth (GitHub)

Decap CMS needs OAuth to authenticate editors against your Git provider.

1. Go to **GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App**
2. Set **Homepage URL** to your site URL
3. Set **Authorization callback URL** to `https://api.netlify.com/auth/done` (if using Netlify) or your own OAuth proxy
4. Copy the **Client ID** and **Client Secret**

If deploying on Netlify, enable **Identity** and **Git Gateway** in site settings — Netlify handles the OAuth proxy for you.

## Step 3 — Configure Hugo to Pass Through `/admin`

Since the admin files are in `static/`, Hugo copies them as-is to `public/admin/`. No extra configuration needed.

Verify the build output contains:
```
public/
  admin/
    index.html
    config.yml
```

## Accessing the CMS

Navigate to `https://yoursite.com/admin/` — you'll see the Decap CMS login screen. After authenticating with GitHub, you can create and edit posts directly in the browser.

## Conclusion

Decap CMS gives your Hugo site a professional editorial workflow without abandoning the JAMstack architecture. Content stays in Git, deployments stay automated, and non-technical editors never need to touch a terminal.

The combination of Hugo + Decap CMS + GitHub Pages (or Netlify) is one of the most cost-effective and maintainable publishing stacks available today.

---
**References:**
- [Decap CMS Documentation](https://decapcms.org/docs/)
- [Decap CMS — Hugo Integration Guide](https://decapcms.org/docs/hugo/)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

