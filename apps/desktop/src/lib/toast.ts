/**
 * Simple toast notification system
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

type Subscriber = (toasts: Toast[]) => void;

class ToastManager {
  private toasts: Toast[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private counter = 0;

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    fn(this.toasts);
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    this.subscribers.forEach((fn) => fn([...this.toasts]));
  }

  show(message: string, type: ToastType = 'info', duration = 3000) {
    const id = `toast-${++this.counter}`;
    const toast: Toast = { id, message, type, duration };

    this.toasts = [...this.toasts, toast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  dismissAll() {
    this.toasts = [];
    this.notify();
  }

  success(message: string, duration?: number) {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    return this.show(message, 'error', duration ?? 5000);
  }

  info(message: string, duration?: number) {
    return this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number) {
    return this.show(message, 'warning', duration ?? 4000);
  }
}

export const toast = new ToastManager();
