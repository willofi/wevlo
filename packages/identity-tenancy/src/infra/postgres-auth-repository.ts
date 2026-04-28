import type { VerificationTokenDto } from "@wevlo/contracts";
import { type DatabaseExecutor } from "@wevlo/data-access";

export class PostgresAuthRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async createVerificationToken(token: VerificationTokenDto): Promise<VerificationTokenDto> {
    await this.database
      .insertInto("verification_tokens")
      .values({
        identifier: token.identifier,
        token: token.token,
        expires: token.expires
      })
      .execute();

    return token;
  }

  async useVerificationToken(identifier: string, token: string): Promise<VerificationTokenDto | null> {
    const result = await this.database
      .selectFrom("verification_tokens")
      .selectAll()
      .where("identifier", "=", identifier)
      .where("token", "=", token)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    await this.database
      .deleteFrom("verification_tokens")
      .where("identifier", "=", identifier)
      .where("token", "=", token)
      .execute();

    return {
      identifier: result.identifier,
      token: result.token,
      expires: result.expires
    };
  }

  async getVerificationToken(identifier: string, token: string): Promise<VerificationTokenDto | null> {
    const result = await this.database
      .selectFrom("verification_tokens")
      .selectAll()
      .where("identifier", "=", identifier)
      .where("token", "=", token)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      identifier: result.identifier,
      token: result.token,
      expires: result.expires
    };
  }
}
