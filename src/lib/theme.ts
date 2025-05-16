// Child-friendly theme configuration

export const childFriendlyTheme = {
  colors: {
    // Primary colors
    primary: {
      light: '#4A6FFF', // Bright blue - trustworthy, calm
      dark: '#738FFF',
    },
    secondary: {
      light: '#FF8A65', // Coral - warm, energetic
      dark: '#FF9D80',
    },
    accent: {
      light: '#FFD166', // Sunny yellow - cheerful, optimistic
      dark: '#FFD980',
    },

    // Status colors
    success: {
      light: '#66BB6A', // Friendly green
      dark: '#81C784',
    },
    warning: {
      light: '#FFCA28', // Soft amber
      dark: '#FFD54F',
    },
    destructive: {
      light: '#FF5252', // Soft red - less harsh than traditional red
      dark: '#FF7373',
    },

    // Background and text
    background: {
      light: '#FFFFFF',
      dark: '#121212',
    },
    foreground: {
      light: '#333333',
      dark: '#a3cef1',
    },

    // UI elements
    card: {
      light: '#FFFFFF',
      dark: '#1E1E1E',
    },
    muted: {
      light: '#a3cef1',
      dark: '#2A2A2A',
    },
    border: {
      light: '#E5E5E5',
      dark: '#404040',
    },
  },

  // More rounded corners for child-friendly UI
  borderRadius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  },

  // Animation settings
  animation: {
    default: 'all 0.2s ease',
    fast: 'all 0.1s ease',
    slow: 'all 0.3s ease',
  },

  // Font settings
  fonts: {
    primary: 'Nunito, Arial, Helvetica, sans-serif',
    heading: 'Nunito, Arial, Helvetica, sans-serif',
    body: 'Nunito, Arial, Helvetica, sans-serif',
  },

  // Font sizes
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
};
