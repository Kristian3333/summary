// pages/api/summarize.js
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, title, videoId } = req.body;

  if (!transcript) {
    return res.status(400).json({ 
      success: false, 
      error: 'Transcript is required' 
    });
  }

  try {
    console.log(`Generating summary for video: ${title || videoId}`);
    
    // Validate transcript
    if (transcript.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is too short to summarize'
      });
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
    const userPrompt = `Title: ${title || 'YouTube Video'}\n\nTranscript:\n${processedTranscript}`;

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
      return res.status(500).json({
        success: false,
        error: 'Failed to generate summary'
      });
    }

    // Return the summary
    return res.status(200).json({
      success: true,
      summary,
      videoId
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate summary: ' + error.message
    });
  }
}