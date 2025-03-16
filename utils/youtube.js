// utils/youtube.js
import axios from 'axios';

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url) {
  if (!url) return null;
  
  try {
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
    
    // Try parsing URL object if it's a valid URL
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId;
      }
    } catch (e) {
      // Not a valid URL, continue with other approaches
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting video ID:', error);
    return null;
  }
}

/**
 * Get video title from YouTube video ID
 */
export async function getVideoTitle(videoId) {
  try {
    if (!videoId) {
      throw new Error('Invalid video ID');
    }
    
    // Try using oEmbed API first (this is more reliable)
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await axios.get(oembedUrl, { timeout: 5000 });
      
      if (response.data && response.data.title) {
        return response.data.title;
      }
    } catch (e) {
      console.log('oEmbed method failed, trying alternative');
    }
    
    // Fallback: Fetch the watch page to extract title
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 5000
    });
    
    // Extract title from HTML
    const titleMatch = response.data.match(/<title>([^<]*)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      // Clean up title (remove " - YouTube" suffix)
      let title = titleMatch[1].replace(/\s*-\s*YouTube$/, '');
      return decodeHtmlEntities(title);
    }
    
    // Another approach: look for meta tags
    const metaTitleMatch = response.data.match(/<meta\s+name="title"\s+content="([^"]+)"/);
    if (metaTitleMatch && metaTitleMatch[1]) {
      return decodeHtmlEntities(metaTitleMatch[1]);
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
  
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'"
  };
  
  let decoded = text;
  
  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Replace numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  
  return decoded;
}

/**
 * Method 1: Get transcript using YouTube's timedtext API
 */
async function getTranscriptFromTimedTextAPI(videoId) {
  try {
    console.log(`Getting transcript from timedtext API for video ID: ${videoId}`);
    
    // Language options to try
    const languages = ['en', 'en-US', 'en-GB', null, 'auto', 'es', 'fr', 'de'];
    
    for (const lang of languages) {
      try {
        // First, try to get the list of available transcripts
        const trackListUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
        const trackListResponse = await axios.get(trackListUrl, { timeout: 5000 });
        
        // Check if the response contains any tracks
        if (!trackListResponse.data.includes('<track')) {
          console.log('No transcript tracks found');
          continue;
        }
        
        // Parse the tracks XML
        const tracks = parseTracksXml(trackListResponse.data);
        console.log(`Found ${tracks.length} transcript tracks`);
        
        if (tracks.length === 0) {
          console.log('No valid tracks found after parsing');
          continue;
        }
        
        // Select the appropriate track based on language
        let selectedTrack = null;
        
        if (lang) {
          // Look for exact language match
          selectedTrack = tracks.find(track => 
            track.lang_code === lang || 
            track.lang_code === lang.toLowerCase() ||
            track.lang_code.startsWith(lang + '-')
          );
          
          // For 'auto', look for auto-generated tracks
          if (!selectedTrack && lang === 'auto') {
            selectedTrack = tracks.find(track => 
              track.name.includes('auto-generated') || 
              track.name.includes('automatic')
            );
          }
        }
        
        // If no matching track, use first available
        if (!selectedTrack) {
          // Prioritize English tracks
          selectedTrack = tracks.find(track => 
            track.lang_code === 'en' || 
            track.lang_code === 'en-US' || 
            track.lang_code === 'en-GB'
          );
          
          // If still no match, use first track
          if (!selectedTrack) {
            selectedTrack = tracks[0];
          }
        }
        
        console.log(`Selected track: ${selectedTrack.lang_code}, ${selectedTrack.name}`);
        
        // Try to get transcript in JSON3 format first
        try {
          const json3Url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${selectedTrack.lang_code}&fmt=json3`;
          const json3Response = await axios.get(json3Url, { timeout: 5000 });
          
          if (json3Response.data && json3Response.data.events) {
            const transcript = json3Response.data.events
              .filter(event => event.segs && event.segs.length > 0)
              .map(event => 
                event.segs
                  .map(seg => seg.utf8 || '')
                  .join(' ')
              )
              .join(' ');
            
            if (transcript.trim().length > 20) {
              return {
                success: true,
                transcript,
                language: selectedTrack.lang_code
              };
            }
          }
        } catch (error) {
          console.log('JSON3 format failed, trying XML format');
        }
        
        // Fallback to XML format
        const captionsUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${selectedTrack.lang_code}`;
        const xmlResponse = await axios.get(captionsUrl, { timeout: 5000 });
        
        if (xmlResponse.data) {
          const transcript = parseTranscriptXml(xmlResponse.data);
          
          if (transcript.trim().length > 20) {
            return {
              success: true,
              transcript,
              language: selectedTrack.lang_code
            };
          }
        }
      } catch (error) {
        console.log(`Failed with language ${lang || 'default'}:`, error.message);
        // Continue to next language
      }
    }
    
    throw new Error('Could not retrieve transcript from timedtext API');
  } catch (error) {
    console.error('Timedtext API method failed:', error);
    throw error;
  }
}

/**
 * Method 2: Get transcript from YouTube's data in the watch page
 */
async function getTranscriptFromWatchPage(videoId) {
  try {
    console.log(`Getting transcript from watch page for video ID: ${videoId}`);
    
    // Fetch the watch page
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await axios.get(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });
    
    const html = response.data;
    
    // Try to find caption tracks in the initial data
    const captionTracksRegex = /"captionTracks":\s*(\[.*?\])/;
    const captionTracksMatch = html.match(captionTracksRegex);
    
    if (!captionTracksMatch) {
      console.log('No caption tracks found in watch page');
      throw new Error('No caption tracks found');
    }
    
    try {
      // Clean up the JSON string
      let captionTracksJson = captionTracksMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0026/g, '&')
        .replace(/\\r\\n|\\\n|\\\r/g, '')
        .replace(/\\\//g, '/');
      
      // Convert to valid JSON by adding quotes to keys
      captionTracksJson = captionTracksJson.replace(/([{,])\s*(\w+):/g, '$1"$2":');
      
      // Parse the JSON
      const captionTracks = JSON.parse(captionTracksJson);
      
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No caption tracks found in parsed data');
      }
      
      console.log(`Found ${captionTracks.length} caption tracks`);
      
      // Find English tracks or use the first one
      const englishTrack = captionTracks.find(track => 
        track.languageCode === 'en' || 
        track.languageCode === 'en-US' || 
        track.languageCode === 'en-GB'
      );
      
      const selectedTrack = englishTrack || captionTracks[0];
      const trackUrl = selectedTrack.baseUrl;
      
      if (!trackUrl) {
        throw new Error('No baseUrl found for selected track');
      }
      
      // Fetch the transcript
      const transcriptResponse = await axios.get(trackUrl, { timeout: 5000 });
      
      if (!transcriptResponse.data) {
        throw new Error('Empty transcript response');
      }
      
      // Parse the XML transcript
      const transcript = parseTranscriptXml(transcriptResponse.data);
      
      if (transcript.trim().length > 20) {
        return {
          success: true,
          transcript,
          language: selectedTrack.languageCode || 'unknown'
        };
      } else {
        throw new Error('Transcript too short or empty');
      }
    } catch (error) {
      console.error('Error processing caption tracks:', error);
      throw error;
    }
  } catch (error) {
    console.error('Watch page method failed:', error);
    throw error;
  }
}

/**
 * Method 3: Use YouTube's experimental Innertube API (more recent version)
 */
async function getTranscriptFromInnertubeAPI(videoId) {
  try {
    console.log(`Getting transcript from Innertube API for video ID: ${videoId}`);
    
    // Get the watch page first
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await axios.get(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });
    
    // Extract API key and client version
    const apiKeyMatch = response.data.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/);
    const clientVersionMatch = response.data.match(/"INNERTUBE_CLIENT_VERSION":\s*"([^"]+)"/);
    
    if (!apiKeyMatch || !clientVersionMatch) {
      throw new Error('Could not find API key or client version');
    }
    
    const apiKey = apiKeyMatch[1];
    const clientVersion = clientVersionMatch[1];
    
    // Get current timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Prepare request to get transcript
    const url = `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`;
    const data = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: clientVersion,
          hl: "en",
          gl: "US",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          timeZone: "UTC",
          utcOffsetMinutes: 0
        },
        request: {
          useSsl: true,
          internalExperimentFlags: [],
          consistencyTokenJars: []
        },
        user: {},
        clientScreenNonce: generateNonce(timestamp)
      },
      params: encodeCaptionParams(videoId)
    };
    
    // Make request to get transcript data
    const transcriptResponse = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });
    
    // Parse the response
    const transcriptData = transcriptResponse.data;
    
    if (!transcriptData || !transcriptData.actions) {
      throw new Error('Invalid transcript response');
    }
    
    // Extract transcript content
    let transcript = '';
    let language = 'unknown';
    
    try {
      // Get the renderer containing the captions
      const captionRenderer = transcriptData.actions[0].updateEngagementPanelAction?.content?.transcriptRenderer ||
                             transcriptData.actions[0].appendContinuationItemsAction?.continuationItems[0]?.transcriptRenderer;
      
      if (!captionRenderer) {
        throw new Error('Transcript renderer not found');
      }
      
      // Get language info if available
      const headerInfo = captionRenderer.header?.transcriptHeaderRenderer;
      if (headerInfo && headerInfo.languageCode) {
        language = headerInfo.languageCode;
      }
      
      // Extract captions
      const cueGroups = captionRenderer.body?.transcriptBodyRenderer?.cueGroups || [];
      
      transcript = cueGroups.map(group => {
        const cues = group.transcriptCueGroupRenderer?.cues || [];
        return cues.map(cue => {
          return cue.transcriptCueRenderer?.cue?.simpleText || '';
        }).join(' ');
      }).join(' ');
      
      if (!transcript || transcript.trim().length < 20) {
        throw new Error('Empty or too short transcript');
      }
      
      return {
        success: true,
        transcript,
        language
      };
    } catch (error) {
      console.error('Error extracting transcript from Innertube response:', error);
      throw error;
    }
  } catch (error) {
    console.error('Innertube API method failed:', error);
    throw error;
  }
}

/**
 * Helper function to generate client screen nonce
 */
function generateNonce(timestamp) {
  return Buffer.from(`${timestamp}_${Math.random().toString(36).substr(2, 9)}`).toString('base64');
}

/**
 * Helper function to encode caption params
 */
function encodeCaptionParams(videoId) {
  const params = { videoId };
  return Buffer.from(JSON.stringify(params)).toString('base64');
}

/**
 * Parse the tracks XML to get available transcripts
 */
function parseTracksXml(xml) {
  const tracks = [];
  const trackRegex = /<track([^>]*)>/g;
  let match;
  
  while ((match = trackRegex.exec(xml)) !== null) {
    const attrs = match[1];
    
    const langCode = (attrs.match(/lang_code="([^"]*)"/) || [])[1];
    const name = (attrs.match(/name="([^"]*)"/) || [])[1] || '';
    const kind = (attrs.match(/kind="([^"]*)"/) || [])[1] || '';
    
    if (langCode) {
      tracks.push({
        lang_code: langCode,
        name: name,
        kind: kind
      });
    }
  }
  
  // If no tracks found, try alternative format
  if (tracks.length === 0) {
    const altTrackRegex = /lang="([^"]*)"[^>]*name="([^"]*)"/g;
    while ((match = altTrackRegex.exec(xml)) !== null) {
      const langCode = match[1];
      const name = match[2] || '';
      
      if (langCode) {
        tracks.push({
          lang_code: langCode,
          name: name,
          kind: ''
        });
      }
    }
  }
  
  return tracks;
}

/**
 * Parse the transcript XML to get the text
 */
function parseTranscriptXml(xml) {
  const textRegex = /<text[^>]*>(.*?)<\/text>/g;
  let match;
  const texts = [];
  
  while ((match = textRegex.exec(xml)) !== null) {
    let text = match[1];
    
    // Decode HTML entities
    text = decodeHtmlEntities(text);
    
    if (text.trim()) {
      texts.push(text);
    }
  }
  
  return texts.join(' ');
}

/**
 * Main function to get video transcript with multiple fallback methods
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
    
    const title = await getVideoTitle(videoId);
    console.log(`Got title: "${title}" for video ID: ${videoId}`);
    
    // Try all methods in sequence
    const methods = [
      { name: 'TimedText API', fn: getTranscriptFromTimedTextAPI },
      { name: 'Watch Page', fn: getTranscriptFromWatchPage },
      { name: 'Innertube API', fn: getTranscriptFromInnertubeAPI }
    ];
    
    for (const methodObj of methods) {
      try {
        console.log(`Attempting method: ${methodObj.name}`);
        const result = await methodObj.fn(videoId);
        
        if (result.success && result.transcript && result.transcript.trim().length >= 20) {
          console.log(`${methodObj.name} method succeeded`);
          
          return {
            video_id: videoId,
            title: title,
            transcript: result.transcript,
            language: result.language,
            url: url,
            method: methodObj.name,
            success: true
          };
        } else {
          console.log(`${methodObj.name} method returned invalid result`);
        }
      } catch (error) {
        console.log(`${methodObj.name} method failed: ${error.message}`);
        // Continue to next method
      }
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