/**
 * Whether the analysis can actually run.
 *
 * Server-only, and deliberately its own module: the questionnaire components
 * import lib/analysis/config.ts on the client, and an environment read must
 * never end up in a client bundle where it would silently evaluate to
 * undefined.
 *
 * The entry points check this before offering the analysis at all. Without it,
 * the homepage's primary call to action would walk a visitor through twelve
 * questions and fail at the last step — which is worse than not offering it.
 * Adding the key turns the funnel on with no code change.
 */
export function isAnalysisAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}
