import { getTableName, sql, type Column, type SQL } from "drizzle-orm";
import { toSnakeCase } from "drizzle-orm/casing";

/**
 * A table-qualified column reference ("patients"."id").
 *
 * Drizzle renders select-list columns of single-table queries without the
 * table name. Inside a correlated subquery that turns `outer.id` into a bare
 * "id", which Postgres resolves against the subquery's own tables first
 * (ambiguous, or silently the wrong column). Use this for every outer column
 * referenced from a subquery in a select list.
 *
 * Columns are declared without explicit names and converted by the db's
 * `casing: "snake_case"` setting, so the same conversion is applied here.
 */
export function qualified(column: Column): SQL {
  const name = (column as Column & { keyAsName?: boolean }).keyAsName ? toSnakeCase(column.name) : column.name;
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(name)}`;
}
