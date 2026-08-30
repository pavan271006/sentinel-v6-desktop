/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          app: 'var(--bg-app)',
          panel: 'var(--bg-panel)',
          'panel-elevated': 'var(--bg-panel-elevated)',
          'panel-hover': 'var(--bg-panel-hover)',
          input: 'var(--bg-input)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        accent: {
          cyan: 'var(--accent-cyan)',
          blue: 'var(--accent-blue)',
          purple: 'var(--accent-purple)',
          green: 'var(--accent-green)',
        },
        severity: {
          critical: 'var(--severity-critical)',
          'critical-bg': 'var(--severity-critical-bg)',
          high: 'var(--severity-high)',
          'high-bg': 'var(--severity-high-bg)',
          medium: 'var(--severity-medium)',
          'medium-bg': 'var(--severity-medium-bg)',
          low: 'var(--severity-low)',
          'low-bg': 'var(--severity-low-bg)',
          info: 'var(--severity-info)',
          'info-bg': 'var(--severity-info-bg)',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        'panel': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.6)',
        'dropdown': '0 6px 20px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
