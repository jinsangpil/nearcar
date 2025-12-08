export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | null;
}

