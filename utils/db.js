// utils/db.js - Simple in-memory storage for job state
// In a production app, this would be replaced by a real database

// In-memory store for jobs
// Structure: {
//   [jobId]: {
//     status: 'pending' | 'processing' | 'completed' | 'failed',
//     videoId: string,
//     videoUrl: string,
//     title: string,
//     transcript: string | null,
//     summary: string | null,
//     language: string | null,
//     error: string | null,
//     method: string | null,
//     createdAt: Date,
//     updatedAt: Date
//   }
// }
const jobStore = new Map();

// Generate a random job ID
function generateJobId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Create a new job
export function createJob(videoUrl) {
  const jobId = generateJobId();
  const now = new Date();
  
  const job = {
    status: 'pending',
    videoUrl,
    videoId: null,
    title: null,
    transcript: null,
    summary: null,
    language: null,
    error: null,
    method: null,
    createdAt: now,
    updatedAt: now
  };
  
  jobStore.set(jobId, job);
  
  // Add expiration (clean up job after 30 minutes)
  setTimeout(() => {
    if (jobStore.has(jobId)) {
      console.log(`Cleaning up expired job: ${jobId}`);
      jobStore.delete(jobId);
    }
  }, 30 * 60 * 1000);
  
  return { jobId, job };
}

// Get a job by ID
export function getJob(jobId) {
  return jobStore.get(jobId) || null;
}

// Update a job
export function updateJob(jobId, updates) {
  if (!jobStore.has(jobId)) {
    return null;
  }
  
  const job = jobStore.get(jobId);
  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date()
  };
  
  jobStore.set(jobId, updatedJob);
  return updatedJob;
}

// Set job status
export function setJobStatus(jobId, status, error = null) {
  if (!jobStore.has(jobId)) {
    return null;
  }
  
  const updates = { status };
  if (error) {
    updates.error = error;
  }
  
  return updateJob(jobId, updates);
}