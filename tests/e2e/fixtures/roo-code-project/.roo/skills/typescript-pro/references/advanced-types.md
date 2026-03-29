# Advanced TypeScript Types

## Conditional Types

```typescript
type IsArray<T> = T extends unknown[] ? true : false;
type NonNullable<T> = T extends null | undefined ? never : T;
```

## Infer keyword

```typescript
type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;
type ArrayElement<T> = T extends (infer E)[] ? E : never;
```

## Distributive Conditional Types

Conditional types distribute over union types automatically when the checked type is a naked type parameter.
