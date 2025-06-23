// https://vike.dev/data
import * as sqliteQueries from "../../database/sqlite/queries/todos";
import type { PageContextServer } from "vike/types";

export type Data = {
  todo: { text: string }[];
};

export default async function data(_pageContext: PageContextServer): Promise<Data> {
  const todo = sqliteQueries.getAllTodos(_pageContext.db);

  return { todo };
}
