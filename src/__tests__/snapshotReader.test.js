import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSnapshotReader } from '../hooks/useSnapshotReader';

// Mock fetch globally
global.fetch = vi.fn();

describe('useSnapshotReader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads snapshot and computes regime correctly', async () => {
    const mockSnapshot = {
      date: '2026-07-23',
      vix: { current: 12, ma20: 14, percentile: 25 },
      spx: { current: 5000, ma50: 4800, ma200: 4500 },
      breadth: { nyaChangePercent: 0.5 }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSnapshot
    });

    const { result } = renderHook(() => useSnapshotReader());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.regime).toBe('BULL_QUIET');
    expect(result.current.riskScore).toBe(5);
    expect(result.current.circuitBreaker).toBe(false);
    expect(result.current.snapshot).toEqual(mockSnapshot);
  });

  it('handles CRISIS regime correctly', async () => {
    const mockSnapshot = {
      date: '2026-07-23',
      vix: { current: 35, ma20: 25, percentile: 95 },
      spx: { current: 4000, ma50: 4100, ma200: 4200 },
      breadth: { nyaChangePercent: -1 }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSnapshot
    });

    const { result } = renderHook(() => useSnapshotReader());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.regime).toBe('CRISIS');
    expect(result.current.riskScore).toBe(95);
    expect(result.current.circuitBreaker).toBe(true);
  });

  it('falls back to safe defaults on fetch error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSnapshotReader());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.regime).toBe('BULL_QUIET');
    expect(result.current.riskScore).toBe(50);
    expect(result.current.circuitBreaker).toBe(false);
  });

  it('falls back on 404 response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const { result } = renderHook(() => useSnapshotReader());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('404');
    expect(result.current.regime).toBe('BULL_QUIET');
  });
});
