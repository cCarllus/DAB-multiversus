process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '4000';
process.env.DATABASE_URL ??=
  'postgresql://dab:dab_local_password@127.0.0.1:5432/dab_auth_test';
process.env.ACCESS_TOKEN_SECRET ??= 'test-access-token-secret-with-32-chars';
process.env.ACCESS_TOKEN_TTL_MINUTES ??= '15';
process.env.REMEMBER_SESSION_DAYS ??= '30';
process.env.SESSION_TOKEN_TTL_HOURS ??= '12';
process.env.ALLOWED_ORIGINS ??= 'http://127.0.0.1:5173,http://localhost:5173,null';
