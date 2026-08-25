import { usersRepository } from "@/lib/modules/users/repository.server";
import { notFound } from "../lib/errors";
import { json } from "../lib/respond";
import type { Router } from "../lib/router";

export function registerUsersRoutes(router: Router) {
  router.get("/users/:username", async ({ params }) => {
    const { username } = params as { username: string };
    const user = await usersRepository.viewByUsername(username);
    if (!user) throw notFound("User not found");
    return json({ user });
  });

  router.get("/users/:username/balance", async ({ params }) => {
    const { username } = params as { username: string };
    const user = await usersRepository.findByUsername(username);
    if (!user) throw notFound("User not found");
    return json({ username: user.username, ledgerBalance: user.ledgerBalance });
  });

  router.post("/users/ensure", async ({ request }) => {
    const body = (await request.json()) as { username?: string };
    const username = (body.username ?? "").trim().replace(/^@/, "").toLowerCase();
    if (!username || username.length < 3) throw notFound("Username required");
    const user = await usersRepository.ensure({ username });
    return json({ user: await usersRepository.viewByUsername(user.username) });
  });
}
