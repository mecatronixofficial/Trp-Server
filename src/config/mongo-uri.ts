export function getMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  const uri =
    env.MONGODB_URI ||
    env.MONGO_URI ||
    'mongodb://localhost:27017/tiruppur_ice';
  const directHosts = env.MONGO_DIRECT_HOSTS?.trim();

  if (!directHosts || !uri.startsWith('mongodb+srv://')) {
    return uri;
  }

  const parsed = new URL(uri);
  const params = new URLSearchParams(parsed.searchParams);
  params.delete('appName');
  params.set('tls', 'true');
  params.set('authSource', env.MONGO_AUTH_SOURCE || 'admin');

  if (env.MONGO_REPLICA_SET) {
    params.set('replicaSet', env.MONGO_REPLICA_SET);
  }

  return `mongodb://${parsed.username}:${parsed.password}@${directHosts}${parsed.pathname || '/'}?${params}`;
}
