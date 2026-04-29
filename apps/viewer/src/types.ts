export interface LogoEntry {
  /** Backend fileId from /api/logos/upload. "preloaded" for URL-param logos without a backend ID. */
  id: string;
  url: string;
  name: string;
}

export interface TextEntry {
  id: string;
  text: string;
}
