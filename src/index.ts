import { create, Draft, Patch } from 'mutative'
import pDefer, { DeferredPromise } from 'p-defer'
import { ComponentType, createContext, createElement, useContext, useState } from 'react'

// Example:
// const { connect, useStore } = createStore()
// const { state, update } = useStore()

type Mutator<State> = (state: Draft<State>, oldState: State) => void
type Update<State> = (...mutators: Mutator<State>[]) => PromiseLike<State>
type ListenData<State> = {
  newState: State,
  oldState: State,
  patches: Patch[]
}

interface MutatorQueueItem<State> {
  mutator: Mutator<State>
  deferredPromise?: DeferredPromise<State>
}

interface StoreContext<State> {
  state: State
  hasProvider: boolean
  setState: (state: State) => void
  mutatorsQueue: MutatorQueueItem<State>[]
  isFlushing: boolean
  add(mutator: Mutator<State>, deferredPromise?: DeferredPromise<State>): void
  flush(): void
}

export const createStore = <State>(
  initialState?: State | (() => State),
  listen?: (data: ListenData<State>) => void,
) => {
  const stateReader: () => State = typeof initialState === 'function'
    ? initialState as () => State
    : () => initialState as State

  const ContextBase: StoreContext<State> = {
    state: stateReader(),
    hasProvider: false,
    setState: () => {},
    mutatorsQueue: [],
    isFlushing: false,

    add(mutator: Mutator<State>, deferredPromise?: DeferredPromise<State>) {
      this.mutatorsQueue.push({ mutator, deferredPromise })
      this.flush()
    },

    flush() {
      if (this.isFlushing) return
      while (this.mutatorsQueue.length) {
        this.isFlushing = true
        const { mutator, deferredPromise } = this.mutatorsQueue.shift()!
        let patches: Patch[] = []
        let newState: State

        if (process.env.APP_ENV !== 'production') {
          [newState, patches] = create(
            this.state,
            (draft) => { mutator(draft, this.state) },
            { enablePatches: true }
          )
        } else {
          newState = create(
            this.state,
            (draft) => { mutator(draft, this.state) }
          )
        }

        if (typeof listen === 'function') {
          listen({ newState, oldState: this.state, patches })
        }

        this.state = newState

        deferredPromise?.resolve(newState)
        this.setState(this.state)
      }
      this.isFlushing = false
    }
  }

  const Context = createContext<StoreContext<State>>({
    ...ContextBase,
  })

  const useStore = (): { state: State, update: Update<State> } => {
    const context = useContext(Context)
    const { state, hasProvider } = context

    if (!hasProvider) {
      throw new Error('Component must be wrapped with "connect(...)"')
    }

    const update: Update<State> = (...mutators) => {
      const deferredPromise = pDefer<State>()
      mutators.forEach((mutator, idx) => {
        if (idx === mutators.length - 1) {
          context.add(mutator, deferredPromise)
        } else {
          context.add(mutator)
        }
      })
      return deferredPromise.promise
    }

    return { state, update }
  }

  const connect = <P extends Record<string, unknown>>(Cmp: ComponentType<P>): ComponentType<P> => {
    return (props: P) => {
      const [state, setState] = useState<State>(stateReader)
      const value: StoreContext<State> = {
        ...ContextBase,
        state,
        setState,
        hasProvider: true,
      }

      return createElement(Context.Provider, { value },
        createElement(Cmp, props))
    }
  }

  return { connect, useStore }
}
