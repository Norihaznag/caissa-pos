/**
 * Navigation Types
 */

export type RootStackParamList = {
  Login: undefined;
  Cashier: {
    userId: number;
    userName: string;
    userRole: 'admin' | 'cashier';
  };
  Settings: undefined;
};
