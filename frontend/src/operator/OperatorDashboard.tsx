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
  tourId?: string;
  tour?: { name: string };
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
  const [operatorUnlocked, setOperatorUnlocked] = useState(false);
  const [activePage, setActivePage] = useState<'overview' | 'setup' | 'reports' | 'tourists'>('overview');
  const [guide, setGuide] = useState<Guide | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [tourist, setTourist] = useState<Tourist | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [tourists, setTourists] = useState<Tourist[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
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
      setGuides((current) => [created, ...current]);
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
      setTours((current) => [created, ...current]);
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
      setTourists((current) => [created, ...current]);
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

  async function loadExistingData() {
    setLoadingData(true);
    setError(null);
    try {
      const operator = apiClient.withOperatorKey(operatorKey);
      const [guideResponse, tourResponse, touristResponse] = await Promise.all([
        operator.request<{ data: Guide[] }>('/guides'),
        operator.request<{ data: Tour[] }>('/tours'),
        operator.request<{ data: Tourist[] }>('/tourists'),
      ]);
      setGuides(guideResponse.data);
      setTours(tourResponse.data);
      setTourists(touristResponse.data);
      setGuide((current) => current ?? guideResponse.data[0] ?? null);
      setTour((current) => current ?? tourResponse.data[0] ?? null);
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'Existing operator data could not be loaded.');
    } finally {
      setLoadingData(false);
    }
  }

  function unlockOperatorArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operatorKey.trim()) setOperatorUnlocked(true);
  }

  if (!operatorUnlocked) {
    return (
      <main className="operator-login-shell">
        <section className="operator-login-card">
          <div className="operator-brand-mark">TG</div>
          <p className="eyebrow">TourGuard Operations</p>
          <h1>Welcome back.</h1>
          <p className="status-copy">Enter your operator key to manage tours, tourists, and safety reports.</p>
          <form className="operator-login-form" onSubmit={unlockOperatorArea}>
            <label htmlFor="operator-key">Operator key</label>
            <input
              id="operator-key"
              type="password"
              value={operatorKey}
              onChange={(event) => setOperatorKey(event.target.value)}
              placeholder="Enter your operator key"
              autoComplete="off"
              autoFocus
            />
            <button type="submit" className="button button--primary" disabled={!operatorKey.trim()}>
              Enter dashboard
            </button>
          </form>
          <p className="form-hint">Your key stays in memory and is cleared when this page is closed.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="operator-app">
      <aside className="operator-sidebar">
        <div className="operator-sidebar-brand">
          <span className="operator-brand-mark operator-brand-mark--small">TG</span>
          <span>TourGuard</span>
        </div>
        <p className="operator-sidebar-label">Operations</p>
        <nav aria-label="Operator navigation">
          {([
            ['overview', 'Overview'],
            ['setup', 'Tour setup'],
            ['reports', 'Reports'],
            ['tourists', 'Tourists'],
          ] as const).map(([page, label]) => (
            <button key={page} type="button" className={`sidebar-link ${activePage === page ? 'sidebar-link--active' : ''}`} onClick={() => setActivePage(page)}>
              <span className="sidebar-dot" />
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className="sidebar-signout" onClick={() => { setOperatorUnlocked(false); setOperatorKey(''); }}>
          Lock dashboard
        </button>
      </aside>

      <div className="operator-main">
        <header className="operator-topbar">
          <div>
            <p className="operator-kicker">Operations console</p>
            <h1>{activePage === 'overview' ? 'Good to see you.' : activePage === 'setup' ? 'Tour setup' : activePage === 'reports' ? 'Safety reports' : 'Tourists'}</h1>
          </div>
          <button type="button" className="button button--quiet" onClick={() => void loadExistingData()} disabled={loadingData}>
            {loadingData ? 'Refreshing…' : 'Refresh data'}
          </button>
        </header>

        <div className="operator-dashboard">
          {activePage === 'overview' && (
            <section className="operator-overview">
              <div className="overview-hero">
                <div>
                  <p className="card-label">TourGuard operations</p>
                  <h2>Keep every tour moving safely.</h2>
                  <p>Set up your next tour, register tourists, and stay ready to respond to safety reports.</p>
                </div>
                <button type="button" className="button button--primary" onClick={() => setActivePage('setup')}>Set up a tour</button>
              </div>
              <div className="overview-stats">
                <div><strong>{guides.length}</strong><span>Guides loaded</span></div>
                <div><strong>{tours.length}</strong><span>Tours loaded</span></div>
                <div><strong>{tourists.length}</strong><span>Tourists loaded</span></div>
                <div><strong>{reports.length}</strong><span>Reports loaded</span></div>
              </div>
              <section className="info-card overview-note">
                <p className="card-label">Quick start</p>
                <p>Use <strong>Refresh data</strong> to load existing records, or start with Tour setup to create a guide, tour, and tourist link.</p>
              </section>
            </section>
          )}

        {activePage === 'setup' && <>
        <section className="info-card operator-key-card operator-session-card">
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
          <button type="button" className="button button--quiet" onClick={() => void loadExistingData()} disabled={!operatorKey || loadingData}>
            {loadingData ? 'Loading existing data…' : 'Load existing data'}
          </button>
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
            <label htmlFor="existing-guide">Assigned guide</label>
            <select
              id="existing-guide"
              value={guide?.publicReference ?? ''}
              onChange={(event) => setGuide(guides.find((candidate) => candidate.publicReference === event.target.value) ?? null)}
              required
            >
              <option value="">Select a guide</option>
              {guides.map((candidate) => <option key={candidate.publicReference} value={candidate.publicReference}>{candidate.name} · {candidate.phone}</option>)}
            </select>
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
            <label htmlFor="existing-tour">Tour</label>
            <select
              id="existing-tour"
              value={tour?.id ?? ''}
              onChange={(event) => setTour(tours.find((candidate) => candidate.id === event.target.value) ?? null)}
              required
            >
              <option value="">Select a tour</option>
              {tours.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
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
          {tourists.length > 0 && (
            <div className="operator-list-summary">
              <strong>Registered tourists ({tourists.length})</strong>
              {tourists.slice(0, 5).map((candidate) => <small key={candidate.publicReference}>{candidate.name} · {candidate.smsStatus}</small>)}
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
        </>}

        {activePage === 'reports' && (
          <section className="info-card operator-card" aria-labelledby="reports-page-title">
            <div className="operator-section-heading">
              <div><p className="card-label">Safety operations</p><h2 id="reports-page-title">Tour reports</h2></div>
              <button type="button" className="button button--quiet" onClick={() => void loadReports()} disabled={!tour || !reports.length && reportsLoading}>
                Refresh reports
              </button>
            </div>
            {!tour ? <p className="form-hint">Load existing data and select a tour from Tour setup first.</p> : reports.length === 0 ? <p className="form-hint">No reports loaded for the selected tour. Use Tour setup to refresh reports.</p> : <div className="report-list">{reports.map((report) => <article className="operator-report" key={report.publicReference}><div className="operator-report-heading"><strong>{report.type}</strong><span className={`report-status report-status--${report.status.toLowerCase()}`}>{report.status}</span></div><p>{report.note || 'No note provided.'}</p><small>Reported by {report.reporter.name} · {new Date(report.createdAt).toLocaleString()}</small>{report.missingTourist && <small>Missing tourist: {report.missingTourist.name}</small>}<div className="form-actions">{report.status === 'OPEN' && <button type="button" className="button button--primary" onClick={() => void transitionReport(report.publicReference, 'acknowledge')} disabled={reportsLoading}>Acknowledge</button>}{report.status === 'ACKNOWLEDGED' && <button type="button" className="button button--primary" onClick={() => void transitionReport(report.publicReference, 'resolve')} disabled={reportsLoading}>Resolve</button>}</div></article>)}</div>}
          </section>
        )}

        {activePage === 'tourists' && (
          <>
            <section className="info-card operator-card" aria-labelledby="add-tourist-title">
              <p className="card-label">Add to a tour</p>
              <h2 id="add-tourist-title">Register another tourist</h2>
              <form className="operator-form" onSubmit={createTourist}>
                <label htmlFor="tourist-page-tour">Tour</label>
                <select
                  id="tourist-page-tour"
                  value={tour?.id ?? ''}
                  onChange={(event) => setTour(tours.find((candidate) => candidate.id === event.target.value) ?? null)}
                  required
                >
                  <option value="">Select a tour</option>
                  {tours.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                </select>
                <label htmlFor="tourist-page-name">Tourist name</label>
                <input id="tourist-page-name" name="name" required placeholder="Tourist name" />
                <label htmlFor="tourist-page-phone">Tourist phone</label>
                <input id="tourist-page-phone" name="phone" required placeholder="+254712345678" />
                <button className="button button--primary" disabled={!tour || busy !== null}>
                  {busy === 'tourist' ? 'Registering…' : 'Register tourist'}
                </button>
              </form>
              {!tour && <p className="form-hint">Load data and select a tour first.</p>}
            </section>

            <section className="info-card operator-card" aria-labelledby="tourists-page-title">
              <p className="card-label">People on your tours</p>
              <h2 id="tourists-page-title">Registered tourists</h2>
              {tourists.length === 0 ? <p className="form-hint">No tourists loaded. Select Refresh data to load records.</p> : <div className="tourist-table">{tourists.map((candidate) => <div className="tourist-row" key={candidate.publicReference}><div><strong>{candidate.name}</strong><small>{candidate.phone} · {candidate.tour?.name ?? candidate.tourId}</small></div><span className={`report-status report-status--${candidate.smsStatus.toLowerCase()}`}>{candidate.smsStatus}</span></div>)}</div>}
            </section>
          </>
        )}
      </div>
      </div>
    </main>
  );
}

export default OperatorDashboard;
