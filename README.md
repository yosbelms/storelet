# storelet

Lightweight state management for React, powered by [Mutative](https://mutative.js.org/).

## Features

- Immutable state updates via mutable draft syntax (Mutative)
- Automatic batching of multiple mutations
- Promise-based update API
- Patch tracking in development mode
- Optional listener for state change observation

## Install

```bash
npm install storelet
```

`react` is a peer dependency and must be installed in your project.

## Usage

### Create a store

```typescript
import { createStore } from 'storelet'

interface AppState {
  count: number
  todos: string[]
}

const { connect, useStore } = createStore<AppState>({
  count: 0,
  todos: [],
})
```

### Wrap your root component with `connect`

```tsx
const App = connect(() => {
  return <Counter />
})
```

### Access state and dispatch updates with `useStore`

```tsx
function Counter() {
  const { state, update } = useStore()

  const increment = () => {
    update((draft) => {
      draft.count += 1
    })
  }

  return <button onClick={increment}>{state.count}</button>
}
```

### Batch multiple mutations

Pass multiple mutators to `update` to batch them into a single render cycle:

```typescript
update(
  (draft) => { draft.count += 1 },
  (draft) => { draft.todos.push('new todo') },
)
```

### Async updates

`update` returns a promise that resolves with the new state:

```typescript
const newState = await update((draft) => {
  draft.count += 1
})
console.log(newState.count)
```

### Listen to state changes

Pass a listener as the second argument to `createStore` to observe every state change:

```typescript
const { connect, useStore } = createStore<AppState>(
  { count: 0, todos: [] },
  ({ newState, oldState, patches }) => {
    console.log('State changed:', oldState, '->', newState)
    console.log('Patches:', patches) // available when APP_ENV !== 'production'
  },
)
```

## API

### `createStore<State>(initialState?, listen?)`

Creates a new store instance.

| Parameter | Type | Description |
|---|---|---|
| `initialState` | `State \| () => State` | Initial state value or factory function |
| `listen` | `(data: ListenData<State>) => void` | Optional callback invoked on each state change |

Returns `{ connect, useStore }`.

### `connect(Component)`

Higher-order component that provides the store context. Must wrap any component tree that uses `useStore`.

### `useStore()`

Hook that returns `{ state, update }`. Must be called inside a component wrapped with `connect`.

- **`state`** — current state value
- **`update(...mutators)`** — accepts one or more mutator functions `(draft, oldState) => void` and returns a `PromiseLike<State>` that resolves with the new state

## License

ISC
