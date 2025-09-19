/**
 * Define the expected fixture data shape
 */
export interface FixtureModel extends Record<string, unknown> {
  id: number
  name: string
  emailAddress: string
}
