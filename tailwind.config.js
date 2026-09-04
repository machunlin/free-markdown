/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Colors are defined via CSS variables for theming.
        // Tailwind config provides semantic names that map to CSS vars.
        bg: {
          base: 'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
          surface: 'var(--bg-surface)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
          selected: 'var(--bg-selected)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
          link: 'var(--text-link)',
        },
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        info: 'var(--info)',
        editor: {
          bg: 'var(--editor-bg)',
          text: 'var(--editor-text)',
          gutter: 'var(--editor-gutter)',
          cursor: 'var(--editor-cursor)',
          selection: 'var(--editor-selection)',
        },
      },
      fontFamily: {
        ui: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Heiti SC"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"PingFang SC"',
          '"Microsoft YaHei Mono"',
          'monospace',
        ],
        body: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Noto Sans CJK SC"',
          'sans-serif',
        ],
        heading: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"PingFang SC"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      fontSize: {
        'ui': ['13px', '1.4'],
        'ui-sm': ['12px', '1.3'],
        'editor': ['14px', '1.6'],
        'preview': ['15px', '1.7'],
      },
      spacing: {
        toolbar: '52px',
        tabbar: '38px',
        statusbar: '24px',
        sidebar: '240px',
      },
    },
  },
  plugins: [],
};
