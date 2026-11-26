import { useEffect, useState } from 'react';
import { ApiError } from './api/client';
import { createTouristSession, extractTouristToken } from './auth/session';
import { getTouristContext, TouristContext } from './tourist/context';
import { createLostReport, createMissingReport, getReportStatus, ReportSummary } from './tourist/reports';
import { sendAssistantMessage } from './tourist/assistant';

function formatTourDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatMessageDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

function WelcomeShell() {
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">TourGuard Assistant</p>
        <h1 id="welcome-title">Your calm companion on the way.</h1>
        <p className="welcome-copy">
          A safe place for tour details, guide contact, and quick help when you need it.
        </p>
      </section>
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="app-shell">
      <section className="status-card" aria-labelledby="invalid-link-title">
        <p className="eyebrow">TourGuard Assistant</p>
        <h1 id="invalid-link-title">Your secure link is missing.</h1>
        <p className="status-copy">Please reopen the link sent to your phone.</p>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="app-shell">
      <section className="status-card" aria-live="polite">
        <p className="eyebrow">TourGuard Assistant</p>
        <p className="status-copy">Loading your tour details…</p>
      </section>
    </main>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <main className="app-shell">
      <section className="status-card" role="alert">
        <p className="eyebrow">TourGuard Assistant</p>
        <h1>We could not load your details.</h1>
        <p className="status-copy">{error}</p>
      </section>
    </main>
  );
}

function TouristHome({
  context,
  onReportLost,
  onReportMissing,
  onGetReportStatus,
  onSendMessage,
}: {
  context: TouristContext;
  onReportLost: (note: string) => Promise<ReportSummary>;
  onReportMissing: (reference: string, note: string) => Promise<ReportSummary>;
  onGetReportStatus: (reference: string) => Promise<ReportSummary>;
  onSendMessage: (message: string) => Promise<string>;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingReference, setMissingReference] = useState('');
  const [missingNote, setMissingNote] = useState('');
  const [missingReport, setMissingReport] = useState<ReportSummary | null>(null);
  const [missingSubmitting, setMissingSubmitting] = useState(false);
  const [missingError, setMissingError] = useState<string | null>(null);
  const [statusReference, setStatusReference] = useState('');
  const [statusResult, setStatusResult] = useState<ReportSummary | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; sentAt: Date }>>([]);
  const [messageInput, setMessageInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function submitLostReport() {
    setSubmitting(true);
    setReportError(null);
    try {
      const createdReport = await onReportLost(note);
      setReport(createdReport);
      setReportOpen(false);
      setNote('');
    } catch (error: unknown) {
      setReportError(error instanceof ApiError ? error.message : 'We could not send your report.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMissingReport() {
    setMissingSubmitting(true);
    setMissingError(null);
    try {
      const createdReport = await onReportMissing(missingReference.trim(), missingNote);
      setMissingReport(createdReport);
      setMissingOpen(false);
      setMissingReference('');
      setMissingNote('');
    } catch (error: unknown) {
      setMissingError(error instanceof ApiError ? error.message : 'We could not send your report.');
    } finally {
      setMissingSubmitting(false);
    }
  }

  async function checkReportStatus() {
    setStatusLoading(true);
    setStatusError(null);
    try {
      setStatusResult(await onGetReportStatus(statusReference.trim()));
    } catch (error: unknown) {
      setStatusResult(null);
      setStatusError(error instanceof ApiError ? error.message : 'We could not check that report.');
    } finally {
      setStatusLoading(false);
    }
  }

  async function sendMessage(message = messageInput) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || chatLoading) return;

    setChatLoading(true);
    setChatError(null);
    setMessages((current) => [...current, { role: 'user', content: trimmedMessage, sentAt: new Date() }]);
    setMessageInput('');

    try {
      const response = await onSendMessage(trimmedMessage);
      setMessages((current) => [...current, { role: 'assistant', content: response, sentAt: new Date() }]);
    } catch (error: unknown) {
      setChatError(error instanceof ApiError ? error.message : 'The assistant is temporarily unavailable.');
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="app-shell app-shell--top-aligned">
      <div className="tourist-home">
        <header className="page-header">
          <p className="eyebrow">TourGuard Assistant</p>
          <p className="secure-label">Secure tourist session</p>
          <h1>Welcome, {context.name}.</h1>
          <p className="welcome-copy">Here are the details for your upcoming tour.</p>
        </header>

        <section className="info-card" aria-labelledby="tour-title">
          <p className="card-label">Your tour</p>
          <h2 id="tour-title">{context.tour.name}</h2>
          <p>{context.tour.description}</p>
          <dl className="details-list">
            <div>
              <dt>Meeting point</dt>
              <dd>{context.tour.meetingPoint}</dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>{formatTourDate(context.tour.startAt)}</dd>
            </div>
            <div>
              <dt>Ends</dt>
              <dd>{formatTourDate(context.tour.endAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="info-card" aria-labelledby="guide-title">
          <p className="card-label">Your guide</p>
          <h2 id="guide-title">{context.tour.guide.name}</h2>
          <a className="phone-link" href={`tel:${context.tour.guide.phone}`}>
            {context.tour.guide.phone}
          </a>
        </section>

        <section className="safety-card" aria-labelledby="safety-title">
          <p className="card-label">Need help now?</p>
          <h2 id="safety-title">Report that you are lost</h2>
          <p>Your guide or tour operator will be able to act on an open safety report.</p>
          {report ? (
            <p className="success-message" role="status">
              Your lost report is open. Reference: {report.publicReference}
            </p>
          ) : reportOpen ? (
            <div className="report-form">
              <label htmlFor="lost-note">Optional note</label>
              <textarea
                id="lost-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="For example: I am near the main entrance."
                rows={4}
              />
              {reportError && <p className="form-error" role="alert">{reportError}</p>}
              <div className="form-actions">
                <button type="button" className="button button--primary" onClick={submitLostReport} disabled={submitting}>
                  {submitting ? 'Sending…' : 'Confirm lost report'}
                </button>
                <button type="button" className="button button--quiet" onClick={() => setReportOpen(false)} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button button--primary" onClick={() => setReportOpen(true)}>
              I’m lost
            </button>
          )}
        </section>

        <section className="safety-card" aria-labelledby="missing-title">
          <p className="card-label">Looking for someone?</p>
          <h2 id="missing-title">Report a missing tourist</h2>
          <p>Use the public reference for a tourist on your tour.</p>
          {missingReport ? (
            <p className="success-message" role="status">
              Your missing-tourist report is open. Reference: {missingReport.publicReference}
            </p>
          ) : missingOpen ? (
            <div className="report-form">
              <label htmlFor="missing-reference">Tourist public reference</label>
              <input
                id="missing-reference"
                value={missingReference}
                onChange={(event) => setMissingReference(event.target.value)}
                pattern="[a-f0-9]{32}"
                maxLength={32}
                placeholder="32-character reference"
              />
              <label htmlFor="missing-note">Optional note</label>
              <textarea
                id="missing-note"
                value={missingNote}
                onChange={(event) => setMissingNote(event.target.value)}
                maxLength={500}
                placeholder="For example: Last seen near the entrance."
                rows={4}
              />
              {missingError && <p className="form-error" role="alert">{missingError}</p>}
              <div className="form-actions">
                <button type="button" className="button button--primary" onClick={submitMissingReport} disabled={missingSubmitting || !/^[a-f0-9]{32}$/.test(missingReference.trim())}>
                  {missingSubmitting ? 'Sending…' : 'Confirm missing report'}
                </button>
                <button type="button" className="button button--quiet" onClick={() => setMissingOpen(false)} disabled={missingSubmitting}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button button--primary" onClick={() => setMissingOpen(true)}>
              Report someone missing
            </button>
          )}
        </section>

        <section className="info-card" aria-labelledby="status-title">
          <p className="card-label">Follow up</p>
          <h2 id="status-title">Check report status</h2>
          <p>Enter the public reference from your report confirmation.</p>
          <div className="report-form">
            <label htmlFor="status-reference">Report public reference</label>
            <input
              id="status-reference"
              value={statusReference}
              onChange={(event) => setStatusReference(event.target.value)}
              pattern="[a-f0-9]{32}"
              maxLength={32}
              placeholder="32-character reference"
            />
            {statusError && <p className="form-error" role="alert">{statusError}</p>}
            <button
              type="button"
              className="button button--primary"
              onClick={checkReportStatus}
              disabled={statusLoading || !/^[a-f0-9]{32}$/.test(statusReference.trim())}
            >
              {statusLoading ? 'Checking…' : 'Check status'}
            </button>
          </div>
          {statusResult && (
            <div className="status-result" role="status">
              <span>Report status</span>
              <strong>{statusResult.status}</strong>
            </div>
          )}
        </section>

        <section className="info-card chat-card" aria-labelledby="assistant-title">
          <p className="card-label">Need help?</p>
          <h2 id="assistant-title">Ask TourGuard</h2>
          <div className="suggested-prompts" aria-label="Suggested questions">
            {['Where is the meeting point?', 'How do I contact my guide?'].map((prompt) => (
              <button key={prompt} type="button" className="prompt-button" onClick={() => void sendMessage(prompt)} disabled={chatLoading}>
                {prompt}
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <div className="chat-log" role="log" aria-live="polite">
              {messages.map((message, index) => (
                <p key={`${message.role}-${index}`} className={`chat-message chat-message--${message.role}`}>
                  <span>{message.content}</span>
                  <time dateTime={message.sentAt.toISOString()}>{formatMessageDate(message.sentAt)}</time>
                </p>
              ))}
            </div>
          )}
          {chatError && <p className="form-error" role="alert">{chatError}</p>}
          <form className="chat-form" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <label htmlFor="assistant-message">Your question</label>
            <div className="chat-input-row">
              <input
                id="assistant-message"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                maxLength={2000}
                placeholder="Ask about your tour…"
              />
              <button type="submit" className="button button--primary" disabled={chatLoading || !messageInput.trim()}>
                {chatLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function App() {
  const token = extractTouristToken(window.location.pathname);
  const [context, setContext] = useState<TouristContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = createTouristSession(token);

  async function handleLostReport(note: string): Promise<ReportSummary> {
    const accessToken = session.get()?.accessToken;
    if (!accessToken) throw new Error('Your secure session has expired.');
    const response = await createLostReport(accessToken, note.trim() ? { note: note.trim() } : {});
    return response.data;
  }

  async function handleMissingReport(reference: string, note: string): Promise<ReportSummary> {
    const accessToken = session.get()?.accessToken;
    if (!accessToken) throw new Error('Your secure session has expired.');
    const response = await createMissingReport(
      accessToken,
      reference,
      note.trim() ? { note: note.trim() } : {},
    );
    return response.data;
  }

  async function handleGetReportStatus(reference: string): Promise<ReportSummary> {
    const accessToken = session.get()?.accessToken;
    if (!accessToken) throw new Error('Your secure session has expired.');
    const response = await getReportStatus(accessToken, reference);
    return response.data;
  }

  async function handleSendMessage(message: string): Promise<string> {
    const accessToken = session.get()?.accessToken;
    if (!accessToken) throw new Error('Your secure session has expired.');
    const response = await sendAssistantMessage(accessToken, message);
    return response.message;
  }

  useEffect(() => {
    const accessToken = session.get()?.accessToken;
    if (!accessToken) return;

    let active = true;
    getTouristContext(accessToken)
      .then((response) => {
        if (active) setContext(response.data);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Please try reopening your TourGuard link.',
        );
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!token) {
    return window.location.pathname === '/' ? <WelcomeShell /> : <InvalidLink />;
  }
  if (error) return <ErrorState error={error} />;
  if (!context) return <LoadingState />;
  return (
    <TouristHome
      context={context}
      onReportLost={handleLostReport}
      onReportMissing={handleMissingReport}
      onGetReportStatus={handleGetReportStatus}
      onSendMessage={handleSendMessage}
    />
  );
}

export default App;
