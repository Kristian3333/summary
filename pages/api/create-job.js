// pages/api/create-job.js
import { createJob } from '../../utils/db';
import { extractVideoId } from '../../utils/youtube';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Validate YouTube URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid YouTube URL format'
      });
    }
    
    // Create a new job
    const { jobId, job } = createJob(url);
    
    // Update job with video ID
    job.videoId = videoId;
    job.status = 'pending';
    
    console.log(`Created job ${jobId} for video: ${url}`);
    
    // Start processing asynchronously without waiting
    // This is important to prevent Vercel function timeout
    fetch(`${req.headers.origin}/api/process-job?jobId=${jobId}`, { 
      method: 'POST' 
    }).catch(err => {
      console.error(`Failed to trigger processing for job ${jobId}:`, err);
    });
    
    // Return the job ID immediately
    return res.status(200).json({
      success: true,
      jobId,
      videoId,
      status: job.status
    });
  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create job: ' + error.message
    });
  }
}