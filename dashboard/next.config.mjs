const API = process.env.API_URL || 'http://localhost:3939';

export default {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/:path*` }];
  }
};
