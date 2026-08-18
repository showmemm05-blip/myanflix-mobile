export interface PaymentAccountType {
  value: string;
  label: string;
  requiresBankName: boolean;
  logoUrl: string | null;
}

export interface PaymentAccount {
  id: string;
  type: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  note: string | null;
}
