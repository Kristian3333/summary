// pages/api/process-job.js
import { getJob, updateJob, setJobStatus } from '../../utils/db';
import { getVideoTitle, getVideoTranscript } from '../../utils/youtube';
import { generateSummary } from '../../utils/openai';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  // Get the job
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ 
      success: false, 
      error: 'Job not found' 
    });
  }
  
  // Return immediately to prevent timeout
  // This is crucial for Vercel Serverless Functions
  res.status(200).json({
    success: true,
    message: 'Job processing started',
    jobId
  });
  
  // Process the job asynchronously
  processJob(jobId, job.videoUrl).catch(error => {
    console.error(`Error processing job ${jobId}:`, error);
    setJobStatus(jobId, 'failed', error.message);
  });
}

/**
 * Process a job asynchronously
 */
async function processJob(jobId, url) {
  try {
    console.log(`Processing job ${jobId} for URL: ${url}`);
    
    // Update job status to processing
    setJobStatus(jobId, 'processing');
    updateJob(jobId, { progressStage: 'Retrieving video information' });
    
    // Step 1: Get video title
    updateJob(jobId, { progressStage: 'Getting video title' });
    const videoId = getJob(jobId).videoId;
    const title = await getVideoTitle(videoId);
    updateJob(jobId, { title });
    
    // Step 2: Get video transcript
    updateJob(jobId, { progressStage: 'Retrieving transcript' });
    const transcriptResult = await getVideoTranscript(url);
    
    if (!transcriptResult.success) {
      // Failed to get transcript
      throw new Error(transcriptResult.error || 'Failed to retrieve transcript');
    }
    
    // Update job with transcript info
    updateJob(jobId, {
      transcript: transcriptResult.transcript,
      language: transcriptResult.language,
      method: transcriptResult.method,
      progressStage: 'Generating summary'
    });
    
    // Step 3: Generate summary with OpenAI
    const summaryResult = await generateSummary(
      transcriptResult.transcript,
      transcriptResult.title || title
    );
    
    if (summaryResult.error) {
      // Continue with transcript but note the summary error
      updateJob(jobId, { 
        error: `Summary generation failed: ${summaryResult.error}`,
        status: 'completed'
      });
    } else {
      // Update job with summary
      updateJob(jobId, {
        summary: summaryResult.summary,
        status: 'completed'
      });
    }
    
    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    setJobStatus(jobId, 'failed', error.message);
    throw error; // Re-throw so the parent handler can log it
  }
}