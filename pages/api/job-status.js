// pages/api/job-status.js
import { getJob } from '../../utils/db';

export default async function handler(req, res) {
  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  // Get the job status
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ 
      success: false, 
      error: 'Job not found' 
    });
  }

  // Return different data based on job status
  const response = {
    success: true,
    jobId,
    status: job.status,
    videoId: job.videoId,
    title: job.title,
    updatedAt: job.updatedAt
  };
  
  // Include error if job failed
  if (job.status === 'failed') {
    response.error = job.error;
  }
  
  // Include summary and transcript only if job is completed
  if (job.status === 'completed') {
    response.summary = job.summary;
    response.transcript = job.transcript;
    response.language = job.language;
    response.method = job.method;
  }
  
  // Include progress info for processing jobs
  if (job.status === 'processing') {
    response.progressStage = job.progressStage || 'Retrieving transcript';
    if (job.error) {
      response.progressError = job.error;
    }
  }
  
  return res.status(200).json(response);
}