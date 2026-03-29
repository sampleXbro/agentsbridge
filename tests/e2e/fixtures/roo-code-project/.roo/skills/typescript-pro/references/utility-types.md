# Utility Types

## Built-in utilities

| Type | Description |
|------|-------------|
| `Partial<T>` | All properties optional |
| `Required<T>` | All properties required |
| `Readonly<T>` | All properties readonly |
| `Pick<T, K>` | Select subset of properties |
| `Omit<T, K>` | Exclude subset of properties |
| `Record<K, V>` | Construct object type with known keys |

## Custom utilities

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```
