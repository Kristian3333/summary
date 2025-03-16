// pages/api/video-info.js
import { extractVideoId, getVideoTitle } from '../../utils/youtube';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`Getting basic info for URL: ${url}`);
    
    // Validate URL format and extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid YouTube URL format',
        url: url
      });
    }
    
    // Get video title (this is fast and gives immediate feedback)
    const title = await getVideoTitle(videoId);
    
    // Return basic video information
    return res.status(200).json({
      success: true,
      videoId,
      title,
      url
    });
  } catch (error) {
    console.error('Error getting video info:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to get video info: ' + error.message,
      url: url 
    });
  }
}