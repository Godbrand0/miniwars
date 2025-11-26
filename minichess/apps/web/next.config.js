/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    
    // Handle React Native modules for web
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        "crypto": false,
        "stream": false,
        "assert": false,
        "http": false,
        "https": false,
        "os": false,
        "url": false
      }
    }
    
    // Ignore React Native modules that aren't needed for web
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': 'react-native-web',
      'react-native-vector-icons': 'react-native-vector-icons/dist',
      // Mock AsyncStorage for web environment
      '@react-native-async-storage/async-storage': false,
    }
    
    return config
  },
};

module.exports = nextConfig;
