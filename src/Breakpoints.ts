import { MediaBreakpointProps } from "./Media"
import { createRuleSet, createClassName } from "./Utils"

/**
 * A union of possible breakpoint props.
 */
export type BreakpointConstraintKey = keyof MediaBreakpointProps

type ValueBreakpointPropsTuple<SizeValue, BreakpointKey> = [
  SizeValue,
  MediaBreakpointProps<BreakpointKey>
]

type Tuple = [string, string]

function breakpointKey(breakpoint: string | Tuple) {
  return Array.isArray(breakpoint) ? breakpoint.join("-") : breakpoint
}

export enum BreakpointConstraint {
  at = "at",
  lessThan = "lessThan",
  greaterThan = "greaterThan",
  greaterThanOrEqual = "greaterThanOrEqual",
  between = "between",
}

/**
 * Encapsulates all breakpoint data needed by the Media component. The data is
 * generated on initialization so no further runtime work is necessary.
 */
export class Breakpoints<BreakpointKey extends string> {
  static validKeys() {
    return [
      BreakpointConstraint.at,
      BreakpointConstraint.lessThan,
      BreakpointConstraint.greaterThan,
      BreakpointConstraint.greaterThanOrEqual,
      BreakpointConstraint.between,
    ]
  }

  private _sortedBreakpoints: ReadonlyArray<string>
  private _breakpoints: Record<string, number>
  private _mediaQueries: Record<BreakpointConstraint, Map<string, string>>

  constructor(breakpoints: { [key: string]: number }) {
    this._breakpoints = breakpoints

    this._sortedBreakpoints = Object.keys(breakpoints)
      .map(breakpoint => [breakpoint, breakpoints[breakpoint]])
      .sort((a, b) => (a[1] < b[1] ? -1 : 1))
      .map(breakpointAndValue => breakpointAndValue[0] as string)

    // List of all possible and valid `between` combinations
    const betweenCombinations = this._sortedBreakpoints
      .slice(0, -1)
      .reduce(
        (acc: Tuple[], b1, i) => [
          ...acc,
          ...this._sortedBreakpoints.slice(i + 1).map(b2 => [b1, b2] as Tuple),
        ],
        []
      )

    this._mediaQueries = {
      [BreakpointConstraint.at]: this._createBreakpointQueries(
        BreakpointConstraint.at,
        this._sortedBreakpoints
      ),
      [BreakpointConstraint.lessThan]: this._createBreakpointQueries(
        BreakpointConstraint.lessThan,
        this._sortedBreakpoints.slice(1)
      ),
      [BreakpointConstraint.greaterThan]: this._createBreakpointQueries(
        BreakpointConstraint.greaterThan,
        this._sortedBreakpoints.slice(0, -1)
      ),
      [BreakpointConstraint.greaterThanOrEqual]: this._createBreakpointQueries(
        BreakpointConstraint.greaterThanOrEqual,
        this._sortedBreakpoints
      ),
      [BreakpointConstraint.between]: this._createBreakpointQueries(
        BreakpointConstraint.between,
        betweenCombinations
      ),
    }
  }

  public get sortedBreakpoints() {
    return this._sortedBreakpoints as BreakpointKey[]
  }

  public get dynamicResponsiveMediaQueries() {
    return Array.from(
      this._mediaQueries[BreakpointConstraint.at].entries()
    ).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
  }

  public get largestBreakpoint() {
    return this._sortedBreakpoints[this._sortedBreakpoints.length - 1]
  }

  public findBreakpointsForWidths = (
    fromWidth: number,
    throughWidth: number
  ) => {
    const fromBreakpoint = this.findBreakpointAtWidth(fromWidth)
    if (!fromBreakpoint) {
      return undefined
    }
    const throughBreakpoint = this.findBreakpointAtWidth(throughWidth)
    if (!throughBreakpoint || fromBreakpoint === throughBreakpoint) {
      return [fromBreakpoint] as BreakpointKey[]
    } else {
      return this._sortedBreakpoints.slice(
        this._sortedBreakpoints.indexOf(fromBreakpoint),
        this._sortedBreakpoints.indexOf(throughBreakpoint) + 1
      ) as BreakpointKey[]
    }
  }

  public findBreakpointAtWidth = (width: number) => {
    return this._sortedBreakpoints.find((breakpoint, i) => {
      const nextBreakpoint = this._sortedBreakpoints[i + 1]
      if (nextBreakpoint) {
        return (
          width >= this._breakpoints[breakpoint] &&
          width < this._breakpoints[nextBreakpoint]
        )
      } else {
        return width >= this._breakpoints[breakpoint]
      }
    }) as BreakpointKey | undefined
  }

  public toVisibleAtBreakpointSet(breakpointProps: MediaBreakpointProps) {
    breakpointProps = this._normalizeProps(breakpointProps)
    if (breakpointProps.lessThan) {
      const breakpointIndex = this.sortedBreakpoints.findIndex(
        bp => bp === breakpointProps.lessThan
      )
      return this.sortedBreakpoints.slice(0, breakpointIndex)
    } else if (breakpointProps.greaterThan) {
      const breakpointIndex = this.sortedBreakpoints.findIndex(
        bp => bp === breakpointProps.greaterThan
      )
      return this.sortedBreakpoints.slice(breakpointIndex + 1)
    } else if (breakpointProps.greaterThanOrEqual) {
      const breakpointIndex = this.sortedBreakpoints.findIndex(
        bp => bp === breakpointProps.greaterThanOrEqual
      )
      return this.sortedBreakpoints.slice(breakpointIndex)
    } else if (breakpointProps.between) {
      const between = breakpointProps.between
      const fromBreakpointIndex = this.sortedBreakpoints.findIndex(
        bp => bp === between[0]
      )
      const toBreakpointIndex = this.sortedBreakpoints.findIndex(
        bp => bp === between[1]
      )
      return this.sortedBreakpoints.slice(
        fromBreakpointIndex,
        toBreakpointIndex
      )
    }
    return []
  }

  public toRuleSets(keys = Breakpoints.validKeys()) {
    const selectedMediaQueries = keys.reduce(
      (mediaQueries, query) => {
        mediaQueries[query] = this._mediaQueries[query]
        return mediaQueries
      },
      {} as Record<BreakpointConstraint, Map<string, string>>
    )

    return Object.entries(selectedMediaQueries).reduce(
      (acc: string[], [type, queries]) => {
        queries.forEach((query, breakpoint) => {
          // We need to invert the query, such that it matches when we want the
          // element to be hidden.
          acc.push(
            createRuleSet(
              createClassName(type, breakpoint),
              `not all and ${query}`
            )
          )
        })
        return acc
      },
      []
    )
  }

  public shouldRenderMediaQuery(
    breakpointProps: MediaBreakpointProps,
    onlyRenderAt: string[]
  ): boolean {
    breakpointProps = this._normalizeProps(breakpointProps)
    if (breakpointProps.lessThan) {
      const width = this._breakpoints[breakpointProps.lessThan]
      const lowestAllowedWidth = Math.min(
        ...onlyRenderAt.map(breakpoint => this._breakpoints[breakpoint])
      )
      return lowestAllowedWidth < width
    } else if (breakpointProps.greaterThan) {
      const width = this._breakpoints[
        this._findNextBreakpoint(breakpointProps.greaterThan)
      ]
      const highestAllowedWidth = Math.max(
        ...onlyRenderAt.map(breakpoint => this._breakpoints[breakpoint])
      )
      return highestAllowedWidth >= width
    } else if (breakpointProps.greaterThanOrEqual) {
      const width = this._breakpoints[breakpointProps.greaterThanOrEqual]
      const highestAllowedWidth = Math.max(
        ...onlyRenderAt.map(breakpoint => this._breakpoints[breakpoint])
      )
      return highestAllowedWidth >= width
    } else if (breakpointProps.between) {
      // TODO: This is the only useful breakpoint to negate, but we’ll
      //       we’ll see when/if we need it. We could then also decide
      //       to add `oustide`.
      const fromWidth = this._breakpoints[breakpointProps.between[0]]
      const toWidth = this._breakpoints[breakpointProps.between[1]]
      const allowedWidths = onlyRenderAt.map(
        breakpoint => this._breakpoints[breakpoint]
      )
      return !(
        Math.max(...allowedWidths) < fromWidth ||
        Math.min(...allowedWidths) >= toWidth
      )
    }
    return false
  }

  public valuesWithBreakpointProps = <SizeValue>(
    values: SizeValue[]
  ): Array<ValueBreakpointPropsTuple<SizeValue, BreakpointKey>> => {
    type ValueBreakpoints = [SizeValue, string[]]
    const max = values.length
    const valueBreakpoints: ValueBreakpoints[] = []
    let lastTuple: ValueBreakpoints
    this._sortedBreakpoints.forEach((breakpoint, i) => {
      const value = values[i]
      if (i < max && (!lastTuple || lastTuple[0] !== value)) {
        lastTuple = [value, [breakpoint]]
        valueBreakpoints.push(lastTuple)
      } else {
        lastTuple[1].push(breakpoint)
      }
    })

    return valueBreakpoints.map(([value, breakpoints], i) => {
      const props: MediaBreakpointProps<any> = {}
      if (i === valueBreakpoints.length - 1) {
        props.greaterThanOrEqual = breakpoints[0]
      } else if (breakpoints.length === 1) {
        props.at = breakpoints[0]
      } else {
        // TODO: This is less than ideal, would be good to have a `through`
        //       prop, which unlike `between` is inclusive.
        props.between = [breakpoints[0], valueBreakpoints[i + 1][1][0]]
      }
      return [value, props] as ValueBreakpointPropsTuple<
        SizeValue,
        BreakpointKey
      >
    })
  }

  private _normalizeProps(
    breakpointProps: MediaBreakpointProps
  ): MediaBreakpointProps {
    if (breakpointProps.at) {
      const fromIndex = this._sortedBreakpoints.indexOf(breakpointProps.at)
      const to = this._sortedBreakpoints[fromIndex + 1]
      return to
        ? { between: [breakpointProps.at, to] }
        : { greaterThanOrEqual: breakpointProps.at }
    }
    return breakpointProps
  }

  private _createBreakpointQuery(
    breakpointProps: MediaBreakpointProps
  ): string {
    breakpointProps = this._normalizeProps(breakpointProps)
    if (breakpointProps.lessThan) {
      const width = this._breakpoints[breakpointProps.lessThan]
      return `(max-width:${width - 0.02}px)`
    } else if (breakpointProps.greaterThan) {
      const width = this._breakpoints[
        this._findNextBreakpoint(breakpointProps.greaterThan)
      ]
      return `(min-width:${width}px)`
    } else if (breakpointProps.greaterThanOrEqual) {
      const width = this._breakpoints[breakpointProps.greaterThanOrEqual]
      return `(min-width:${width}px)`
    } else if (breakpointProps.between) {
      // TODO: This is the only useful breakpoint to negate, but we’ll
      //       we’ll see when/if we need it. We could then also decide
      //       to add `outside`.
      const fromWidth = this._breakpoints[breakpointProps.between[0]]
      const toWidth = this._breakpoints[breakpointProps.between[1]]
      return `(min-width:${fromWidth}px) and (max-width:${toWidth - 0.02}px)`
    }
    throw new Error(
      `Unexpected breakpoint props: ${JSON.stringify(breakpointProps)}`
    )
  }

  private _createBreakpointQueries(
    key: BreakpointConstraintKey,
    forBreakpoints: ReadonlyArray<string | [string, string]>
  ) {
    return forBreakpoints.reduce<Map<string, string>>((map, breakpoint) => {
      map.set(
        breakpointKey(breakpoint),
        this._createBreakpointQuery({
          [key]: breakpoint,
        })
      )
      return map
    }, new Map())
  }

  private _findNextBreakpoint(breakpoint: string) {
    const nextBreakpoint = this._sortedBreakpoints[
      this._sortedBreakpoints.indexOf(breakpoint) + 1
    ]
    if (!nextBreakpoint) {
      throw new Error(`There is no breakpoint larger than ${breakpoint}`)
    }
    return nextBreakpoint
  }
}
