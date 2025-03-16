// utils/youtube.js
import axios from 'axios';

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url) {
  if (!url) return null;
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^?&/#]+)/,
    /youtube\.com\/watch.*?[?&]v=([^?&/#]+)/,
    /youtube\.com\/shorts\/([^?&/#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get video title from YouTube video ID
 */
export async function getVideoTitle(url) {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Fetch the watch page to extract title
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Extract title from HTML
    const titleMatch = response.data.match(/<title>([^<]*)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      // Clean up title (remove " - YouTube" suffix)
      let title = titleMatch[1].replace(/\s*-\s*YouTube$/, '');
      return decodeHtmlEntities(title);
    }
    
    return 'Unknown Title';
  } catch (error) {
    console.error('Error fetching video title:', error);
    return 'Unknown Title';
  }
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text) {
  if (!text) return '';
  
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

/**
 * Get transcript directly from our internal API
 */
async function getTranscriptDirect(videoId) {
  try {
    console.log(`Getting transcript directly for video ID: ${videoId}`);
    
    // Call our internal API that wraps the YouTube transcript functionality
    const response = await axios.get(`/api/youtube-transcript?videoId=${videoId}`);
    
    console.log('Direct transcript API response:', response.status, response.statusText);
    
    if (!response.data || !response.data.success) {
      console.log('Direct transcript API failed with data:', response.data);
      throw new Error(response.data?.error || 'Failed to get transcript');
    }
    
    // Validate transcript content
    if (!response.data.transcript || response.data.transcript.trim().length < 10) {
      console.log('Direct API returned too short transcript:', response.data.transcript);
      throw new Error('Transcript is too short or empty');
    }
    
    console.log('Successfully retrieved transcript via direct API');
    return {
      transcript: response.data.transcript,
      language: response.data.language,
      success: true
    };
  } catch (error) {
    console.error('Direct transcript method failed with error:', error.message);
    throw error;
  }
}

/**
 * Get transcript from captions API
 */
async function getTranscriptFromCaptionsAPI(videoId) {
  try {
    console.log(`Getting transcript from captions API for video ID: ${videoId}`);
    
    // Try multiple language options in order of preference
    const languageCodes = ['en', 'en-US', 'en-GB', null, 'es', 'fr', 'de', 'auto'];
    
    for (const langCode of languageCodes) {
      try {
        const url = `/api/captions?videoId=${videoId}${langCode ? `&lang=${langCode}` : ''}`;
        console.log(`Trying captions API with language: ${langCode || 'default'}, URL: ${url}`);
        
        const response = await axios.get(url);
        console.log(`Captions API response for ${langCode || 'default'}:`, response.status);
        
        if (response.data && response.data.success && response.data.transcript) {
          if (response.data.transcript.trim().length < 10) {
            console.log('Captions API returned too short transcript for language', langCode);
            continue;
          }
          
          console.log(`Successfully retrieved transcript via captions API with language: ${langCode || 'default'}`);
          return {
            transcript: response.data.transcript,
            language: response.data.language || langCode || 'unknown',
            success: true
          };
        } else {
          console.log(`No valid transcript from captions API for language: ${langCode || 'default'}`);
        }
      } catch (err) {
        // Continue to the next language
        console.log(`Caption API failed for language ${langCode || 'default'}:`, err.message);
      }
    }
    
    throw new Error('No captions available from the captions API');
  } catch (error) {
    console.error('Captions API method failed:', error);
    throw error;
  }
}

/**
 * Get transcript from embedded player page
 */
async function getTranscriptFromEmbeddedPlayer(videoId) {
  try {
    console.log(`Getting transcript from embedded player for video ID: ${videoId}`);
    
    // First fetch the watch page instead of embed page (more reliable)
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching watch page: ${watchUrl}`);
    
    const response = await axios.get(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    
    // Look for timedtext endpoint
    const timedTextMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!timedTextMatch) {
      console.log('No caption tracks found in watch page');
      throw new Error('Could not find caption tracks');
    }
    
    try {
      // Parse the caption tracks data
      let captionData = timedTextMatch[1].replace(/\\"/g, '"');
      captionData = captionData.replace(/(\w+):/g, '"$1":');
      const captionTracks = JSON.parse(captionData);
      
      if (!captionTracks || captionTracks.length === 0) {
        console.log('No caption tracks in parsed data');
        throw new Error('No caption tracks found');
      }
      
      console.log(`Found ${captionTracks.length} caption tracks`);
      
      // Get the first available track (or English if available)
      const englishTrack = captionTracks.find(track => 
        track.languageCode === 'en' || track.languageCode === 'en-US' || track.languageCode === 'en-GB'
      );
      const track = englishTrack || captionTracks[0];
      
      if (!track || !track.baseUrl) {
        console.log('Selected track has no baseUrl:', track);
        throw new Error('No baseUrl found for caption track');
      }
      
      console.log(`Using caption track: ${track.languageCode}, name: ${track.name || 'unnamed'}`);
      
      // Fetch the actual captions data
      const captionsResponse = await axios.get(track.baseUrl);
      const xml = captionsResponse.data;
      
      // Parse the XML to get the transcript text
      const textMatches = xml.match(/<text[^>]*>(.*?)<\/text>/g) || [];
      if (textMatches.length === 0) {
        console.log('No text elements found in caption data');
        throw new Error('No text elements in captions');
      }
      
      console.log(`Found ${textMatches.length} text elements in caption data`);
      
      const transcript = textMatches
        .map(match => {
          // Extract content between tags
          let content = match.replace(/<text[^>]*>(.*?)<\/text>/, '$1');
          // Decode HTML entities
          content = decodeHtmlEntities(content);
          return content;
        })
        .filter(text => text.trim().length > 0)
        .join(' ');
      
      if (transcript.trim().length < 10) {
        console.log('Embedded player method returned too short transcript:', transcript);
        throw new Error('Transcript is too short or empty');
      }
      
      console.log('Successfully retrieved transcript via embedded player');
      return {
        transcript,
        language: track.languageCode || 'unknown',
        success: true
      };
    } catch (e) {
      console.error('Error parsing caption data:', e);
      throw new Error('Failed to parse caption data: ' + e.message);
    }
  } catch (error) {
    console.error('Embedded player method failed:', error);
    throw error;
  }
}

/**
 * Main function to get video transcript
 */
export async function getVideoTranscript(url) {
  try {
    console.log(`Retrieving transcript for URL: ${url}`);
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      return {
        url: url,
        success: false,
        error: 'Could not extract video ID from URL'
      };
    }
    
    const title = await getVideoTitle(url);
    console.log(`Got title: "${title}"`);
    
    let transcript = '';
    let language = 'unknown';
    let method = '';
    let success = false;
    
    // Try all methods in sequence
    const methods = [
      { name: 'Direct API', fn: getTranscriptDirect },
      { name: 'Captions API', fn: getTranscriptFromCaptionsAPI },
      { name: 'Embedded player', fn: getTranscriptFromEmbeddedPlayer }
    ];
    
    for (const methodObj of methods) {
      try {
        console.log(`Attempting method: ${methodObj.name}`);
        const result = await methodObj.fn(videoId);
        
        if (result.success && result.transcript && result.transcript.trim().length >= 10) {
          transcript = result.transcript;
          language = result.language;
          method = methodObj.name;
          success = true;
          console.log(`${methodObj.name} method succeeded`);
          break;
        } else {
          console.log(`${methodObj.name} method returned invalid result`);
        }
      } catch (error) {
        console.log(`${methodObj.name} method failed:`, error.message);
        // Continue to next method
      }
    }
    
    // Validate the transcript
    if (success) {
      // Check if transcript is empty or too short
      if (!transcript || transcript.trim().length < 10) {
        console.log('Retrieved transcript is empty or too short');
        return {
          video_id: videoId,
          title: title,
          url: url,
          success: false,
          error: 'Retrieved transcript is empty or too short'
        };
      }
      
      return {
        video_id: videoId,
        title: title,
        transcript: transcript,
        language: language,
        url: url,
        method: method,
        success: true
      };
    }
    
    // If all methods failed
    console.log('All transcript methods failed for video ID:', videoId);
    return {
      video_id: videoId,
      title: title,
      url: url,
      success: false,
      error: 'Could not retrieve transcript after trying multiple methods. The video may not have captions available.'
    };
  } catch (error) {
    console.error(`Error processing transcript for URL ${url}:`, error);
    
    return {
      url: url,
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}