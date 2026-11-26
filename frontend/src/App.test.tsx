import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('frontend foundation', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders the TourGuard welcome shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /your calm companion/i })).toBeInTheDocument();
    expect(screen.getByText(/tour details, guide contact/i)).toBeInTheDocument();
  });

  it('loads the authenticated tourist context from a secure link', async () => {
    window.history.replaceState({}, '', '/tourist/secret-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({
        status: 'ok',
        data: {
          name: 'Demo Tourist',
          phone: '+254712345678',
          publicReference: 'a'.repeat(32),
          tour: {
            name: 'Nairobi City Tour',
            description: 'A guided city tour.',
            meetingPoint: 'Kenya National Archives',
            startAt: '2026-12-01T08:00:00.000Z',
            endAt: '2026-12-01T12:00:00.000Z',
            guide: { name: 'Demo Guide', phone: '+254700000001' },
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    render(<App />);

    expect(await screen.findByRole('heading', { name: /welcome, demo tourist/i })).toBeInTheDocument();
    expect(screen.getByText('Kenya National Archives')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+254700000001' })).toHaveAttribute(
      'href',
      'tel:+254700000001',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it('offers a confirmation flow for a lost report', async () => {
    window.history.replaceState({}, '', '/tourist/secret-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        data: {
          name: 'Demo Tourist', phone: '+254712345678', publicReference: 'a'.repeat(32),
          tour: {
            name: 'Nairobi City Tour', description: 'A guided city tour.', meetingPoint: 'Archives',
            startAt: '2026-12-01T08:00:00.000Z', endAt: '2026-12-01T12:00:00.000Z',
            guide: { name: 'Demo Guide', phone: '+254700000001' },
          },
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        data: { publicReference: 'b'.repeat(32), type: 'LOST', status: 'OPEN', createdAt: new Date().toISOString() },
      }), { status: 201 }));

    render(<App />);
    expect(await screen.findByRole('heading', { name: /welcome, demo tourist/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /i’m lost/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm lost report/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/lost report is open/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it('loads context when rendered under React StrictMode', async () => {
    window.history.replaceState({}, '', '/tourist/strict-mode-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({
        status: 'ok',
        data: {
          name: 'Strict Mode Tourist', phone: '+254712345678', publicReference: 'a'.repeat(32),
          tour: {
            name: 'Strict Mode Tour', description: 'A guided city tour.', meetingPoint: 'Archives',
            startAt: '2026-12-01T08:00:00.000Z', endAt: '2026-12-01T12:00:00.000Z',
            guide: { name: 'Demo Guide', phone: '+254700000001' },
          },
        },
      }), { status: 200 }),
    ));

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', { name: /welcome, strict mode tourist/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
