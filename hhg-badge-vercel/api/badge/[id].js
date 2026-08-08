const { list } = require('@vercel/blob');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async (req, res) => {
  const rawId = (req.query.id || '').toString();
  const id = rawId.replace(/[^a-f0-9]/gi, '');

  if (!id) {
    res.status(404).send('Badge not found.');
    return;
  }

  try {
    const { blobs } = await list({ prefix: `badges/${id}` });
    const match = blobs.find((b) => b.pathname === `badges/${id}.png`);

    if (!match) {
      res.status(404).send('Badge not found.');
      return;
    }

    const imageUrl = match.url;
    const nameParam = (req.query.name || '').toString().slice(0, 60);
    const displayName = nameParam ? escapeHtml(nameParam) : 'A hacker';
    const title = `${displayName} is building at Hacker House Goa`;
    const description = 'Get your own badge at Hacker House Goa \u2014 #FrameInGoa';

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const pageUrl = `${proto}://${host}/badge/${id}`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:width" content="1024">
<meta property="og:image:height" content="1536">
<meta property="og:url" content="${pageUrl}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${imageUrl}">

<style>
  body{margin:0;min-height:100vh;background:#0B1F1C;color:#F0E4C9;font-family:'JetBrains Mono',monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;text-align:center;}
  img{max-width:320px;width:100%;border-radius:18px;box-shadow:0 30px 60px -20px rgba(0,0,0,0.6);margin-bottom:24px;}
  a.btn{display:inline-block;margin-top:18px;background:#4FE3C1;color:#111512;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:9px;}
  p{color:rgba(240,228,201,0.7);font-size:14px;max-width:360px;}
</style>
</head>
<body>
  <img src="${imageUrl}" alt="Hacker House Goa badge for ${displayName}">
  <p>${escapeHtml(title)}</p>
  <a class="btn" href="/">Make your own badge \u2192</a>
</body>
</html>`);
  } catch (err) {
    console.error('Error rendering badge page:', err);
    res.status(500).send('Something went wrong.');
  }
};
