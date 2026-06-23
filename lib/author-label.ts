export function authorLabel(author: {
  displayName: string;
  twitterHandle: string;
}) {
  return `${author.displayName} (@${author.twitterHandle})`;
}
