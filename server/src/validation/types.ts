export type Schema<T> = {
  parse: (input: unknown, req?: unknown) => T;
};
