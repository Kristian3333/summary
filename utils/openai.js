// utils/openai.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Maximum number of retries for OpenAI API calls
const MAX_RETRIES = 3;
// Base delay for exponential backoff in ms
const BASE_DELAY = 1000;

/**
 * Sleep function for delay between retries
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a summary of the transcript using OpenAI with retries
 * @param {string} transcript - The transcript to summarize
 * @param {string} title - The title of the video
 * @returns {Promise<{summary: string, error: string|null}>}
 */
export async function generateSummary(transcript, title) {
  let attempts = 0;
  let lastError = null;
  
  while (attempts < MAX_RETRIES) {
    try {
      // Validate transcript
      if (!transcript || transcript.trim().length < 20) {
        throw new Error('Transcript is too short or empty');
      }
      
      // Truncate long transcripts to fit token limits (around 15k characters)
      const maxLength = 15000;
      let processedTranscript = transcript;
      
      if (transcript.length > maxLength) {
        console.log(`Transcript too long (${transcript.length} chars), truncating to ${maxLength} chars`);
        // Keep first and last parts of the transcript for context
        const firstPart = transcript.substring(0, maxLength * 0.6);
        const lastPart = transcript.substring(transcript.length - maxLength * 0.4);
        processedTranscript = `${firstPart}\n[...transcript truncated...]\n${lastPart}`;
      }
      
      // Prepare a system prompt
      const systemPrompt = `You are a helpful assistant that summarizes YouTube video transcripts.
Create a concise yet comprehensive summary that captures the main points, key insights, and important details.
Format your summary with:
1. A brief overview (1-2 sentences)
2. Main points (bullet points)
3. Key takeaways (2-3 sentences)

If the transcript appears to be cut off or incomplete, mention this in your summary.`;

      // Prepare user prompt with video context
      const userPrompt = `Title: ${title}\n\nTranscript:\n${processedTranscript}`;

      console.log(`Calling OpenAI API to summarize video: ${title}`);
      
      // Call the OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });

      // Extract the summary from the response
      const summary = response.choices[0]?.message?.content;
      
      if (!summary) {
        throw new Error('OpenAI returned empty summary');
      }

      return {
        summary,
        error: null
      };
    } catch (error) {
      attempts++;
      lastError = error;
      
      console.error(`OpenAI API error (attempt ${attempts}/${MAX_RETRIES}):`, error.message);
      
      // Only retry on rate limits, timeouts or server errors
      const shouldRetry = 
        error.status === 429 || // Rate limit error
        error.status >= 500 || // Server error
        error.code === 'ECONNABORTED' || // Timeout
        error.code === 'ETIMEDOUT'; // Timeout
      
      if (attempts >= MAX_RETRIES || !shouldRetry) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = BASE_DELAY * Math.pow(2, attempts) + Math.random() * 1000;
      console.log(`Retrying in ${Math.round(delay/1000)} seconds...`);
      await sleep(delay);
    }
  }
  
  // All retries failed
  console.error('All OpenAI API attempts failed');
  return {
    summary: null,
    error: lastError?.message || 'Failed to generate summary after multiple attempts'
  };
}