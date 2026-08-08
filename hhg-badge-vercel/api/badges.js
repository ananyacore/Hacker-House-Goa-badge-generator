const { put } = require('@vercel/blob');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { imageDataUrl } = req.body || {};

    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/png;base64,')) {
      res.status(400).json({ error: 'imageDataUrl must be a base64 PNG data URL' });
      return;
    }

    const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > 8 * 1024 * 1024) {
      res.status(413).json({ error: 'Image too large' });
      return;
    }

    const id = crypto.randomBytes(5).toString('hex');

    // addRandomSuffix: false keeps the pathname predictable so /api/badge/[id]
    // can look it up later with list({ prefix: ... }).
    const blob = await put(`badges/${id}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false
    });

    res.status(200).json({ id, imageUrl: blob.url, shareUrl: `/badge/${id}` });
  } catch (err) {
    console.error('Error saving badge:', err);
    res.status(500).json({ error: 'Failed to save badge' });
  }
};
