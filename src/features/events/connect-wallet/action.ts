import type { ConnectWalletInput, ConnectWalletResult } from "@/features/types/wallet";
import { buildUser } from "@/features/mocks/data/users/model";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { hiveService } from "@/features/mocks/services";
import { MOCK_HIVE_USERNAME } from "@/features/lib/data/seed-data";

/** Connects the (mocked) Hive wallet and starts a session. */
export async function connectWallet(input: ConnectWalletInput = {}): Promise<ConnectWalletResult> {
  usersRepository.setConnecting(true);
  try {
    const { username, balance } = await hiveService.connect(input.username ?? MOCK_HIVE_USERNAME);
    const user = buildUser(username);
    usersRepository.setSession(user, { connected: true, balance });
    return { user, balance: usersRepository.balanceOf(username) || balance };
  } catch (error) {
    usersRepository.setConnecting(false);
    throw error;
  }
}

/** Ends the session. */
export async function disconnectWallet(): Promise<void> {
  await hiveService.disconnect();
  usersRepository.setSession(null, { connected: false });
}
