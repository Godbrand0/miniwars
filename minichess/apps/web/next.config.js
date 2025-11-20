/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    
    // Handle React Native modules for web
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': 'react-native-web-mock/async-storage'
      }
    }
    
    return config
  },
};

module.exports = nextConfig;
