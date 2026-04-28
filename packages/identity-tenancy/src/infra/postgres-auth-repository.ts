import type { VerificationTokenDto } from "@wevlo/contracts";
import { type DatabaseExecutor } from "@wevlo/data-access";
import { createHash } from "node:crypto";

export class PostgresAuthRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  private hashToken(token: string): string {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "wevlo-dev-auth-secret";
    return createHash("sha256").update(`${secret}:${token}`).digest("hex");
  }

  async createVerificationToken(token: VerificationTokenDto): Promise<VerificationTokenDto> {
    const hashedToken = this.hashToken(token.token);
    await this.database
      .insertInto("verification_tokens")
      .values({
        identifier: token.identifier,
        token: hashedToken,
        expires: token.expires
      })
      .execute();

    return token;
  }

  async useVerificationToken(identifier: string, token: string): Promise<VerificationTokenDto | null> {
    const hashedToken = this.hashToken(token);
    const now = new Date().toISOString();
    const result = await this.database
      .selectFrom("verification_tokens")
      .selectAll()
      .where("identifier", "=", identifier)
      .where("token", "=", hashedToken)
      .where("expires", ">", now)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    await this.database
      .deleteFrom("verification_tokens")
      .where("identifier", "=", identifier)
      .where("token", "=", hashedToken)
      .execute();

    return {
      identifier: result.identifier,
      token,
      expires: result.expires
    };
  }

  async getVerificationToken(identifier: string, token: string): Promise<VerificationTokenDto | null> {
    const hashedToken = this.hashToken(token);
    const now = new Date().toISOString();
    const result = await this.database
      .selectFrom("verification_tokens")
      .selectAll()
      .where("identifier", "=", identifier)
      .where("token", "=", hashedToken)
      .where("expires", ">", now)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      identifier: result.identifier,
      token,
      expires: result.expires
    };
  }
}
