/**
 * Define the expected fixture data shape
 */
export interface FixtureModel extends Record<string, unknown> {
  id: number
  name: string
  emailAddress: string | null
}

export function byNameSorter(a: FixtureModel, b: FixtureModel) {
  return a.name.localeCompare(b.name)
}
