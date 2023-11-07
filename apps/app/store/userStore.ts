import * as sql from "./sql/sql";

export const table = "user_v1";

export const initialize = () => {
  sql.execute(
    `CREATE TABLE IF NOT EXISTS "${table}" (
      "id"	TEXT NOT NULL,
      "username"	TEXT NOT NULL,
      PRIMARY KEY("id")
    );`
  );
};
