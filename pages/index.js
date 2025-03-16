// pages/index.js with client-side orchestration
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [videoInfo, setVideoInfo] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  
  // Track the processing stage
  const [stage, setStage] = useState('idle'); // idle, video-info, transcript, summary, complete, error
  
  const [examples, setExamples] = useState([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtu.be/xvFZjo5PgG0'
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await processUrl(url);
  };
  
  const processUrl = async (inputUrl) => {
    // Reset state
    setUrl(inputUrl);
    setError(null);
    setVideoInfo(null);
    setTranscript(null);
    setSummary(null);
    setStage('video-info');
    
    try {
      // Step 1: Get video info (fast operation)
      const infoResponse = await fetch('/api/video-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl }),
      });
      
      const infoData = await infoResponse.json();
      
      if (!infoData.success) {
        throw new Error(infoData.error || 'Failed to get video info');
      }
      
      setVideoInfo(infoData);
      setStage('transcript');
      
      // Step 2: Get transcript in a separate request
      const transcriptResponse = await fetch(`/api/transcript?videoId=${infoData.videoId}`);
      const transcriptData = await transcriptResponse.json();
      
      if (!transcriptData.success) {
        throw new Error(transcriptData.error || 'Failed to get transcript');
      }
      
      setTranscript(transcriptData);
      setStage('summary');
      
      // Step 3: Generate summary with the transcript
      const summaryResponse = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptData.transcript,
          title: infoData.title,
          videoId: infoData.videoId
        }),
      });
      
      const summaryData = await summaryResponse.json();
      
      if (!summaryData.success) {
        // We have the transcript, so don't throw an error
        // Just note that summary failed
        console.error('Summary generation failed:', summaryData.error);
        setStage('complete');
        setActiveTab('transcript'); // Switch to transcript tab
        return;
      }
      
      setSummary(summaryData);
      setStage('complete');
      setActiveTab('summary'); // Default to summary tab when successful
      
    } catch (err) {
      console.error('Error processing URL:', err);
      setError(err.message);
      setStage('error');
    }
  };
  
  // Get message based on current processing stage
  const getStagingMessage = () => {
    switch (stage) {
      case 'video-info':
        return 'Getting video information...';
      case 'transcript':
        return 'Retrieving video transcript...';
      case 'summary':
        return 'Generating AI summary...';
      default:
        return 'Processing...';
    }
  };
  
  // Check if we're in a loading state
  const isLoading = ['video-info', 'transcript', 'summary'].includes(stage);

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
            <p>{getStagingMessage()}</p>
            {videoInfo && (
              <div className="video-preview-small">
                <h3>{videoInfo.title}</h3>
                <iframe
                  width="280"
                  height="158"
                  src={`https://www.youtube.com/embed/${videoInfo.videoId}`}
                  title={videoInfo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
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

        {stage === 'complete' && videoInfo && (
          <div className="result">
            <h2>{videoInfo.title}</h2>
            <div className="video-info">
              <p><strong>Video ID:</strong> {videoInfo.videoId}</p>
              {transcript && transcript.language && <p><strong>Language:</strong> {transcript.language}</p>}
              {transcript && transcript.method && <p><strong>Method used:</strong> {transcript.method}</p>}
            </div>
            <div className="video-preview">
              <iframe
                width="100%"
                height="215"
                src={`https://www.youtube.com/embed/${videoInfo.videoId}`}
                title={videoInfo.title}
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
                  disabled={!summary}
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
                    {summary ? (
                      <div className="summary">{summary.summary}</div>
                    ) : (
                      <div className="error-message">
                        <p>Sorry, we couldn't generate a summary. Try viewing the transcript instead.</p>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'transcript' && (
                  <div className="transcript-container">
                    {transcript ? (
                      <pre className="transcript">{transcript.transcript}</pre>
                    ) : (
                      <div className="error-message">
                        <p>Transcript not available.</p>
                      </div>
                    )}
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
        
        .video-preview-small {
          margin: 1rem 0;
          text-align: center;
        }
        
        .video-preview-small h3 {
          margin-bottom: 0.5rem;
          font-size: 1rem;
          color: #333;
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