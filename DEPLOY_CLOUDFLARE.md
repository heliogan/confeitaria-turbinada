# Deploy via Cloudflare Pages

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git.
2. Select repository `heliogan/confeitaria-turbinada` and branch `main`.
3. Set framework preset `None`, leave build command blank, set output directory to `public`.
4. Deploy after the application files are pushed to `public/`.

This app uses local IndexedDB and JSON backup. A Cloudflare Pages URL is public unless access protection is configured. HTTPS is required to test installation and offline behavior on phones.
