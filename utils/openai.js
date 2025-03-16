// utils/openai.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a summary of the transcript using OpenAI
 * @param {string} transcript - The transcript to summarize
 * @param {string} title - The title of the video
 * @returns {Promise<{summary: string, error: string|null}>}
 */
export async function generateSummary(transcript, title) {
  try {
    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Transcript is too short or empty');
    }

    // Prepare a system prompt
    const systemPrompt = `You are a helpful assistant that summarizes YouTube video transcripts.
Create a concise yet comprehensive summary that captures the main points, key insights, and important details.
Format your summary with:
1. A brief overview (1-2 sentences)
2. Main points (bullet points)
3. Key takeaways (2-3 sentences)`;

    // Prepare user prompt with video context
    const userPrompt = `Title: ${title}\n\nTranscript:\n${transcript}`;

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
      throw new Error('Failed to generate summary');
    }

    return {
      summary,
      error: null
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      summary: null,
      error: error.message || 'Unknown error occurred while generating summary'
    };
  }
}