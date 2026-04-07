---
title: Cloudfare Workers
date: 2026-04-07T18:24:00+05:30
lastmod: 2026-04-07T18:24:00+05:30
draft: true
description: ''
author: Admin
categories:
  - Tech
tags: []
image: https://images.unsplash.com/photo-1569428034239-f9565e32e224?w=1200&fm=webp&q=80
image_caption: ''
toc: true
comments: true
---

[Cloudflare Workers](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html) is a serverless execution environment that lets you run JavaScript at the edge — on Cloudflare's global network of 300+ data centres — without managing any servers.

For JAMstack sites, Workers fill the one gap that pure static hosting can't: server-side logic. OAuth proxies, API middleware, redirects, and edge caching are all natural fits.

## How Cloudflare Workers Work

Unlike traditional serverless functions (AWS Lambda, Google Cloud Functions) that run in a single region, Workers run at the edge node **closest to the user**:

```plain
User in Mumbai
      ↓
Request hits Cloudflare edge in Mumbai (not US-East-1)
      ↓
Worker executes in < 1ms cold start
      ↓
Response returned from the same edge node
```

Workers use the **V8 isolate model** — the same engine as Chrome — rather than spinning up a container. This gives them near-zero cold start times compared to traditional serverless functions.

## The Free Tier

Cloudflare Workers' free tier is generous enough for most side projects:

| Limit | Free tier |
| --- | --- |
| Requests | 100,000 / day |
| CPU time | 10ms per request |
| Workers | Unlimited |
| Custom domains | 1 |
| Cron triggers | 5 |

For an OAuth proxy like the one powering this site's CMS, 100,000 requests/day is effectively unlimited — CMS logins are infrequent.

## A Real-World Example: OAuth Proxy

This site uses a Cloudflare Worker as an OAuth proxy for [Sveltia CMS](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html). The browser can't hold a GitHub OAuth client secret safely, so the Worker handles the token exchange server-side:

```plain
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);


    if (pathname === '/auth') {
      // Redirect to GitHub OAuth
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        scope: 'repo,user',
      });
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`
      );
    }


    if (pathname === '/callback') {
      // Exchange code for token
      const { code } = Object.fromEntries(new URL(request.url).searchParams);
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: JSON.stringify({
          code,
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
        }),
      });
      const { access_token } = await res.json();
      // Return token to the CMS via postMessage
    }
  },
};
```

The client secret lives in **Cloudflare's encrypted environment variables** — never exposed to the browser.

## Deploying a Worker

The simplest way is directly in the Cloudflare dashboard:

1. Go to **Workers & Pages → Create → Create Worker**
2. Paste your JavaScript into the editor
3. Click **Deploy**
4. Add secrets under **Settings → Variables**

No CLI, no build step, no `package.json` required for simple workers.

## When to Use Workers vs. Other Options

| Use case | Best option |
| --- | --- |
| OAuth proxy | Cloudflare Worker |
| Full API backend | Cloudflare Workers + D1 (SQLite) |
| Image resizing | Cloudflare Images or Hugo Pipes |
| Form handling | Netlify Forms or Formspree |
| Scheduled jobs | Workers Cron Triggers |

## Conclusion

Cloudflare Workers bring server-side capabilities to a fully static JAMstack site with zero infrastructure to manage. The free tier covers virtually any low-traffic use case, and the edge-first architecture means your logic runs as close to the user as possible.

For Hugo sites specifically, pairing Workers with GitHub Actions and GitHub Pages gives you a complete, zero-cost publishing platform with a proper editorial CMS.

***

**References:**

- [Cloudflare Workers Documentation](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)
- [Workers Pricing & Limits](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)
- [sveltia-cms-auth Worker](vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html)
