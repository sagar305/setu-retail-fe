import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

const FeedbackContext = createContext(null);

export const useFeedback = () => useContext(FeedbackContext);

// App-wide replacement for window.alert / window.confirm:
//   const { toast, confirm } = useFeedback();
//   toast('Saved', 'success');
//   if (await confirm({ message: 'Delete this?', danger: true })) { ... }
export const FeedbackProvider = ({ children }) => {
  const [snack, setSnack] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const resolverRef = useRef(null);

  const toast = useCallback((message, severity = 'success') => {
    setSnack({ message, severity, key: Date.now() });
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConfirmState({
        title: 'Are you sure?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        ...options,
      });
    });
  }, []);

  const handleConfirmClose = (result) => {
    setConfirmState(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <Snackbar
        key={snack?.key}
        open={Boolean(snack)}
        autoHideDuration={3500}
        onClose={(e, reason) => reason !== 'clickaway' && setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert
            onClose={() => setSnack(null)}
            severity={snack.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snack.message}
          </Alert>
        ) : null}
      </Snackbar>

      <Dialog open={Boolean(confirmState)} onClose={() => handleConfirmClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmState?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmState?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirmClose(false)}>{confirmState?.cancelText}</Button>
          <Button
            variant="contained"
            color={confirmState?.danger ? 'error' : 'primary'}
            onClick={() => handleConfirmClose(true)}
            autoFocus
          >
            {confirmState?.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
};
