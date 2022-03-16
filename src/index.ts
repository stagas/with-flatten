import { defineAccessors } from 'define-accessors'

export type Constructor<T> = new (...args: any[]) => T

// modified from: https://stackoverflow.com/a/69322301/175416
type Join<A, B> = {
  [K in keyof (A & B)]: K extends keyof A ? A[K] : K extends keyof B ? B[K] : never
}

// Returns R if T is a function, otherwise returns Fallback
type IsFunction<T, R, Fallback = T> = T extends (...args: any[]) => any ? R : Fallback

// Returns R if T is an object, otherwise returns Fallback
type IsObject<T, R, Fallback = T> = IsFunction<T, Fallback, T extends object ? R : Fallback>

// "a.b.c" => "b.c"
type Tail<S> = S extends `${string}.${infer T}` ? Tail<T> : S

// typeof Object.values(T)
type Value<T> = T[keyof T]

// {a: {b: 1, c: 2}} => {"a.b": {b: 1, c: 2}, "a.c": {b: 1, c: 2}}
type FlattenStepOne<T> = {
  [K in keyof T as K extends string
    ? IsObject<T[K], `${K}.${keyof T[K] & string}`, K>
    : K]: IsObject<T[K], { [key in keyof T[K]]: T[K][key] }>
}

// {"a.b": {b: 1, c: 2}, "a.c": {b: 1, c: 2}} => {"a.b": {b: 1}, "a.c": {c: 2}}
type FlattenStepTwo<T> = {
  [a in keyof T]: IsObject<
    T[a],
    Value<{ [M in keyof T[a] as M extends Tail<a> ? M : never]: T[a][M] }>
  >
}

// {a: {b: 1, c: {d: 1}}} => {"a.b": 1, "a.c": {d: 1}}
type FlattenOneLevel<T> = FlattenStepTwo<FlattenStepOne<T>>

// {a: {b: 1, c: {d: 1}}} => {"a.b": 1, "a.b.c.d": 1}
type Flatten<T> = T extends FlattenOneLevel<T> ? T : Join<T, Flatten<FlattenOneLevel<T>>>

// "a.b.c" => "abc"
type ToCamelCase<S> = S extends `${infer H}.${infer T}` ? ToCamelCase<`${H}${Capitalize<T>}`> : S

export type FlattenCamelCase<T> = { [K in keyof Flatten<T> as ToCamelCase<K>]: Flatten<T>[K] }

/**
 * Mixins `ctor` with `parent` and camelCase flattens
 * and observes its properties mapping them back to the actual values.
 * Best used in conjuction with https://github.com/stagas/with-properties
 *
 * ```ts
 * const Foo = withFlatten(
 *   SomeParent,
 *   class {
 *     deep = {
 *       foo: 2,
 *     }
 *   }
 * )
 * const foo = new Foo()
 * foo.deepFoo = 4
 * expect(foo.deep.foo).toBe(4)
 * ```
 */
export const withFlatten = <P extends Constructor<any>, T extends object>(
  parent: P,
  ctor: Constructor<T>
) =>
  class extends parent {
    constructor(...args: any[]) {
      super(...args)

      const self = this
      const data = new ctor() as any
      const paths = getPaths(data)

      const get = (path: string[]) => path.reduce((o, k) => o[k], data)
      const set = (path: string[], value: any) =>
        path.reduce((o, k, i, { length }) => (i === length - 1 ? (o[k] = value) : o[k]), data)

      // map paths omitting single level
      const map = mapPaths(paths.filter(x => x.length > 1))

      // create schema
      const schema = Object.fromEntries(
        [...map.entries()].map(([key, path]: [string, string[]]) => [key, get(path)])
      )

      // single level assigned as they are
      ;[...new Set(paths.map(x => x[0]))].forEach(key => (self[key] = data[key]))

      defineAccessors(self, schema, (key: any) => ({
        configurable: false,
        enumerable: true,
        get() {
          return get(map.get(key)!)
        },
        set(value: any) {
          const p = map.get(key)!
          set(p, value)
          ;(self as any).propertyChangedCallback?.(p[0], top, top)
        },
      }))
    }
  } as P & Constructor<FlattenCamelCase<T>>

const getPaths = (obj: any) => {
  const paths: string[][] = []
  const recurse = (obj: any, path: string[]) => {
    for (const key in obj) {
      const value = obj[key]
      const newPath = path.concat(key)
      if (typeof value === 'object') {
        paths.push(newPath)
        recurse(value, newPath)
      } else {
        paths.push(newPath)
      }
    }
  }
  recurse(obj, [])
  return paths
}

const mapPaths = (paths: string[][]) =>
  new Map(
    paths.map(path => {
      return [
        path[0] +
          path
            .slice(1)
            .map(p => p[0].toUpperCase() + p.slice(1))
            .join(''),
        path,
      ]
    })
  )
