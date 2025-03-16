// File: pages/index.js
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [pollingInterval, setPollingInterval] = useState(null);
  const [progressStage, setProgressStage] = useState('');
  const [examples, setExamples] = useState([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtu.be/xvFZjo5PgG0'
  ]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    await processUrl(url);
  };
  
  // Start processing a URL
  const processUrl = async (inputUrl) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setProgressStage('');
    setUrl(inputUrl);
    
    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    try {
      // Step 1: Create a new job
      const createResponse = await fetch('/api/create-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl }),
      });

      const createData = await createResponse.json();
      
      if (!createResponse.ok || !createData.success) {
        throw new Error(createData.error || 'Failed to create job');
      }
      
      // Got job ID, start polling
      setJobId(createData.jobId);
      startPolling(createData.jobId);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };
  
  // Start polling for job status
  const startPolling = (id) => {
    // Start with 1-second intervals
    const interval = setInterval(() => {
      checkJobStatus(id);
    }, 1000);
    
    setPollingInterval(interval);
  };
  
  // Check job status
  const checkJobStatus = async (id) => {
    try {
      const response = await fetch(`/api/job-status?jobId=${id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status');
      }
      
      // Update progress stage
      if (data.status === 'processing' && data.progressStage) {
        setProgressStage(data.progressStage);
      }
      
      // If job is completed or failed, stop polling
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(pollingInterval);
        setPollingInterval(null);
        setIsLoading(false);
        
        if (data.status === 'failed') {
          setError(data.error || 'Processing failed');
        } else {
          setResult(data);
          
          // Default to summary tab if summary exists, otherwise show transcript
          if (data.summary) {
            setActiveTab('summary');
          } else {
            setActiveTab('transcript');
          }
        }
      }
    } catch (err) {
      console.error('Error checking job status:', err);
      // Don't stop polling on temporary errors
    }
  };
  
  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return (
    <div className="container">
      <Head>
        <title>YouTube Video Summarizer</title>
        <meta name="description" content="Get AI-powered summaries of YouTube videos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className="title">
          YouTube Video Summarizer
        </h1>

        <p className="description">
          Enter a YouTube URL to get an AI-generated summary
        </p>

        <form onSubmit={handleSubmit} className="form">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input"
            required
            disabled={isLoading}
          />
          <button type="submit" className="button" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Get Summary'}
          </button>
        </form>
        
        <div className="examples">
          <p>Try these examples:</p>
          <div className="example-links">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => processUrl(example)}
                className="example-link"
                disabled={isLoading}
              >
                Example {index + 1}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="progress">
            <div className="spinner"></div>
            <p>{progressStage || 'Processing video...'}</p>
            <p className="hint">This may take up to a minute. Please wait...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
            <p className="suggestion">
              Try another video or check if this video has captions enabled.
              You can enable automatic captions on YouTube by clicking the CC button.
            </p>
          </div>
        )}

        {result && (
          <div className="result">
            <h2>{result.title}</h2>
            <div className="video-info">
              <p><strong>Video ID:</strong> {result.videoId}</p>
              {result.language && <p><strong>Language:</strong> {result.language}</p>}
              {result.method && <p><strong>Method used:</strong> {result.method}</p>}
            </div>
            <div className="video-preview">
              <iframe
                width="100%"
                height="215"
                src={`https://www.youtube.com/embed/${result.videoId}`}
                title={result.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            
            <div className="content-tabs">
              <div className="tabs">
                <button 
                  className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                  onClick={() => setActiveTab('summary')}
                  disabled={!result.summary}
                >
                  Summary
                </button>
                <button 
                  className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
                  onClick={() => setActiveTab('transcript')}
                >
                  Transcript
                </button>
              </div>
              
              <div className="tab-content">
                {activeTab === 'summary' && (
                  <div className="summary-container">
                    {result.summary ? (
                      <div className="summary">{result.summary}</div>
                    ) : (
                      <div className="error-message">
                        <p>{result.error || "Couldn't generate summary. Try viewing the transcript instead."}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'transcript' && (
                  <div className="transcript-container">
                    <pre className="transcript">{result.transcript}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: #f9f9f9;
        }

        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          max-width: 800px;
          width: 100%;
        }

        .title {
          margin: 0;
          line-height: 1.15;
          font-size: 3rem;
          color: #333;
          text-align: center;
        }

        .description {
          text-align: center;
          line-height: 1.5;
          font-size: 1.5rem;
          color: #666;
          margin: 2rem 0;
        }

        .form {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 600px;
          margin-bottom: 2rem;
        }

        .input {
          font-size: 1rem;
          padding: 0.8rem 1.2rem;
          border-radius: 5px;
          border: 1px solid #ddd;
          margin-bottom: 1rem;
          width: 100%;
        }

        .button {
          background-color: #0070f3;
          color: white;
          font-size: 1rem;
          padding: 0.8rem 1.2rem;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .button:hover {
          background-color: #0051b4;
        }

        .button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        .progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 2rem 0;
          padding: 1.5rem;
          background-color: #e6f7ff;
          border-radius: 8px;
          width: 100%;
          max-width: 600px;
        }
        
        .progress p {
          margin-top: 1rem;
          color: #0070f3;
          font-weight: 500;
        }
        
        .hint {
          font-size: 0.875rem;
          color: #666 !important;
          font-weight: normal !important;
          margin-top: 0.5rem !important;
        }
        
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #0070f3;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error {
          color: #d32f2f;
          background-color: #ffebee;
          padding: 1.5rem;
          border-radius: 5px;
          width: 100%;
          max-width: 600px;
          margin-bottom: 2rem;
        }

        .result {
          background-color: white;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 600px;
        }

        .result h2 {
          margin-top: 0;
          color: #333;
        }

        .video-info {
          margin-bottom: 1.5rem;
          color: #666;
        }
        
        .content-tabs {
          margin-top: 1.5rem;
        }
        
        .tabs {
          display: flex;
          border-bottom: 1px solid #ddd;
          margin-bottom: 1rem;
        }
        
        .tab {
          padding: 0.5rem 1rem;
          cursor: pointer;
          background: none;
          border: none;
          font-size: 1rem;
          color: #666;
        }
        
        .tab.active {
          border-bottom: 2px solid #0070f3;
          color: #0070f3;
          font-weight: 500;
        }
        
        .tab:disabled {
          color: #ccc;
          cursor: not-allowed;
        }
        
        .tab-content {
          padding: 1rem 0;
        }

        .summary {
          white-space: pre-line;
          line-height: 1.6;
        }

        .transcript-container {
          margin-top: 0.5rem;
        }

        .transcript {
          background-color: #f3f3f3;
          padding: 1rem;
          border-radius: 5px;
          line-height: 1.6;
          overflow-wrap: break-word;
          max-height: 400px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-family: inherit;
          font-size: 1rem;
        }
        
        .examples {
          margin-top: 2rem;
          text-align: center;
          width: 100%;
        }
        
        .example-links {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        
        .example-link {
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .example-link:hover {
          background-color: #e0e0e0;
        }
        
        .video-preview {
          width: 100%;
          margin: 1.5rem 0;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .error-message {
          color: #d32f2f;
          background-color: #ffebee;
          padding: 1rem;
          border-radius: 5px;
          margin-top: 1rem;
        }

        .suggestion {
          margin-top: 0.5rem;
          font-style: italic;
          color: #666;
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
            Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}