import type { User } from "@/features/types/domain/users";

export interface ConnectWalletInput {
  username?: string;
}

export interface ConnectWalletResult {
  user: User;
  balance: number;
}
