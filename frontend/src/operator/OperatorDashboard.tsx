import { FormEvent, useState } from 'react';
import { ApiError, apiClient } from '../api/client';

type Guide = { name: string; phone: string; publicReference: string };
type Tour = {
  id: string;
  name: string;
  guide: { name: string; phone: string };
};
type Tourist = {
  name: string;
  phone: string;
  publicReference: string;
  secureLink: string;
  smsStatus: 'SENT' | 'FAILED';
};
type Report = {
  publicReference: string;
  type: 'LOST' | 'MISSING';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  lat: number | null;
  lng: number | null;
  note: string | null;
  createdAt: string;
  reporter: { name: string; phone: string };
  missingTourist: { name: string; phone: string } | null;
};

function OperatorError({ message }: { message: string | null }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}

function OperatorDashboard() {
  const [operatorKey, setOperatorKey] = useState('');
  const [guide, setGuide] = useState<Guide | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [tourist, setTourist] = useState<Tourist | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [retryingSms, setRetryingSms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit<T>(action: string, path: string, body: unknown): Promise<T | null> {
    setBusy(action);
    setError(null);
    try {
      const response = await apiClient.withOperatorKey(operatorKey).request<{ data: T }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return response.data;
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'The operator request failed.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function createGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await submit<Guide>('guide', '/guides', {
      name: form.get('name'),
      phone: form.get('phone'),
    });
    if (created) {
      setGuide(created);
      event.currentTarget.reset();
    }
  }

  async function createTour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guide) return;
    const form = new FormData(event.currentTarget);
    const created = await submit<Tour>('tour', '/tours', {
      name: form.get('name'),
      description: form.get('description'),
      meetingPoint: form.get('meetingPoint'),
      startAt: new Date(String(form.get('startAt'))).toISOString(),
      endAt: new Date(String(form.get('endAt'))).toISOString(),
      guideReference: guide.publicReference,
    });
    if (created) {
      setTour(created);
      event.currentTarget.reset();
    }
  }

  async function createTourist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tour) return;
    const form = new FormData(event.currentTarget);
    const created = await submit<Tourist>('tourist', '/tourists', {
      name: form.get('name'),
      phone: form.get('phone'),
      tourId: tour.id,
    });
    if (created) {
      setTourist(created);
      event.currentTarget.reset();
    }
  }

  async function loadReports() {
    if (!tour) return;
    setReportsLoading(true);
    setError(null);
    try {
      const response = await apiClient.withOperatorKey(operatorKey).request<{ data: Report[] }>(`/reports/tour/${tour.id}`);
      setReports(response.data);
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'The reports could not be loaded.');
    } finally {
      setReportsLoading(false);
    }
  }

  async function transitionReport(reportReference: string, action: 'acknowledge' | 'resolve') {
    setReportsLoading(true);
    setError(null);
    try {
      await apiClient.withOperatorKey(operatorKey).request(`/reports/${reportReference}/${action}`, { method: 'PATCH' });
      await loadReports();
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'The report could not be updated.');
      setReportsLoading(false);
    }
  }

  async function retrySms() {
    if (!tourist) return;
    setRetryingSms(true);
    setError(null);
    try {
      const response = await apiClient
        .withOperatorKey(operatorKey)
        .request<{ data: Pick<Tourist, 'publicReference' | 'secureLink' | 'smsStatus'> }>(
          `/tourists/${tourist.publicReference}/sms/retry`,
          { method: 'POST' },
        );
      setTourist((current) => current ? { ...current, ...response.data } : current);
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'The SMS retry failed.');
    } finally {
      setRetryingSms(false);
    }
  }

  return (
    <main className="app-shell app-shell--top-aligned">
      <div className="operator-dashboard">
        <header className="page-header">
          <p className="eyebrow">TourGuard Operations</p>
          <h1>Set up a safe tour.</h1>
          <p className="welcome-copy">Create the guide, tour, and tourist link for a new tour.</p>
        </header>

        <section className="info-card operator-key-card">
          <label htmlFor="operator-key">Operator key</label>
          <input
            id="operator-key"
            type="password"
            value={operatorKey}
            onChange={(event) => setOperatorKey(event.target.value)}
            placeholder="Enter the configured operator key"
            autoComplete="off"
          />
          <p className="form-hint">Kept in memory only and cleared when this page is closed.</p>
          <OperatorError message={error} />
        </section>

        <section className="info-card operator-card">
          <p className="card-label">Step 1</p>
          <h2>Create a guide</h2>
          <form className="operator-form" onSubmit={createGuide}>
            <label htmlFor="guide-name">Guide name</label>
            <input id="guide-name" name="name" required placeholder="Demo Guide" />
            <label htmlFor="guide-phone">Guide phone</label>
            <input id="guide-phone" name="phone" required placeholder="+254700000001" />
            <button className="button button--primary" disabled={!operatorKey || busy !== null}>
              {busy === 'guide' ? 'Creating…' : 'Create guide'}
            </button>
          </form>
          {guide && <p className="success-message">Created {guide.name}. Reference: {guide.publicReference}</p>}
        </section>

        <section className="info-card operator-card">
          <p className="card-label">Step 2</p>
          <h2>Create a tour</h2>
          <form className="operator-form" onSubmit={createTour}>
            <label htmlFor="tour-name">Tour name</label>
            <input id="tour-name" name="name" required placeholder="Nairobi City Tour" />
            <label htmlFor="tour-description">Description</label>
            <textarea id="tour-description" name="description" required rows={3} placeholder="A guided city tour." />
            <label htmlFor="tour-meeting-point">Meeting point</label>
            <input id="tour-meeting-point" name="meetingPoint" required placeholder="Kenya National Archives" />
            <label htmlFor="tour-start">Starts</label>
            <input id="tour-start" name="startAt" type="datetime-local" required />
            <label htmlFor="tour-end">Ends</label>
            <input id="tour-end" name="endAt" type="datetime-local" required />
            <button className="button button--primary" disabled={!guide || busy !== null}>
              {busy === 'tour' ? 'Creating…' : 'Create tour'}
            </button>
          </form>
          {!guide && <p className="form-hint">Create a guide first.</p>}
          {tour && <p className="success-message">Created {tour.name}. Tour ID: {tour.id}</p>}
        </section>

        <section className="info-card operator-card">
          <p className="card-label">Step 3</p>
          <h2>Register a tourist</h2>
          <form className="operator-form" onSubmit={createTourist}>
            <label htmlFor="tourist-name">Tourist name</label>
            <input id="tourist-name" name="name" required placeholder="Demo Tourist" />
            <label htmlFor="tourist-phone">Tourist phone</label>
            <input id="tourist-phone" name="phone" required placeholder="+254712345678" />
            <button className="button button--primary" disabled={!tour || busy !== null}>
              {busy === 'tourist' ? 'Registering…' : 'Register tourist'}
            </button>
          </form>
          {!tour && <p className="form-hint">Create a tour first.</p>}
          {tourist && (
            <div className="operator-result">
              <p className="success-message">Tourist registered. SMS status: {tourist.smsStatus}</p>
              <a href={tourist.secureLink}>Open tourist link</a>
              <code>{tourist.secureLink}</code>
              {tourist.smsStatus === 'FAILED' && (
                <button type="button" className="button button--primary" onClick={() => void retrySms()} disabled={retryingSms}>
                  {retryingSms ? 'Retrying SMS…' : 'Retry failed SMS'}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="info-card operator-card" aria-labelledby="reports-title">
          <div className="operator-section-heading">
            <div>
              <p className="card-label">Step 4</p>
              <h2 id="reports-title">Tour reports</h2>
            </div>
            <button type="button" className="button button--quiet" onClick={() => void loadReports()} disabled={!tour || !operatorKey || reportsLoading}>
              {reportsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {!tour ? (
            <p className="form-hint">Create a tour first.</p>
          ) : reports.length === 0 ? (
            <p className="form-hint">No reports loaded for this tour. Select refresh to check.</p>
          ) : (
            <div className="report-list">
              {reports.map((report) => (
                <article className="operator-report" key={report.publicReference}>
                  <div className="operator-report-heading">
                    <strong>{report.type}</strong>
                    <span className={`report-status report-status--${report.status.toLowerCase()}`}>{report.status}</span>
                  </div>
                  <p>{report.note || 'No note provided.'}</p>
                  <small>Reported by {report.reporter.name} · {new Date(report.createdAt).toLocaleString()}</small>
                  {report.missingTourist && <small>Missing tourist: {report.missingTourist.name}</small>}
                  <div className="form-actions">
                    {report.status === 'OPEN' && <button type="button" className="button button--primary" onClick={() => void transitionReport(report.publicReference, 'acknowledge')} disabled={reportsLoading}>Acknowledge</button>}
                    {report.status === 'ACKNOWLEDGED' && <button type="button" className="button button--primary" onClick={() => void transitionReport(report.publicReference, 'resolve')} disabled={reportsLoading}>Resolve</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default OperatorDashboard;
