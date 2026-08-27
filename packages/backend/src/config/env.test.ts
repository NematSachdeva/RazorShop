describe('Environment Configuration', () => {
  it('should load environment variables from .env file', () => {
    // env.ts loads .env on module import
    // The root .env should be found automatically
    const { getEnv } = require('./env.js');
    const env = getEnv();
    
    // If these assertions pass, it means .env was successfully loaded
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
  });

  it('should parse PORT as a number', () => {
    const { getEnv } = require('./env.js');
    const env = getEnv();
    expect(typeof env.PORT).toBe('number');
  });

  it('should set NODE_ENV to a valid value', () => {
    const { getEnv } = require('./env.js');
    const env = getEnv();
    expect(['development', 'production', 'test']).toContain(env.NODE_ENV);
  });
});

