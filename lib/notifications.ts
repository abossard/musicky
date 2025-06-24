import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconExclamationMark, IconInfoCircle } from '@tabler/icons-react';
import { createElement } from 'react';

export interface NotificationConfig {
  title?: string;
  message: string;
  autoClose?: number | false;
  withCloseButton?: boolean;
}

// Success notification (green)
export function showSuccess(config: NotificationConfig) {
  notifications.show({
    title: config.title || 'Success',
    message: config.message,
    color: 'green',
    icon: createElement(IconCheck, { size: 16 }),
    autoClose: config.autoClose ?? 4000,
    withCloseButton: config.withCloseButton ?? true,
  });
}

// Error notification (red) - for communication errors and exceptions
export function showError(config: NotificationConfig) {
  notifications.show({
    title: config.title || 'Error',
    message: config.message,
    color: 'red',
    icon: createElement(IconX, { size: 16 }),
    autoClose: config.autoClose ?? 7000, // Longer timeout for errors
    withCloseButton: config.withCloseButton ?? true,
  });
}

// Warning notification (yellow)
export function showWarning(config: NotificationConfig) {
  notifications.show({
    title: config.title || 'Warning',
    message: config.message,
    color: 'yellow',
    icon: createElement(IconExclamationMark, { size: 16 }),
    autoClose: config.autoClose ?? 5000,
    withCloseButton: config.withCloseButton ?? true,
  });
}

// Info notification (blue)
export function showInfo(config: NotificationConfig) {
  notifications.show({
    title: config.title || 'Information',
    message: config.message,
    color: 'blue',
    icon: createElement(IconInfoCircle, { size: 16 }),
    autoClose: config.autoClose ?? 4000,
    withCloseButton: config.withCloseButton ?? true,
  });
}

// Specific helpers for common communication scenarios
export function showCommunicationError(error: string | Error, context?: string) {
  const message = error instanceof Error ? error.message : error;
  const title = context ? `${context} Failed` : 'Communication Error';
  
  showError({
    title,
    message,
    autoClose: 8000, // Longer timeout for important errors
  });
}

export function showServerError(error: string | Error) {
  showCommunicationError(error, 'Server Request');
}

export function showDatabaseError(error: string | Error) {
  showCommunicationError(error, 'Database Operation');
}

export function showFileOperationError(error: string | Error, operation?: string) {
  const context = operation ? `File ${operation}` : 'File Operation';
  showCommunicationError(error, context);
}

// Clear all notifications
export function clearAllNotifications() {
  notifications.clean();
}
