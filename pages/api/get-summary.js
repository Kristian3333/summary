// File: pages/api/get-summary.js
import { extractVideoId, getVideoTitle, getVideoTranscript } from '../../utils/youtube';
import { generateSummary } from '../../utils/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`Processing URL: ${url}`);
    
    // Validate URL format
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid YouTube URL format',
        url: url
      });
    }
    
    // Get video title (this is fast and gives immediate feedback)
    const title = await getVideoTitle(url);
    
    // Get the transcript
    const transcriptResult = await getVideoTranscript(url);
    
    if (!transcriptResult.success) {
      console.log(`Transcript retrieval failed: ${transcriptResult.error}`);
      return res.status(404).json({
        success: false,
        error: transcriptResult.error,
        url: url,
        video_id: transcriptResult.video_id || videoId,
        title: transcriptResult.title || title
      });
    }

    // Clean the transcript
    let transcript = transcriptResult.transcript || '';
    transcript = cleanTranscript(transcript);
    
    // Validate the transcript
    if (!transcript || transcript.trim().length < 10) {
      console.log('Transcript is too short or empty after cleaning');
      return res.status(404).json({
        success: false,
        error: 'Retrieved transcript is empty or too short',
        url: url,
        video_id: transcriptResult.video_id,
        title: transcriptResult.title
      });
    }

    // Generate summary using OpenAI
    console.log(`Generating summary for: ${transcriptResult.title}`);
    const summaryResult = await generateSummary(transcript, transcriptResult.title);

    if (summaryResult.error) {
      console.log(`Summary generation failed: ${summaryResult.error}`);
      // Return transcript even if summary fails
      return res.status(200).json({
        success: true,
        video_id: transcriptResult.video_id,
        title: transcriptResult.title,
        transcript: transcript,
        language: transcriptResult.language,
        url: transcriptResult.url,
        method: transcriptResult.method,
        summary: null,
        summary_error: summaryResult.error
      });
    }

    // Return both transcript and summary
    console.log(`Successfully generated summary for: ${transcriptResult.title}`);
    return res.status(200).json({
      success: true,
      video_id: transcriptResult.video_id,
      title: transcriptResult.title,
      transcript: transcript,
      language: transcriptResult.language,
      url: transcriptResult.url,
      method: transcriptResult.method,
      summary: summaryResult.summary
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process video: ' + error.message,
      url: url 
    });
  }
}

// Helper function to clean transcript text
function cleanTranscript(text) {
  if (!text) return '';
  
  // Decode HTML entities
  let cleaned = text.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  
  // Remove excessive whitespace while preserving paragraph breaks
  cleaned = cleaned.replace(/\s+/g, ' '); // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Replace excessive newlines
  
  return cleaned.trim();
}