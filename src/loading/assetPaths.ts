const baseUrl = import.meta.env.BASE_URL || '/';

export function assetUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  if (baseUrl === '' || baseUrl === './') return `./${cleanPath}`;
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${cleanPath}`;
}
