// File: pages/index.js
import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
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
    setIsLoading(true);
    setError(null);
    setResult(null);
    setUrl(inputUrl);

    try {
      const response = await fetch('/api/get-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = await response.json();
      setResult(data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get video summary');
      }
      
      // Default to summary tab if summary exists, otherwise show transcript
      if (data.summary) {
        setActiveTab('summary');
      } else {
        setActiveTab('transcript');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <Head>
        <title>YouTube Video Summarizer</title>
        <meta name="description" content="Get summaries of YouTube videos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className="title">
          YouTube Video Summarizer
        </h1>

        <p className="description">
          Enter a YouTube URL to get a transcript and AI-generated summary
        </p>

        <form onSubmit={handleSubmit} className="form">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input"
            required
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

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="result">
            <h2>{result.title}</h2>
            <div className="video-info">
              <p><strong>Video ID:</strong> {result.video_id}</p>
              {result.language && <p><strong>Language:</strong> {result.language}</p>}
              {result.method && <p><strong>Method used:</strong> {result.method}</p>}
            </div>
            <div className="video-preview">
              <iframe
                width="100%"
                height="215"
                src={`https://www.youtube.com/embed/${result.video_id}`}
                title={result.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            
            {result.success && (
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
                          <p>{result.summary_error || "Couldn't generate summary. Try viewing the transcript instead."}</p>
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
            )}
            
            {!result.success && (
              <div className="error-message">
                <p>{result.error || "Failed to retrieve transcript"}</p>
                <p className="suggestion">
                  Try another video or check if this video has captions enabled.
                  You can enable automatic captions on YouTube by clicking the CC button.
                </p>
              </div>
            )}
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

        .error {
          color: #d32f2f;
          background-color: #ffebee;
          padding: 1rem;
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