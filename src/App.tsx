import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Login } from './pages/Login';
import { Billing } from './pages/Billing';
import { ProtectedRoute } from './components/ProtectedRoute';
import './styles/globals.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#26306B',
    },
    secondary: {
      main: '#F2A03D',
    },
    background: {
      default: '#ECEAE3',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1B1F3B',
      secondary: '#5F6478',
    },
  },
  typography: {
    fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(27, 31, 59, 0.1)',
          borderRadius: '8px',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/billing"
            element={
              <ProtectedRoute requiredRoles={['cashier', 'owner', 'manager']}>
                <Billing />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/billing" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
