# VALLEY CROWN — Production Static Fashion Store

Premium Kashmir-inspired multi-page fashion storefront built with HTML5, CSS3 and Vanilla JavaScript, backed by Supabase and using WhatsApp for order requests.

## Architecture

- No React / Next.js / TypeScript / Node backend / build step.
- Multi-page HTML with ES modules.
- Supabase JS is loaded from jsDelivr as an ES module.
- Supabase Database + Storage + Auth provide the backend.
- RLS is the security boundary for catalog, admin data and Storage.
- Cart and wishlist are intentionally guest/localStorage features.
- Customers do not create accounts and do not pay online.

## Local development

1. Open this folder in VS Code.
2. Install **Live Server** by Ritwick Dey.
3. Copy `js/config.example.js` to `js/config.js`.
4. Put your Supabase project URL and **publishable/anon key** in `js/config.js`.
5. Right-click `index.html` → **Open with Live Server**.
6. Do not use `file://`; ES modules and component loading need HTTP.

## Supabase production setup

1. Create/select the production Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. The SQL creates the tables, indexes, RLS policies and the public `products` Storage bucket.
4. Create the admin account in Supabase Authentication → Users.
5. Assign the admin role to that Auth user using a trusted Supabase admin workflow. The role must be in `raw_app_meta_data`, not `raw_user_meta_data`.
6. Use only the project URL and publishable/anon key in browser configuration. **Never use `service_role` or a secret key in `js/config.js`.**

### Admin role example

Run this only from a trusted SQL/admin environment, not from browser JavaScript:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'YOUR-ADMIN-EMAIL';
```

After changing app metadata, sign out and sign back in so the JWT contains the updated role.

## Vercel deployment

This project is intentionally a **static site**, so Vercel does not need a Node build command.

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Framework preset: **Other** (or static HTML if offered).
4. Build Command: leave empty.
5. Output Directory: `.`.
6. Deploy.
7. Set your final domain in `js/config.js`, sitemap.xml and canonical/OG metadata before launch.

### Important Vercel environment-variable limitation

Because this project has **no build step and no server-side runtime**, Vercel Environment Variables are not automatically injected into browser JavaScript files. A static HTML file cannot read `process.env` in the visitor's browser.

For this architecture, the correct production approach is:

- Keep only the **Supabase publishable/anon key** in `js/config.js`.
- Treat it as public client configuration.
- Protect all data with Supabase RLS.
- Never place a service-role/secret key in frontend code.

If you later decide to add a server-side Vercel Function, that function can use Vercel Environment Variables for secrets. That would be a different architecture from this strict static-site requirement.

## Security model

- Browser uses Supabase publishable/anon key only.
- Admin uses Supabase Auth.
- Admin authorization is checked with `app_metadata.role === 'admin'`.
- RLS protects every public-schema table.
- Product Storage is publicly readable but admin-write/admin-delete only.
- No passwords are stored in localStorage.
- No service-role key is included in the project.
- Frontend checks are convenience checks; RLS remains the real database authorization boundary.

## Supabase Storage

Bucket:

`products`

Recommended object paths:

`products/{product-id}/image-1.webp`
`products/{product-id}/image-2.webp`
`...
`products/{product-id}/image-8.webp`

The SQL includes public read + admin-only insert/update/delete policies.

## WhatsApp ordering

Business WhatsApp: `+91 77809 36702`.

The storefront generates a pre-filled WhatsApp order request. It does not claim that an order is confirmed. The business confirms availability and delivery details manually.

## Before launch checklist

- [ ] Configure `js/config.js` with the production Supabase URL + publishable/anon key.
- [ ] Run `supabase/schema.sql`.
- [ ] Create the admin Auth user.
- [ ] Assign `app_metadata.role = admin`.
- [ ] Test admin login/logout.
- [ ] Test RLS with an anonymous browser session.
- [ ] Upload and delete product images from the admin panel.
- [ ] Replace demo products/images with real catalog data.
- [ ] Confirm return/refund wording with the business.
- [ ] Replace `YOUR-VERCEL-DOMAIN.example` in SEO/config files.
- [ ] Update sitemap.xml and canonical URLs.
- [ ] Test WhatsApp ordering on Android, iOS and desktop.
- [ ] Test Chrome, Safari and Firefox.
- [ ] Verify no service-role/secret key exists in the repository.
- [ ] Check browser console for errors before launch.

## Project structure

```text
index.html
shop.html
product.html
category.html
cart.html
search.html
wishlist.html
about.html
contact.html
shipping.html
returns.html
privacy.html
terms.html
order-success.html
404.html
admin/
components/
css/
js/
assets/
supabase/schema.sql
robots.txt
sitemap.xml
vercel.json
README.md
.gitignore
```

## Production routing fix (Vercel)

This build intentionally does **not** use `cleanUrls: true`. Storefront links use the real `.html` files so Vercel serves them reliably, while `vercel.json` also contains rewrites for extensionless URLs such as `/shop` and `/admin/products`.

Important working fixes preserved in this package:
- `outputDirectory` is not present in `vercel.json`.
- `flowType: 'pkce'` is not present in `js/supabase.js`.
- `SITE_URL` is set to `https://valleycrown.vercel.app`.

If you already have live Supabase credentials in `js/config.js`, copy those two public values into this package before deployment. Never add a service-role/secret key to frontend JavaScript.
