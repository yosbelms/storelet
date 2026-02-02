import { createElement, FC } from 'react'
import { renderHook, act } from '@testing-library/react'
import { createStore } from '../src/index'

// ── createStore ─────────────────────────────────────────────────────

describe('createStore', () => {
  it('returns an object with connect and useStore', () => {
    const store = createStore<number>(0)
    expect(store).toHaveProperty('connect')
    expect(store).toHaveProperty('useStore')
    expect(typeof store.connect).toBe('function')
    expect(typeof store.useStore).toBe('function')
  })

  it('accepts an initial state value', () => {
    const store = createStore<number>(42)
    const wrapper = buildWrapper(store.connect)
    const { result } = renderHook(() => store.useStore(), { wrapper })
    expect(result.current.state).toBe(42)
  })

  it('accepts an initial state factory function', () => {
    const store = createStore<number>(() => 99)
    const wrapper = buildWrapper(store.connect)
    const { result } = renderHook(() => store.useStore(), { wrapper })
    expect(result.current.state).toBe(99)
  })
})

// ── useStore without connect ────────────────────────────────────────

describe('useStore (without connect)', () => {
  it('throws when called outside a connect-wrapped tree', () => {
    const { useStore } = createStore<number>(0)
    // Suppress expected React error boundary noise
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useStore())
    }).toThrow('Component must be wrapped with "connect(...)"')
    spy.mockRestore()
  })
})

// ── useStore + connect (state reading) ──────────────────────────────

describe('useStore + connect (state reading)', () => {
  it('returns the initial state', () => {
    const { connect, useStore } = createStore<{ count: number }>({ count: 0 })
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })
    expect(result.current.state).toEqual({ count: 0 })
  })

  it('returns state from a factory function', () => {
    const { connect, useStore } = createStore(() => ({ name: 'test' }))
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })
    expect(result.current.state).toEqual({ name: 'test' })
  })
})

// ── update (single mutator) ────────────────────────────────────────

describe('update (single mutator)', () => {
  it('mutates state immutably and re-renders with new state', async () => {
    const { connect, useStore } = createStore<{ count: number }>({ count: 0 })
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })

    await act(async () => {
      await result.current.update((draft) => {
        draft.count = 5
      })
    })

    expect(result.current.state).toEqual({ count: 5 })
  })

  it('resolves the returned promise with the new state', async () => {
    const { connect, useStore } = createStore<{ count: number }>({ count: 0 })
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })

    let resolved: { count: number } | undefined
    await act(async () => {
      resolved = await result.current.update((draft) => {
        draft.count = 10
      })
    })

    expect(resolved).toEqual({ count: 10 })
  })

  it('provides oldState as second argument to the mutator', async () => {
    const { connect, useStore } = createStore<{ count: number }>({ count: 3 })
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })

    let capturedOldState: { count: number } | undefined
    await act(async () => {
      await result.current.update((draft, oldState) => {
        capturedOldState = oldState
        draft.count = oldState.count + 1
      })
    })

    expect(capturedOldState).toEqual({ count: 3 })
    expect(result.current.state).toEqual({ count: 4 })
  })
})

// ── update (multiple mutators / batching) ───────────────────────────

describe('update (multiple mutators / batching)', () => {
  it('applies multiple mutators in order, resolves with final state', async () => {
    const { connect, useStore } = createStore<{ count: number }>({ count: 0 })
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })

    let resolved: { count: number } | undefined
    await act(async () => {
      resolved = await result.current.update(
        (draft) => { draft.count += 1 },
        (draft) => { draft.count += 10 },
        (draft) => { draft.count += 100 },
      )
    })

    expect(resolved).toEqual({ count: 111 })
    expect(result.current.state).toEqual({ count: 111 })
  })
})

// ── listen callback ─────────────────────────────────────────────────

describe('listen callback', () => {
  it('is called on each state change with { newState, oldState, patches }', async () => {
    const listener = jest.fn()
    const { connect, useStore } = createStore<{ count: number }>({ count: 0 }, listener)
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })

    await act(async () => {
      await result.current.update((draft) => {
        draft.count = 1
      })
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        newState: { count: 1 },
        oldState: { count: 0 },
      }),
    )
  })

  it('patches array is populated (non-production environment)', async () => {
    const listener = jest.fn()
    const { connect, useStore } = createStore<{ count: number }>({ count: 0 }, listener)
    const wrapper = buildWrapper(connect)
    const { result } = renderHook(() => useStore(), { wrapper })

    await act(async () => {
      await result.current.update((draft) => {
        draft.count = 42
      })
    })

    const call = listener.mock.calls[0][0]
    expect(call.patches).toBeDefined()
    expect(Array.isArray(call.patches)).toBe(true)
    expect(call.patches.length).toBeGreaterThan(0)
  })
})

// ── Helper ──────────────────────────────────────────────────────────

function buildWrapper(connect: ReturnType<typeof createStore>['connect']): FC<{ children: React.ReactNode }> {
  const Inner: FC<{ children?: React.ReactNode }> = ({ children }) => createElement('div', null, children)
  const Connected = connect(Inner as any)
  return ({ children }) => createElement(Connected as any, null, children)
}
