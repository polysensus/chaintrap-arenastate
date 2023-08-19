/**
 * Convert snake case strings like foo_bar_baz to fooBarBaz.
 *
 * Pass true for optional parameter capitolize to get FooBarBaz
 *
 * @param {string} snakeCase  foo_bar snake case like string
 * @param {boolean} capitolize pass 'true' to get FooBar rather than fooBar
 */
export function titleCase(snakeCase, capitolize = false) {
  const parts = snakeCase.split("_");
  let titleCased = parts
    .map((word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase())
    .join("");
  if (!capitolize) titleCased.charAt(0).toLowerCase();
  return titleCased;
}
