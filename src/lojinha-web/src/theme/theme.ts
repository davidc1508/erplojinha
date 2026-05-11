import { createTheme } from '@mui/material';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d96b87',
      light: '#f5b2c5',
      dark: '#a54b62'
    },
    secondary: {
      main: '#7bcfc0',
      light: '#b4ebe2',
      dark: '#4c9f93'
    },
    background: {
      default: '#fffaf6',
      paper: 'rgba(255, 252, 249, 0.92)'
    },
    success: {
      main: '#79a95f'
    },
    warning: {
      main: '#e1a657'
    },
    text: {
      primary: '#473328',
      secondary: '#7d6558'
    }
  },
  typography: {
    fontFamily: 'Nunito, sans-serif',
    h3: {
      fontFamily: 'Baloo 2, cursive',
      fontWeight: 700
    },
    h4: {
      fontFamily: 'Baloo 2, cursive',
      fontWeight: 700
    },
    h5: {
      fontFamily: 'Baloo 2, cursive',
      fontWeight: 700
    },
    h6: {
      fontFamily: 'Baloo 2, cursive',
      fontWeight: 700
    },
    button: {
      textTransform: 'none',
      fontWeight: 700
    }
  },
  shape: {
    borderRadius: 20
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(217, 107, 135, 0.12)',
          boxShadow: '0 18px 50px rgba(217, 107, 135, 0.12)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18
        }
      }
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'separate',
          borderSpacing: 0,
          width: '100%',
          '@media (max-width:900px)': {
            minWidth: 720
          }
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          width: '100%',
          overflowX: 'auto'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 14,
          paddingRight: 14,
          lineHeight: 1.4,
          overflow: 'visible',
          borderBottom: '1px solid rgba(217, 107, 135, 0.14)'
        },
        head: {
          fontWeight: 700,
          borderBottom: '1px solid rgba(217, 107, 135, 0.24)'
        }
      }
    }
  }
});