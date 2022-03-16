import { withProperties } from 'with-properties'
import { withFlatten } from '../src'

let x = 0

describe('withFlatten(ctor)', () => {
  it('creates new constructor with flattened properties', () => {
    const results: any = []
    const Foo = withFlatten(
      class {
        propertyChangedCallback(key: any) {
          results.push(key)
        }
      },
      class {
        top = 1
        deep = {
          foo: 2,
          bar: {
            x: 1,
            y: 2,
          },
        }
      }
    )
    const foo = new Foo()
    foo.deepFoo = 4
    expect(results).toMatchSnapshot()
  })

  it('in conjuction with withProperties', () => {
    const results: any = []
    const Foo = class extends withProperties(
      HTMLElement,
      withFlatten(
        class {
          regular = Number
        },
        class {
          top = 1
          deep = {
            foo: 2,
            bar: {
              x: 1,
              y: 2,
            },
          }
        }
      )
    ) {
      propertyChangedCallback(key: any) {
        results.push(key)
      }
    }
    customElements.define('x-foo' + ++x, Foo)
    const foo = new Foo()

    foo.deepFoo = 4
    expect(results).toMatchSnapshot()
    expect(foo.deep.foo).toBe(4)

    foo.setAttribute('deep-foo', '5')
    expect(foo.deep.foo).toBe(5)

    foo.setAttribute('regular', '123')
    expect(foo.regular).toBe(123)

    foo.setAttribute('deepbarx', '42')
    expect(foo.deep.bar.x).toBe(42)
    expect(results).toMatchSnapshot()

    foo.setAttribute('deepbarx', '42')
    expect(results).toMatchSnapshot()

    foo.deepBar = { x: 6, y: 9 }
    expect(results).toMatchSnapshot()
    expect(foo.deep.bar.x).toBe(6)
    expect(foo.deep.bar.y).toBe(9)
  })
})
